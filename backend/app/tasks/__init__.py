"""Пакет фоновых задач Celery. Реальные задачи добавляются в Этапах 2–3."""

from app.core.celery_app import celery_app


@celery_app.task(name="ping")
def ping() -> str:
    """Служебная задача для проверки, что worker жив."""
    return "pong"
