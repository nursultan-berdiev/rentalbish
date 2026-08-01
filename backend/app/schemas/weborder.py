"""Схемы заявок с сайта-витрины."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import WebOrderStatus


class WebOrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class WebOrderCreate(BaseModel):
    """Контракт web-site/api.ts: name, phone, items, comment."""

    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=3, max_length=32)
    items: list[WebOrderItemIn] = Field(min_length=1)
    comment: str = ""


class WebOrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    quantity: int


class WebOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    comment: str
    status: WebOrderStatus
    booking_id: int | None
    items: list[WebOrderItemOut] = []
    created_at: datetime


class WebOrderStatusUpdate(BaseModel):
    status: WebOrderStatus


class WebOrderConvert(BaseModel):
    """Конвертация заявки в бронь. Точку и даты назначает оператор."""

    location_id: int
    start_date: date
    expected_return_date: date
    deposit: float | None = None
    prepaid: float = 0
