"""Схема записи журнала аудита."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    action: str
    entity: str
    entity_id: int | None
    old_value: str | None
    new_value: str | None
    created_at: datetime
