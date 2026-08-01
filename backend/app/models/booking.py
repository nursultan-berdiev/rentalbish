"""Клиенты, брони и операции выдачи/возврата."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, enum_type
from app.models.catalog import Product
from app.models.enums import BookingStatus, ClientSource
from app.models.location import Location


class Client(Base, TimestampMixin):
    """Клиент без регистрации: идентификация по телефону."""

    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    extra_contacts: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    source: Mapped[ClientSource] = mapped_column(
        enum_type(ClientSource), default=ClientSource.CALL, nullable=False
    )
    comment: Mapped[str] = mapped_column(Text, default="", nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Client {self.name} {self.phone}>"


class Booking(Base, TimestampMixin):
    """Бронь: резерв позиций за клиентом на период на выбранной точке."""

    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False
    )
    location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_return_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        enum_type(BookingStatus), default=BookingStatus.NEW, nullable=False, index=True
    )
    rental_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    deposit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    prepaid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    client: Mapped[Client] = relationship("Client", lazy="joined")
    location: Mapped[Location] = relationship("Location", lazy="joined")
    items: Mapped[list["BookingItem"]] = relationship(
        "BookingItem",
        back_populates="booking",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Booking #{self.id} {self.status.value}>"


class BookingItem(Base):
    """Позиция брони с зафиксированной суточной ценой на момент оформления."""

    __tablename__ = "booking_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    # Фактически выдано и возвращено по этой позиции (для частичных операций).
    issued_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    returned_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    daily_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )

    booking: Mapped[Booking] = relationship("Booking", back_populates="items")
    product: Mapped[Product] = relationship("Product", lazy="joined")


class Issue(Base, TimestampMixin):
    """Событие выдачи товара по брони."""

    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    issued_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    items: Mapped[list["IssueItem"]] = relationship(
        "IssueItem", back_populates="issue", cascade="all, delete-orphan", lazy="selectin"
    )


class IssueItem(Base):
    __tablename__ = "issue_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    issue: Mapped[Issue] = relationship("Issue", back_populates="items")
    product: Mapped[Product] = relationship("Product", lazy="joined")


class Return(Base, TimestampMixin):
    """Событие возврата (возможен частичный)."""

    __tablename__ = "returns"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    returned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    items: Mapped[list["ReturnItem"]] = relationship(
        "ReturnItem", back_populates="return_", cascade="all, delete-orphan", lazy="selectin"
    )


class ReturnItem(Base):
    __tablename__ = "return_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    return_id: Mapped[int] = mapped_column(
        ForeignKey("returns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    # Сколько вернулось в целости.
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    # Сколько из выданного не вернулось и списано (бой/утеря) в этом же возврате.
    broken_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    return_: Mapped[Return] = relationship("Return", back_populates="items")
    product: Mapped[Product] = relationship("Product", lazy="joined")
