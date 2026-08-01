"""Схемы клиентов, броней, выдач и возвратов."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import BookingStatus, ClientSource


class ClientBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=3, max_length=32)
    extra_contacts: str = ""
    source: ClientSource = ClientSource.CALL
    comment: str = ""


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, min_length=3, max_length=32)
    extra_contacts: str | None = None
    source: ClientSource | None = None
    comment: str | None = None


class ClientOut(ClientBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class BookingItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class BookingItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str = ""
    unit: str = "шт"
    quantity: int
    issued_qty: int
    # Возвращено целыми (без боя) и списано в бой — панель показывает раздельно.
    returned_qty: int
    broken_qty: int = 0
    daily_price: float
    deposit_price: float = 0
    line_total: float


class BookingCreate(BaseModel):
    client_id: int
    location_id: int
    start_date: date
    expected_return_date: date
    items: list[BookingItemIn] = Field(min_length=1)
    deposit: float | None = None
    prepaid: float = 0
    # Черновик не резервирует остаток — резерв произойдёт при подтверждении.
    draft: bool = False


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    client_name: str = ""
    client_phone: str = ""
    location_id: int
    location_name: str = ""
    start_date: date
    expected_return_date: date
    days: int
    status: BookingStatus
    rental_total: float
    deposit: float | None
    prepaid: float
    items: list[BookingItemOut] = []
    created_at: datetime


class IssueItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class IssueIn(BaseModel):
    items: list[IssueItemIn] = Field(min_length=1)


class ReturnItemIn(BaseModel):
    product_id: int
    quantity: int = Field(ge=0, description="Возвращено в целости")
    broken_qty: int = Field(default=0, ge=0, description="Бой/утеря")


class ReturnIn(BaseModel):
    items: list[ReturnItemIn] = Field(min_length=1)


class BookingSettlement(BaseModel):
    """Итоговый расчёт по брони."""

    booking_id: int
    rental_total: float
    prepaid: float
    breakage_total: float
    to_pay: float  # аренда + бой − предоплата
    on_hands: list[BookingItemOut] = []
