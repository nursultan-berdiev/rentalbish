"""Настройки сайта (singleton-строка id=1): режим обслуживания и контактный номер."""

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class SiteSettings(Base, TimestampMixin):
    """Единственная строка (id=1) с общесайтовыми настройками витрины."""

    __tablename__ = "site_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Режим обслуживания: витрина показывает заставку «Скоро открытие» вместо каталога.
    maintenance_mode: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Контактный номер WhatsApp — единый источник для всех wa.me-ссылок сайта.
    whatsapp_phone: Mapped[str] = mapped_column(String(32), default="996552080610", nullable=False)
