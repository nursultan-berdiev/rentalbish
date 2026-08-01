"""Расчёт по брони: аренда + удержание за бой − предоплата.

Единая формула для API (`/bookings/{id}/settlement`) и для ИИ-слоя
(`warehouse_queries.get_client_debt`) — чтобы долг клиента и итог по брони
не разъезжались.
"""

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingItem
from app.models.inventory import WriteOff
from app.services.money import money
from app.services.reservation import on_hands_items


@dataclass(frozen=True)
class Settlement:
    booking_id: int
    rental_total: Decimal
    prepaid: Decimal
    breakage_total: Decimal
    to_pay: Decimal
    on_hands: list[BookingItem]


def breakage_total(db: Session, booking_id: int) -> Decimal:
    """Сумма удержаний за бой по брони."""
    total = db.execute(
        select(func.coalesce(func.sum(WriteOff.amount), 0)).where(WriteOff.booking_id == booking_id)
    ).scalar_one()
    return money(total)


def settle(db: Session, booking: Booking) -> Settlement:
    breakage = breakage_total(db, booking.id)
    rental = money(booking.rental_total)
    prepaid = money(booking.prepaid)
    return Settlement(
        booking_id=booking.id,
        rental_total=rental,
        prepaid=prepaid,
        breakage_total=breakage,
        to_pay=rental + breakage - prepaid,
        on_hands=on_hands_items(booking),
    )
