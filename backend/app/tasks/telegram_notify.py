"""Отправка уведомлений в Telegram-бот (заявки с сайта, при желании — просрочки)."""

import logging

import requests

from app.core.celery_app import celery_app
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.weborder import WebOrder

logger = logging.getLogger(__name__)

_API = "https://api.telegram.org/bot{token}/sendMessage"


def _send(text: str) -> bool:
    """Отправить сообщение в Telegram. Без токена/чата — тихо пропустить."""
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        logger.info("Telegram не настроен — уведомление пропущено")
        return False
    try:
        resp = requests.post(
            _API.format(token=settings.TELEGRAM_BOT_TOKEN),
            json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except requests.RequestException as exc:  # pragma: no cover - сетевой сбой
        logger.warning("Не удалось отправить Telegram-уведомление: %s", exc)
        return False


def format_web_order(order: WebOrder) -> str:
    lines = [
        "<b>🍽 Новая заявка с сайта</b>",
        f"Имя: {order.name}",
        f"Телефон: {order.phone}",
    ]
    if order.comment:
        lines.append(f"Комментарий: {order.comment}")
    lines.append("Позиции:")
    for item in order.items:
        name = item.product.name if item.product else f"id={item.product_id}"
        lines.append(f"  • {name} × {item.quantity}")
    return "\n".join(lines)


@celery_app.task(name="notify_web_order")
def notify_web_order(order_id: int) -> bool:
    with SessionLocal() as db:
        order = db.get(WebOrder, order_id)
        if order is None:
            logger.warning("Заявка id=%s не найдена для уведомления", order_id)
            return False
        return _send(format_web_order(order))
