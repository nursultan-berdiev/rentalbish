"""Складские read-запросы для ИИ-ассистента и MCP.

Единый слой доступа к состоянию склада на естественном языке: что доступно,
что на руках, что просрочено, что вернулось, долги клиента. Используется и
MCP-сервером (внешние агенты), и in-app чат-эндпоинтом. Считает теми же
сервисами, что и API, — чтобы ассистент и панель не расходились в цифрах.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking, Client, Return
from app.models.catalog import Product
from app.models.enums import BookingStatus
from app.services import availability, inventory, reports, settlement
from app.services.reservation import bookings_on_hands, on_hands_items


def search_products(db: Session, query: str = "", limit: int = 20) -> list[dict]:
    stmt = select(Product).order_by(Product.name).limit(limit)
    if query:
        stmt = stmt.where(Product.name.ilike(f"%{query}%"))
    return [
        {
            "id": p.id,
            "name": p.name,
            "type": p.type.value,
            "daily_price": float(p.daily_price),
            "deposit_price": float(p.deposit_price),
        }
        for p in db.execute(stmt).scalars().all()
    ]


def get_stock(
    db: Session, product_id: int | None = None, location_id: int | None = None
) -> list[dict]:
    """Остатки по точкам: всего/забронировано/выдано/доступно."""
    return inventory.stock_summary(db, product_id=product_id, location_id=location_id)


def get_available(db: Session, product_id: int, location_id: int) -> dict:
    product = db.get(Product, product_id)
    if product is None:
        return {"error": f"Товар id={product_id} не найден"}
    return {
        "product_id": product_id,
        "product_name": product.name,
        "location_id": location_id,
        "available": availability.available(db, product, location_id),
    }


def get_on_hands(db: Session) -> list[dict]:
    """Что сейчас у клиентов (выдано и не возвращено)."""
    return reports.on_hands(db)


def get_overdue(db: Session) -> list[dict]:
    """Просроченные возвраты с контактами клиента."""
    today = date.today()
    return [
        {
            "booking_id": b.id,
            "client_name": b.client.name,
            "client_phone": b.client.phone,
            "expected_return_date": b.expected_return_date.isoformat(),
            "days_overdue": (today - b.expected_return_date).days,
            "items": [
                {"product_name": bi.product.name, "qty": bi.issued_qty - bi.returned_qty}
                for bi in on_hands_items(b)
            ],
        }
        for b in bookings_on_hands(db, overdue_as_of=today)
    ]


def get_returns(db: Session, days: int = 7) -> list[dict]:
    """Что вернулось за последние N дней (целые и бой)."""
    since = datetime.combine(date.today() - timedelta(days=days), time.min)
    rows = (
        db.execute(
            select(Return).where(Return.returned_at >= since).order_by(Return.returned_at.desc())
        )
        .scalars()
        .all()
    )
    return [
        {
            "return_id": r.id,
            "booking_id": r.booking_id,
            "returned_at": r.returned_at.isoformat(),
            "items": [
                {"product_name": i.product.name, "good": i.quantity, "broken": i.broken_qty}
                for i in r.items
            ],
        }
        for r in rows
    ]


def get_client_debt(db: Session, phone: str) -> dict:
    """Долг клиента по телефону: аренда + бой − предоплата по всем не отменённым броням."""
    bookings = (
        db.execute(
            select(Booking)
            .join(Client, Booking.client_id == Client.id)
            .where(Client.phone == phone, Booking.status != BookingStatus.CANCELLED)
        )
        .scalars()
        .all()
    )
    if not bookings:
        return {"phone": phone, "found": False, "debt": 0.0, "bookings": []}

    settlements = [settlement.settle(db, b) for b in bookings]
    total_debt = sum((s.to_pay for s in settlements), Decimal("0"))
    return {
        "phone": phone,
        "found": True,
        "client_name": bookings[0].client.name,
        "debt": float(total_debt),
        "bookings": [
            {
                "booking_id": s.booking_id,
                "status": b.status.value,
                "rental_total": float(s.rental_total),
                "breakage": float(s.breakage_total),
                "prepaid": float(s.prepaid),
                "to_pay": float(s.to_pay),
            }
            for b, s in zip(bookings, settlements, strict=True)
        ],
    }
