"""Запись в журнал аудита.

Аудит пишется явно из операционных сервисов (выдача, возврат, бой, цены, брони) —
это предсказуемее и тестируемее, чем неявные event listeners. Действующий
пользователь передаётся вызывающим кодом из контекста запроса.
"""

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def _dump(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, default=str, sort_keys=True)


def record(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    entity: str,
    entity_id: int | None = None,
    old: Any = None,
    new: Any = None,
) -> AuditLog:
    """Добавить запись аудита в текущую сессию (без commit — коммитит вызывающий)."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        old_value=_dump(old),
        new_value=_dump(new),
    )
    db.add(entry)
    return entry
