from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine


logger = logging.getLogger(__name__)


def ensure_projects_auto_send_columns(engine: Engine) -> None:
    """Backfill schema drift on persisted MariaDB volumes created before these columns existed."""
    statements = (
        """
        ALTER TABLE projects
          ADD COLUMN IF NOT EXISTS auto_send_on_preview TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active
        """,
        """
        ALTER TABLE projects
          ADD COLUMN IF NOT EXISTS auto_send_on_completed TINYINT(1) NOT NULL DEFAULT 0 AFTER auto_send_on_preview
        """,
    )

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))

    logger.info("Schema compatibility check completed for projects auto-send flags")
