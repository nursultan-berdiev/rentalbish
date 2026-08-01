"""Сборка «богатых» ответов API: к брони подмешиваются имена клиента, точки и товаров.

Панель показывает бронь одной строкой (клиент, телефон, точка, позиции с названиями
и залогом), поэтому отдавать голые id недостаточно.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.inventory import WriteOff
from app.schemas.booking import BookingItemOut, BookingOut


def _broken_by_product(db: Session, booking_id: int) -> dict[int, int]:
    """Сколько единиц каждого товара списано в бой по этой брони."""
    rows = db.execute(
        select(WriteOff.product_id, func.coalesce(func.sum(WriteOff.quantity), 0))
        .where(WriteOff.booking_id == booking_id)
        .group_by(WriteOff.product_id)
    ).all()
    return {product_id: int(qty) for product_id, qty in rows}


def booking_out(db: Session, booking: Booking) -> BookingOut:
    broken = _broken_by_product(db, booking.id)
    items = []
    for bi in booking.items:
        broken_qty = broken.get(bi.product_id, 0)
        items.append(
            BookingItemOut(
                id=bi.id,
                product_id=bi.product_id,
                product_name=bi.product.name,
                unit=bi.product.unit,
                quantity=bi.quantity,
                issued_qty=bi.issued_qty,
                # returned_qty в модели = целые + бой; в панели их показываем раздельно.
                returned_qty=max(0, bi.returned_qty - broken_qty),
                broken_qty=broken_qty,
                daily_price=float(bi.daily_price),
                deposit_price=float(bi.product.deposit_price),
                line_total=float(bi.line_total),
            )
        )
    return BookingOut(
        id=booking.id,
        client_id=booking.client_id,
        client_name=booking.client.name,
        client_phone=booking.client.phone,
        location_id=booking.location_id,
        location_name=booking.location.name,
        start_date=booking.start_date,
        expected_return_date=booking.expected_return_date,
        days=booking.days,
        status=booking.status,
        rental_total=float(booking.rental_total),
        deposit=float(booking.deposit) if booking.deposit is not None else None,
        prepaid=float(booking.prepaid),
        items=items,
        created_at=booking.created_at,
    )


def bookings_out(db: Session, bookings: list[Booking]) -> list[BookingOut]:
    return [booking_out(db, b) for b in bookings]
