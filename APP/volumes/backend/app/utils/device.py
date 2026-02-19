# utils/device.py
from user_agents import parse


def get_device_string(user_agent_str: str | None) -> str | None:
    if not user_agent_str:
        return None

    ua = parse(user_agent_str)

    if ua.is_mobile:
        device_type = "Mobile"
    elif ua.is_tablet:
        device_type = "Tablet"
    elif ua.is_pc:
        device_type = "Web"
    else:
        device_type = "Unknown"

    browser = ua.browser.family
    browser_version = ua.browser.version_string.split(".")[0]
    os_info = ua.os.family

    if ua.os.version_string:
        os_info += f" {ua.os.version_string.split('.')[0]}"

    if ua.device.family and ua.device.family != "Other":
        return f"{device_type} — {browser}/{os_info} ({ua.device.family})"

    return f"{device_type} — {browser} {browser_version}/{os_info}"