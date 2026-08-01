"""Сквозной поиск по системе: товары, клиенты, брони.

Питает строку поиска в шапке панели. Одним запросом — по всем сущностям,
чтобы сотрудник не гадал, в каком разделе искать.
"""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.booking import Booking, Client
from app.models.catalog import Product

LIMIT = 5

# Номера хранятся как ввели: «+996 555 123 456», «0555-123456». Чтобы поиск
# «555123» их находил, из телефона в SQL вычищаем всё, кроме цифр.
_PHONE_NOISE = [" ", "+", "-", "(", ")"]


def _digits(s: str) -> str:
    return "".join(c for c in s if c.isdigit())


def _phone_query_digits(s: str) -> str:
    """Цифры запроса. Ведущий 0 местного формата убираем: 0555… ≡ +996 555…"""
    d = _digits(s)
    return d[1:] if d.startswith("0") else d


def _phone_digits_col():
    col = Client.phone
    for ch in _PHONE_NOISE:
        col = func.replace(col, ch, "")
    return col


def _no_yo(col):
    """ё→е прямо в SQL: люди печатают «Петр», а в базе «Пётр»."""
    return func.replace(func.replace(col, "ё", "е"), "Ё", "Е")


def _name_like(col, q: str):
    """Поиск по имени: без учёта ё/е и регистра.

    Регистр отдаём ilike, а не func.lower(): у SQLite встроенный lower() трогает
    только латиницу, кириллицу оставляет как есть. На Postgres (наш прод) ilike
    справляется с кириллицей корректно.
    """
    return _no_yo(col).ilike(f"%{q.replace('ё', 'е').replace('Ё', 'Е')}%")


def search_all(db: Session, query: str, limit: int = LIMIT) -> dict:
    q = query.strip()
    if not q:
        return {"query": q, "products": [], "clients": [], "bookings": []}

    like = f"%{q}%"

    products = (
        db.execute(
            select(Product)
            .where(or_(_name_like(Product.name, q), Product.sku.ilike(like)))
            .order_by(Product.name)
            .limit(limit)
        )
        .scalars()
        .all()
    )

    # Телефон ищем по цифрам: «555123» и «0555 123 456» находят «+996 555 123 456».
    digits = _phone_query_digits(q)
    phone_cond = _phone_digits_col().like(f"%{digits}%") if digits else Client.phone.ilike(like)
    clients = (
        db.execute(
            select(Client)
            .where(or_(_name_like(Client.name, q), phone_cond))
            .order_by(Client.id.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )

    booking_conds = [_name_like(Client.name, q), phone_cond]
    # Номер брони: ловим и «170», и «№170». Длинные цифры — это телефон, а не id
    # (и int4 в сравнении переполнился бы).
    id_digits = _digits(q)
    if id_digits and len(id_digits) <= 9:
        booking_conds.append(Booking.id == int(id_digits))
    bookings = (
        db.execute(
            select(Booking)
            .join(Client, Booking.client_id == Client.id)
            .where(or_(*booking_conds))
            .order_by(Booking.id.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )

    return {
        "query": q,
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "type": p.type.value,
                "daily_price": float(p.daily_price),
            }
            for p in products
        ],
        "clients": [{"id": c.id, "name": c.name, "phone": c.phone} for c in clients],
        "bookings": [
            {
                "id": b.id,
                "client_name": b.client.name,
                "status": b.status.value,
                "start_date": b.start_date.isoformat(),
                "expected_return_date": b.expected_return_date.isoformat(),
                "rental_total": float(b.rental_total),
            }
            for b in bookings
        ],
    }
