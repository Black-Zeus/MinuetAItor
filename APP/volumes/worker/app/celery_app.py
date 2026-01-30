import os
from celery import Celery

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")

app = Celery(
    "minuetaitor",
    broker=f"redis://{REDIS_HOST}:{REDIS_PORT}/0",
    backend=f"redis://{REDIS_HOST}:{REDIS_PORT}/1",
)

# si más adelante defines tareas en tasks.py:
# app.autodiscover_tasks(["tasks"])
