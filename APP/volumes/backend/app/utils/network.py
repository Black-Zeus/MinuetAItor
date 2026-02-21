import ipaddress
from starlette.requests import Request


# IPs/rangos de proxies confiables (Docker, localhost)
_TRUSTED_PROXIES = [
    ipaddress.ip_network("127.0.0.0/8"),    # localhost
    ipaddress.ip_network("::1/128"),         # localhost IPv6
    ipaddress.ip_network("10.0.0.0/8"),      # Docker / privada clase A
    ipaddress.ip_network("172.16.0.0/12"),   # Docker bridge (172.17-172.31)
    ipaddress.ip_network("192.168.0.0/16"),  # privada clase C
]


def _is_trusted_proxy(ip: str) -> bool:
    try:
        parsed = ipaddress.ip_address(ip)
        return any(parsed in network for network in _TRUSTED_PROXIES)
    except ValueError:
        return False


def get_client_ip(request: Request) -> tuple[str | None, str | None]:
    """
    Retorna (ip_v4, ip_v6).
    Solo respeta X-Forwarded-For si el proxy directo es confiable (red interna/Docker).
    """
    proxy_ip = request.client.host if request.client else None
    forwarded_for = request.headers.get("X-Forwarded-For")
    
    # import logging
    # logging.warning(f"[IP DEBUG] proxy_ip={proxy_ip} | forwarded_for={forwarded_for} | trusted={_is_trusted_proxy(proxy_ip) if proxy_ip else False}")
    
    if forwarded_for and proxy_ip and _is_trusted_proxy(proxy_ip):
        ip = forwarded_for.split(",")[0].strip()
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