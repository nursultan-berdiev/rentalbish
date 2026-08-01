"""Заявка с публичного сайта-витрины."""

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, enum_type
from app.models.catalog import Product
from app.models.enums import WebOrderStatus


class WebOrder(Base, TimestampMixin):
    __tablename__ = "web_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    comment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[WebOrderStatus] = mapped_column(
        enum_type(WebOrderStatus), default=WebOrderStatus.NEW, nullable=False, index=True
    )
    # Заполняется при конвертации заявки в бронь.
    booking_id: Mapped[int | None] = mapped_column(
        ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True
    )

    items: Mapped[list["WebOrderItem"]] = relationship(
        "WebOrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class WebOrderItem(Base):
    __tablename__ = "web_order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("web_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    order: Mapped[WebOrder] = relationship("WebOrder", back_populates="items")
    product: Mapped[Product] = relationship("Product", lazy="joined")
