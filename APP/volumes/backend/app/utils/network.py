# utils/network.py
from starlette.requests import Request


def get_client_ip(request: Request) -> tuple[str | None, str | None]:
    """
    Retorna (ip_v4, ip_v6).
    Respeta X-Forwarded-For si viene del proxy.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else None

    if not ip:
        return None, None

    try:
        import ipaddress
        parsed = ipaddress.ip_address(ip)
        if parsed.version == 6:
            return None, str(parsed)
        return str(parsed), None
    except ValueError:
        return ip, None