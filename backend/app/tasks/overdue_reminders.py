"""Ежедневное напоминание о просроченных возвратах в Telegram."""

import logging
from datetime import date

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.services import reservation
from app.tasks.telegram_notify import _send

logger = logging.getLogger(__name__)


@celery_app.task(name="overdue_reminders")
def overdue_reminders() -> int:
    """Собрать просроченные брони и отправить сводку. Возвращает их число."""
    with SessionLocal() as db:
        overdue = reservation.overdue_bookings(db, date.today())
        if not overdue:
            return 0
        lines = ["<b>⏰ Просроченные возвраты</b>"]
        for b in overdue:
            qty = sum(bi.issued_qty - bi.returned_qty for bi in reservation.on_hands_items(b))
            lines.append(
                f"  • Бронь #{b.id}, {b.client.name} ({b.client.phone}) — "
                f"на руках {qty}, ждём с {b.expected_return_date.isoformat()}"
            )
        _send("\n".join(lines))
        return len(overdue)
