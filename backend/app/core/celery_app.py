"""Celery-приложение для фоновых задач (Telegram-уведомления, импорт, напоминания)."""

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "rentalbish",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks"],
)

celery_app.conf.update(
    task_track_started=True,
    timezone="Asia/Bishkek",
    enable_utc=True,
)
