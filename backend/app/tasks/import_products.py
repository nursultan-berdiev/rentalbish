"""Тяжёлый Excel-импорт каталога как фоновая задача."""

import base64
import logging

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.services import excel_import

logger = logging.getLogger(__name__)


@celery_app.task(name="import_products")
def import_products(file_b64: str, user_id: int | None = None) -> dict:
    """Разобрать и создать товары. Файл передаётся base64 (celery-совместимо)."""
    file_bytes = base64.b64decode(file_b64)
    parsed = excel_import.parse(file_bytes)
    with SessionLocal() as db:
        created = excel_import.create_products(db, parsed.rows, user_id=user_id)
    return {"created": created, "errors": parsed.errors, "parsed": len(parsed.rows)}
