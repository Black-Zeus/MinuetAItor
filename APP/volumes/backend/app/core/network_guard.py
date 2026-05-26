from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

from core.config import settings
from core.exceptions import BadRequestException


BLOCKED_HOSTS = {"localhost", "metadata.google.internal"}
BLOCKED_IPS = {
    ipaddress.ip_address("169.254.169.254"),
}


def _resolve_host_ips(host: str) -> set[ipaddress._BaseAddress]:
    try:
        records = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return set()

    ips: set[ipaddress._BaseAddress] = set()
    for record in records:
        raw_ip = record[4][0]
        try:
            ips.add(ipaddress.ip_address(raw_ip))
        except ValueError:
            continue
    return ips


def assert_safe_outbound_host(host: str | None) -> None:
    clean_host = str(host or "").strip().strip("[]").lower()
    if not clean_host:
        raise BadRequestException("El host remoto es obligatorio")

    if clean_host in BLOCKED_HOSTS:
        raise BadRequestException("El host remoto configurado no está permitido")

    try:
        direct_ips = {ipaddress.ip_address(clean_host)}
    except ValueError:
        direct_ips = _resolve_host_ips(clean_host)

    for ip in direct_ips:
        if (
            ip in BLOCKED_IPS
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_unspecified
            or ip.is_reserved
        ):
            raise BadRequestException("El host remoto resuelve a una dirección no permitida")
        if not settings.allow_private_provider_hosts and ip.is_private:
            raise BadRequestException("El host remoto privado no está permitido en este entorno")


def assert_safe_outbound_url(url: str) -> None:
    parsed = urlparse(str(url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise BadRequestException("La URL remota debe iniciar con http:// o https:// y contener un host válido")
    assert_safe_outbound_host(parsed.hostname)
