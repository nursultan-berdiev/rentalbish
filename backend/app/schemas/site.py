"""Схемы настроек сайта: публичный статус витрины и админское обновление."""

from pydantic import BaseModel, ConfigDict, Field


class SiteStatusOut(BaseModel):
    """Публичный статус витрины (читает web-site без авторизации)."""

    maintenance: bool
    whatsapp_phone: str


class SiteSettingsOut(BaseModel):
    """Полные настройки для админки."""

    model_config = ConfigDict(from_attributes=True)

    maintenance_mode: bool
    whatsapp_phone: str


class SiteSettingsUpdate(BaseModel):
    """Частичное обновление: меняем только переданные поля."""

    maintenance_mode: bool | None = None
    whatsapp_phone: str | None = Field(default=None, min_length=1, max_length=32)
