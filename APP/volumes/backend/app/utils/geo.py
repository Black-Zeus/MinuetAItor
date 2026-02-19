# utils/geo.py
import ipaddress
from functools import lru_cache

import geoip2.database
import geoip2.errors

from core.config import settings


def _is_private_ip(ip: str) -> bool:
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return False


@lru_cache(maxsize=1)
def _get_reader() -> geoip2.database.Reader:
    return geoip2.database.Reader(settings.geo_db_path)


def get_geo(ip: str) -> dict:
    """
    Retorna dict con country_code, country_name, city, location.
    Para IPs privadas retorna valores vacíos sin consultar la DB.
    """
    if _is_private_ip(ip):
        return {
            "country_code": None,
            "country_name": None,
            "city":         None,
            "location":     "Local",
        }

    try:
        reader   = _get_reader()
        response = reader.city(ip)
        country_code = response.country.iso_code
        country_name = response.country.name
        city         = response.city.name
        location     = f"{city}, {country_code}" if city and country_code else country_code

        return {
            "country_code": country_code,
            "country_name": country_name,
            "city":         city,
            "location":     location,
        }
    except geoip2.errors.AddressNotFoundError:
        return {
            "country_code": None,
            "country_name": None,
            "city":         None,
            "location":     None,
        }