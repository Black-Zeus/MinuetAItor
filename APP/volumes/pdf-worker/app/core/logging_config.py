# core/logging_config.py
import logging
import sys
from core.config import settings

def setup_logging():
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        stream=sys.stdout,
    )

def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)