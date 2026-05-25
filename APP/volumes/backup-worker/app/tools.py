from __future__ import annotations

import shutil
from dataclasses import dataclass


@dataclass(frozen=True)
class ToolCheck:
    name: str
    path: str | None

    @property
    def available(self) -> bool:
        return bool(self.path)


REQUIRED_TOOLS_BY_JOB_TYPE: dict[str, tuple[str, ...]] = {
    "db_backup": ("mariadb-dump", "gzip", "sha256sum", "tar"),
    "object_backup": ("mc", "tar", "gzip", "sha256sum"),
    "full_backup": ("mariadb-dump", "mc", "tar", "gzip", "sha256sum"),
    "restore_backup": ("mariadb", "mc", "tar", "gzip", "sha256sum"),
    "backup_purge": ("sha256sum",),
}


def check_tool(name: str) -> ToolCheck:
    return ToolCheck(name=name, path=shutil.which(name))


def check_required_tools(job_type: str) -> list[ToolCheck]:
    return [check_tool(name) for name in REQUIRED_TOOLS_BY_JOB_TYPE.get(job_type, ())]


def missing_tool_names(job_type: str) -> list[str]:
    return [tool.name for tool in check_required_tools(job_type) if not tool.available]
