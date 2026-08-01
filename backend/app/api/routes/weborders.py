"""Заявки с сайта (сторона сотрудников): просмотр, статус, конвертация в бронь."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_or_404, require_staff
from app.api.serializers import booking_out
from app.db.session import get_db
from app.models.booking import Client
from app.models.enums import ClientSource, WebOrderStatus
from app.models.user import User
from app.models.weborder import WebOrder
from app.schemas.booking import BookingOut
from app.schemas.weborder import WebOrderConvert, WebOrderOut, WebOrderStatusUpdate
from app.services import reservation

router = APIRouter(prefix="/weborders", tags=["weborders"], dependencies=[Depends(require_staff)])

NOT_FOUND = "Заявка не найдена"


@router.get("", response_model=list[WebOrderOut])
def list_web_orders(
    status: WebOrderStatus | None = None, db: Session = Depends(get_db)
) -> list[WebOrder]:
    stmt = select(WebOrder).order_by(WebOrder.id.desc())
    if status is not None:
        stmt = stmt.where(WebOrder.status == status)
    return list(db.execute(stmt).scalars().all())


@router.get("/{order_id}", response_model=WebOrderOut)
def get_web_order(order_id: int, db: Session = Depends(get_db)) -> WebOrder:
    return get_or_404(db, WebOrder, order_id, NOT_FOUND)


@router.patch("/{order_id}/status", response_model=WebOrderOut)
def update_status(
    order_id: int, body: WebOrderStatusUpdate, db: Session = Depends(get_db)
) -> WebOrder:
    order = get_or_404(db, WebOrder, order_id, NOT_FOUND)
    order.status = body.status
    db.commit()
    db.refresh(order)
    return order


@router.post("/{order_id}/convert", response_model=BookingOut, status_code=201)
def convert_to_booking(
    order_id: int,
    body: WebOrderConvert,
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> object:
    """Найти/создать клиента по телефону и оформить бронь из позиций заявки."""
    order = get_or_404(db, WebOrder, order_id, NOT_FOUND)
    if order.status == WebOrderStatus.CONVERTED:
        raise HTTPException(status_code=409, detail="Заявка уже сконвертирована")
    if not order.items:
        raise HTTPException(status_code=400, detail="В заявке нет позиций")

    client = (
        db.execute(select(Client).where(Client.phone == order.phone).order_by(Client.id))
        .scalars()
        .first()
    )
    if client is None:
        client = Client(name=order.name, phone=order.phone, source=ClientSource.SITE)
        db.add(client)
        db.flush()

    booking = reservation.create_booking(
        db,
        client_id=client.id,
        location_id=body.location_id,
        start_date=body.start_date,
        expected_return_date=body.expected_return_date,
        items=[(i.product_id, i.quantity) for i in order.items],
        deposit=Decimal(str(body.deposit)) if body.deposit is not None else None,
        prepaid=Decimal(str(body.prepaid)),
        user_id=current.id,
    )
    order.status = WebOrderStatus.CONVERTED
    order.booking_id = booking.id
    db.commit()
    db.refresh(booking)
    return booking_out(db, booking)
