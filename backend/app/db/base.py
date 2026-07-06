"""Базовый класс моделей и общие миксины."""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def enum_type(enum_cls: type[enum.Enum], length: int = 32) -> Enum:
    """SQLAlchemy Enum, хранящий ЗНАЧЕНИЯ членов (не имена) как VARCHAR."""
    return Enum(
        enum_cls,
        native_enum=False,
        length=length,
        values_callable=lambda e: [m.value for m in e],
    )


class TimestampMixin:
    """Метки создания/обновления записи."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
