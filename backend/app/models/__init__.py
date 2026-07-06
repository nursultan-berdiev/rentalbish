"""Реестр моделей. Импорт здесь нужен, чтобы Alembic видел все таблицы в Base.metadata."""

from app.db.base import Base
from app.models.user import User

__all__ = ["Base", "User"]
