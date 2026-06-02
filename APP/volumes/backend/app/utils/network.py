import ipaddress
import re
from starlette.requests import Request


# IPs/rangos de proxies confiables (Docker, localhost)
_TRUSTED_PROXIES = [
    ipaddress.ip_network("127.0.0.0/8"),    # localhost
    ipaddress.ip_network("::1/128"),         # localhost IPv6
    ipaddress.ip_network("172.16.0.0/12"),   # Docker bridge (172.17-172.31)
]


def _is_trusted_proxy(ip: str) -> bool:
    try:
        parsed = ipaddress.ip_address(ip)
        return any(parsed in network for network in _TRUSTED_PROXIES)
    except ValueError:
        return False


def sanitize_client_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    value = str(ip).strip()
    if not value:
        return None
    return value


def _clean_forwarded_value(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip().strip('"')
    if cleaned.startswith("[") and "]" in cleaned:
        cleaned = cleaned[1:cleaned.index("]")]
    elif ":" in cleaned and cleaned.count(":") == 1:
        cleaned = cleaned.split(":", 1)[0]
    return cleaned or None


def _parse_forwarded_header(value: str | None) -> list[str]:
    if not value:
        return []
    candidates: list[str] = []
    for part in value.split(","):
        match = re.search(r"(?:^|;)\s*for=([^;]+)", part, flags=re.IGNORECASE)
        if match:
            cleaned = _clean_forwarded_value(match.group(1))
            if cleaned:
                candidates.append(cleaned)
    return candidates


def get_client_ip(request: Request) -> tuple[str | None, str | None]:
    """
    Retorna (ip_v4, ip_v6).
    Respeta headers de proxy solo si el hop directo es confiable.
    Elige la primera IP no perteneciente a un proxy confiable y evita persistir IPs Docker.
    """
    proxy_ip = request.client.host if request.client else None
    forwarded_for = request.headers.get("X-Forwarded-For")
    forwarded = request.headers.get("Forwarded")
    real_ip = request.headers.get("X-Real-IP")
    client_ip_headers = (
        request.headers.get("CF-Connecting-IP"),
        request.headers.get("True-Client-IP"),
        request.headers.get("X-Client-IP"),
    )
    
    # import logging
    # logging.warning(f"[IP DEBUG] proxy_ip={proxy_ip} | forwarded_for={forwarded_for} | trusted={_is_trusted_proxy(proxy_ip) if proxy_ip else False}")
    
    if proxy_ip and _is_trusted_proxy(proxy_ip):
        candidates = []
        candidates.extend(_parse_forwarded_header(forwarded))
        candidates.extend(
            cleaned
            for cleaned in (_clean_forwarded_value(x) for x in client_ip_headers)
            if cleaned
        )
        if forwarded_for:
            candidates.extend(
                cleaned
                for cleaned in (_clean_forwarded_value(x) for x in forwarded_for.split(","))
                if cleaned
            )
        if real_ip:
            cleaned_real_ip = _clean_forwarded_value(real_ip)
            if cleaned_real_ip:
                candidates.append(cleaned_real_ip)
        candidates.append(proxy_ip)

        ip = next((candidate for candidate in candidates if not _is_trusted_proxy(candidate)), None)
        if not ip and candidates:
            ip = candidates[0]
    else:
        ip = proxy_ip

    if not ip:
        return None, None

    try:
        parsed = ipaddress.ip_address(ip)
        if parsed.version == 6:
            return None, str(parsed)
        return str(parsed), None
    except ValueError:
        return ip, None


def _is_private_or_local(ip: str | None) -> bool:
    if not ip:
        return False
    try:
        parsed = ipaddress.ip_address(ip)
        return parsed.is_private or parsed.is_loopback or parsed.is_link_local
    except ValueError:
        return False


def get_request_ip_context(request: Request) -> dict[str, str | None]:
    """
    Entrega IP publica/privada cuando la cadena de proxy permite distinguirlas.
    - public_ip: primera IP cliente no privada detectada desde headers confiables.
    - private_ip: IP privada/local detectada como cliente o hop directo.
    - direct_ip: IP del peer que conecto al backend.
    """
    ip_v4, ip_v6 = get_client_ip(request)
    detected_ip = ip_v4 or ip_v6
    direct_ip = sanitize_client_ip(request.client.host if request.client else None)

    public_ip = detected_ip if detected_ip and not _is_private_or_local(detected_ip) else None
    private_ip = None

    if detected_ip and _is_private_or_local(detected_ip):
        private_ip = detected_ip
    elif direct_ip and _is_private_or_local(direct_ip):
        private_ip = direct_ip

    return {
        "public_ip": public_ip,
        "private_ip": private_ip,
        "direct_ip": direct_ip,
        "ip_v4": ip_v4,
        "ip_v6": ip_v6,
    }
