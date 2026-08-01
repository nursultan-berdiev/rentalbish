"""Celery-приложение для фоновых задач (Telegram-уведомления, импорт, напоминания)."""

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "rentalbish",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks",
        "app.tasks.telegram_notify",
        "app.tasks.import_products",
        "app.tasks.overdue_reminders",
    ],
)

celery_app.conf.update(
    task_track_started=True,
    timezone="Asia/Bishkek",
    enable_utc=True,
    task_always_eager=settings.CELERY_ALWAYS_EAGER,
    task_eager_propagates=False,
    beat_schedule={
        "overdue-reminders-daily": {
            "task": "overdue_reminders",
            "schedule": 24 * 60 * 60,  # раз в сутки
        },
    },
)
