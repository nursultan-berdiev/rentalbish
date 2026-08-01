"""Точка/склад (Location) и привязка сотрудников к точкам (M2M)."""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User

# M2M: право сотрудника работать по конкретной точке.
user_locations = Table(
    "user_locations",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("location_id", ForeignKey("locations.id", ondelete="CASCADE"), primary_key=True),
)


class Location(Base, TimestampMixin):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    comment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Сотрудники, имеющие право работать по этой точке (обратная связь — User.locations).
    staff: Mapped[list["User"]] = relationship(
        "User", secondary=user_locations, backref="locations", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Location {self.name}>"
