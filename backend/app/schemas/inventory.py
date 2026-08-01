"""Схемы остатков и складских движений."""

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import WriteOffReason


class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    location_id: int
    total_qty: int
    reserved_qty: int
    issued_qty: int
    available: int


class StockRow(BaseModel):
    """Строка сводки остатков с человекочитаемыми названиями."""

    product_id: int
    product_name: str
    product_category: str = ""
    location_id: int
    location_name: str
    total_qty: int
    reserved_qty: int
    issued_qty: int
    available: int


class SupplyCreate(BaseModel):
    product_id: int
    location_id: int
    quantity: int = Field(gt=0)
    comment: str = ""


class SupplyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    location_id: int
    quantity: int
    comment: str


class WriteOffCreate(BaseModel):
    product_id: int
    location_id: int
    quantity: int = Field(gt=0)
    reason: WriteOffReason = WriteOffReason.BREAKAGE


class WriteOffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    location_id: int
    booking_id: int | None
    quantity: int
    reason: WriteOffReason
    from_issued: bool
    amount: float
