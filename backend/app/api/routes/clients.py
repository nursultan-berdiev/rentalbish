"""Клиенты (без личного кабинета, идентификация по телефону)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_or_404, require_staff
from app.api.serializers import bookings_out
from app.db.session import get_db
from app.models.booking import Booking, Client
from app.models.enums import BookingStatus
from app.schemas.booking import ClientCreate, ClientOut, ClientUpdate
from app.services import settlement
from app.services.reservation import on_hands_items

router = APIRouter(prefix="/clients", tags=["clients"], dependencies=[Depends(require_staff)])

NOT_FOUND = "Клиент не найден"


@router.get("", response_model=list[ClientOut])
def list_clients(q: str | None = None, db: Session = Depends(get_db)) -> list[Client]:
    stmt = select(Client).order_by(Client.id.desc())
    if q:
        stmt = stmt.where(Client.name.ilike(f"%{q}%") | Client.phone.ilike(f"%{q}%"))
    return list(db.execute(stmt).scalars().all())


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(body: ClientCreate, db: Session = Depends(get_db)) -> Client:
    client = Client(**body.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db)) -> Client:
    return get_or_404(db, Client, client_id, NOT_FOUND)


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(client_id: int, body: ClientUpdate, db: Session = Depends(get_db)) -> Client:
    client = get_or_404(db, Client, client_id, NOT_FOUND)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


@router.get("/{client_id}/summary")
def client_summary(client_id: int, db: Session = Depends(get_db)) -> dict:
    """Карточка клиента: его брони, что сейчас на руках и общий долг."""
    client = get_or_404(db, Client, client_id, NOT_FOUND)
    bookings = list(
        db.execute(
            select(Booking).where(Booking.client_id == client_id).order_by(Booking.id.desc())
        )
        .scalars()
        .all()
    )
    active = [b for b in bookings if b.status != BookingStatus.CANCELLED]
    debt = sum(settlement.settle(db, b).to_pay for b in active)

    on_hands = [
        {
            "booking_id": b.id,
            "product_id": bi.product_id,
            "product_name": bi.product.name,
            "qty": bi.issued_qty - bi.returned_qty,
        }
        for b in bookings
        for bi in on_hands_items(b)
    ]

    return {
        "client": ClientOut.model_validate(client).model_dump(),
        "bookings_count": len(bookings),
        "debt": float(debt),
        "on_hands": on_hands,
        "bookings": [b.model_dump() for b in bookings_out(db, bookings)],
    }
