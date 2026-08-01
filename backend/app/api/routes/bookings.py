"""Брони: создание (резерв), отмена, выдача, возврат, расчёт, просрочки."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_or_404, require_staff
from app.api.serializers import booking_out, bookings_out
from app.db.session import get_db
from app.models.booking import Booking
from app.models.enums import BookingStatus
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingItemOut,
    BookingOut,
    BookingSettlement,
    IssueIn,
    ReturnIn,
)
from app.services import reservation, settlement

router = APIRouter(prefix="/bookings", tags=["bookings"], dependencies=[Depends(require_staff)])

NOT_FOUND = "Бронь не найдена"


@router.get("", response_model=list[BookingOut])
def list_bookings(
    status: BookingStatus | None = None,
    location_id: int | None = None,
    client_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[BookingOut]:
    stmt = select(Booking).order_by(Booking.id.desc())
    if status is not None:
        stmt = stmt.where(Booking.status == status)
    if location_id is not None:
        stmt = stmt.where(Booking.location_id == location_id)
    if client_id is not None:
        stmt = stmt.where(Booking.client_id == client_id)
    return bookings_out(db, list(db.execute(stmt).scalars().all()))


@router.get("/overdue", response_model=list[BookingOut])
def list_overdue(db: Session = Depends(get_db)) -> list[BookingOut]:
    """Брони с товаром на руках и просроченной датой возврата."""
    return bookings_out(db, reservation.overdue_bookings(db, date.today()))


@router.post("", response_model=BookingOut, status_code=201)
def create_booking(
    body: BookingCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> BookingOut:
    booking = reservation.create_booking(
        db,
        client_id=body.client_id,
        location_id=body.location_id,
        start_date=body.start_date,
        expected_return_date=body.expected_return_date,
        items=[(i.product_id, i.quantity) for i in body.items],
        deposit=Decimal(str(body.deposit)) if body.deposit is not None else None,
        prepaid=Decimal(str(body.prepaid)),
        draft=body.draft,
        user_id=current.id,
    )
    db.commit()
    db.refresh(booking)
    return booking_out(db, booking)


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, db: Session = Depends(get_db)) -> BookingOut:
    return booking_out(db, get_or_404(db, Booking, booking_id, NOT_FOUND))


@router.post("/{booking_id}/confirm", response_model=BookingOut)
def confirm_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> BookingOut:
    """Подтвердить черновик: здесь проверяется и занимается остаток."""
    booking = get_or_404(db, Booking, booking_id, NOT_FOUND)
    reservation.confirm_booking(db, booking, user_id=current.id)
    db.commit()
    db.refresh(booking)
    return booking_out(db, booking)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> BookingOut:
    booking = get_or_404(db, Booking, booking_id, NOT_FOUND)
    reservation.cancel_booking(db, booking, user_id=current.id)
    db.commit()
    db.refresh(booking)
    return booking_out(db, booking)


@router.post("/{booking_id}/issue", response_model=BookingOut)
def issue_booking(
    booking_id: int,
    body: IssueIn,
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> BookingOut:
    booking = get_or_404(db, Booking, booking_id, NOT_FOUND)
    reservation.issue(
        db, booking, items=[(i.product_id, i.quantity) for i in body.items], user_id=current.id
    )
    db.commit()
    db.refresh(booking)
    return booking_out(db, booking)


@router.post("/{booking_id}/return", response_model=BookingOut)
def return_booking(
    booking_id: int,
    body: ReturnIn,
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> BookingOut:
    booking = get_or_404(db, Booking, booking_id, NOT_FOUND)
    reservation.return_items(
        db,
        booking,
        items=[(i.product_id, i.quantity, i.broken_qty) for i in body.items],
        user_id=current.id,
    )
    db.commit()
    db.refresh(booking)
    return booking_out(db, booking)


@router.get("/{booking_id}/settlement", response_model=BookingSettlement)
def booking_settlement(booking_id: int, db: Session = Depends(get_db)) -> BookingSettlement:
    """Итог по брони: аренда + бой − предоплата и что ещё на руках."""
    booking = get_or_404(db, Booking, booking_id, NOT_FOUND)
    s = settlement.settle(db, booking)
    return BookingSettlement(
        booking_id=s.booking_id,
        rental_total=float(s.rental_total),
        prepaid=float(s.prepaid),
        breakage_total=float(s.breakage_total),
        to_pay=float(s.to_pay),
        on_hands=[BookingItemOut.model_validate(bi) for bi in s.on_hands],
    )
