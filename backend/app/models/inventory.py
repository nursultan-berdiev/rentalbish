"""Складские остатки и движения: Stock, Supply, WriteOff.

Инвариант остатка по паре (товар × точка):
    Доступно = total_qty − reserved_qty − issued_qty
где total_qty — физически числится на точке (растёт от завоза, падает от списания).
"""

from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, enum_type
from app.models.catalog import Product
from app.models.enums import WriteOffReason
from app.models.location import Location


class Stock(Base, TimestampMixin):
    """Актуальный остаток товара на конкретной точке."""

    __tablename__ = "stocks"
    __table_args__ = (UniqueConstraint("product_id", "location_id", name="uq_stock_product_loc"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    total_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    issued_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped[Product] = relationship("Product", lazy="joined")
    location: Mapped[Location] = relationship("Location", lazy="joined")

    @property
    def available(self) -> int:
        return self.total_qty - self.reserved_qty - self.issued_qty


class Supply(Base, TimestampMixin):
    """Завоз товара на точку (+total_qty)."""

    __tablename__ = "supplies"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    product: Mapped[Product] = relationship("Product", lazy="joined")
    location: Mapped[Location] = relationship("Location", lazy="joined")


class WriteOff(Base, TimestampMixin):
    """Списание: бой/утеря/износ (−total_qty). Сумма удержания = qty × залоговая цена."""

    __tablename__ = "write_offs"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id", ondelete="CASCADE"), nullable=False
    )
    booking_id: Mapped[int | None] = mapped_column(
        ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[WriteOffReason] = mapped_column(
        enum_type(WriteOffReason), default=WriteOffReason.BREAKAGE, nullable=False
    )
    # Была ли позиция на руках у клиента (из issued_qty) на момент списания.
    from_issued: Mapped[bool] = mapped_column(default=False, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    product: Mapped[Product] = relationship("Product", lazy="joined")
    location: Mapped[Location] = relationship("Location", lazy="joined")
