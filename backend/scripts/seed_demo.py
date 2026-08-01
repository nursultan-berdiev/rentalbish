"""Демо-данные для dev-стенда: точки, каталог, остатки, брони за последний месяц.

Нужен, чтобы дашборд «Обзор» было на чём смотреть, и чтобы стенд можно было поднять
с нуля одной командой. Только для ENV=dev: на непустой базе ничего не делает.

    docker compose exec api python scripts/seed_demo.py
"""

import random
import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.booking import Booking, BookingItem, Client, Issue, IssueItem, Return, ReturnItem
from app.models.catalog import Category, Product
from app.models.enums import (
    BookingStatus,
    ClientSource,
    ProductType,
    WebOrderStatus,
    WriteOffReason,
)
from app.models.inventory import Stock, Supply, WriteOff
from app.models.location import Location
from app.models.weborder import WebOrder, WebOrderItem

TODAY = date.today()
RND = random.Random(20260712)  # фиксируем зерно: стенд воспроизводим

CATEGORIES = ["Посуда", "Приборы", "Текстиль", "Мебель"]

# name, category, unit, залоговая, суточная, всего на складе
CATALOG = [
    ("Тарелка обеденная", "Посуда", "шт", "150.00", "10.00", 400),
    ("Тарелка десертная", "Посуда", "шт", "120.00", "8.00", 300),
    ("Бокал для вина", "Посуда", "шт", "200.00", "15.00", 240),
    ("Чашка чайная", "Посуда", "шт", "130.00", "9.00", 200),
    ("Вилка столовая", "Приборы", "шт", "80.00", "5.00", 500),
    ("Нож столовый", "Приборы", "шт", "90.00", "5.00", 500),
    ("Скатерть белая", "Текстиль", "шт", "900.00", "60.00", 60),
    ("Салфетка тканевая", "Текстиль", "шт", "70.00", "6.00", 400),
    ("Стул банкетный", "Мебель", "шт", "1500.00", "90.00", 120),
    ("Стол круглый", "Мебель", "шт", "4000.00", "250.00", 30),
]

CLIENTS = [
    ("Пётр Иванов", "+996 555 111 222", ClientSource.SITE),
    ("Айгуль Осмонова", "+996 700 333 444", ClientSource.CALL),
    ("Кафе «Ак-Бата»", "+996 312 900 100", ClientSource.MESSENGER),
    ("Марина Ким", "+996 777 555 666", ClientSource.SITE),
    ("Ресторан «Наристе»", "+996 550 246 810", ClientSource.CALL),
    ("Данияр Сыдыков", "+996 999 121 314", ClientSource.OTHER),
]


def main() -> int:
    with SessionLocal() as db:
        if db.execute(select(Booking.id).limit(1)).first():
            print("В базе уже есть брони — демо-данные не нужны, выходим.")
            return 0

        locations = [
            Location(name="Центральный склад", address="Бишкек, ул. Киевская 100", comment=""),
            Location(name="Филиал Восток", address="Бишкек, ул. Айтматова 20", comment=""),
        ]
        cats = {name: Category(name=name) for name in CATEGORIES}
        db.add_all(locations + list(cats.values()))
        db.flush()

        products = []
        for name, cat, unit, deposit, daily, total in CATALOG:
            p = Product(
                name=name,
                category_id=cats[cat].id,
                type=ProductType.ITEM,
                unit=unit,
                deposit_price=Decimal(deposit),
                daily_price=Decimal(daily),
                show_on_site=True,
            )
            db.add(p)
            db.flush()
            products.append(p)
            # Основной запас на центральном складе, треть — в филиале.
            for loc, share in ((locations[0], 1.0), (locations[1], 0.35)):
                qty = int(total * share)
                db.add(Stock(product_id=p.id, location_id=loc.id, total_qty=qty))
                db.add(
                    Supply(
                        product_id=p.id, location_id=loc.id, quantity=qty, comment="Стартовый завоз"
                    )
                )

        # Комплект: сервировка на 6 персон.
        from app.models.catalog import SetItem

        set_product = Product(
            name="Сервировка на 6 персон",
            category_id=cats["Посуда"].id,
            type=ProductType.SET,
            unit="компл",
            deposit_price=Decimal("1500.00"),
            daily_price=Decimal("90.00"),
            show_on_site=True,
        )
        db.add(set_product)
        db.flush()
        for prod, per_set in (
            (products[0], 6),
            (products[2], 6),
            (products[4], 6),
            (products[5], 6),
        ):
            db.add(SetItem(set_id=set_product.id, component_id=prod.id, quantity=per_set))

        clients = [Client(name=n, phone=p, source=s) for n, p, s in CLIENTS]
        db.add_all(clients)
        db.flush()

        _seed_bookings(db, clients, products, locations)
        _seed_weborders(db, clients, products)
        db.commit()

        print(
            f"Готово: {len(products) + 1} товаров, {len(clients)} клиентов, "
            f"{db.execute(select(Booking.id)).all().__len__()} броней."
        )
    return 0


def _seed_bookings(db, clients, products, locations) -> None:
    """Брони за последние 45 дней — с выдачами, возвратами и боем."""
    for day_back in range(45, -1, -1):
        start = TODAY - timedelta(days=day_back)
        # В выходные заказов больше — так график интереснее и честнее.
        weekend = start.weekday() >= 5
        count = RND.randint(1, 3) + (1 if weekend else 0)
        if RND.random() < 0.15:
            count = 0  # бывают и пустые дни

        for _ in range(count):
            client = RND.choice(clients)
            loc = RND.choice(locations)
            days = RND.randint(1, 3)
            status = _status_for(day_back)

            booking = Booking(
                client_id=client.id,
                location_id=loc.id,
                start_date=start,
                expected_return_date=start + timedelta(days=days),
                days=days,
                status=status,
                rental_total=Decimal("0"),
                prepaid=Decimal("0"),
            )
            db.add(booking)
            db.flush()

            total = Decimal("0")
            picked = RND.sample(products, RND.randint(1, 3))
            items: dict[int, BookingItem] = {}
            for product in picked:
                qty = RND.choice((10, 20, 30, 50))
                line = product.daily_price * qty * days
                total += line
                item = BookingItem(
                    booking_id=booking.id,
                    product_id=product.id,
                    quantity=qty,
                    issued_qty=qty if status in _ISSUED_ONWARD else 0,
                    returned_qty=qty if status == BookingStatus.CLOSED else 0,
                    daily_price=product.daily_price,
                    line_total=line,
                )
                db.add(item)
                items[product.id] = item
            booking.rental_total = total
            booking.prepaid = (
                (total / 2).quantize(Decimal("0.01")) if RND.random() < 0.6 else Decimal("0")
            )

            _apply_stock(db, booking, items, status)
            _apply_events(db, booking, items, status, start, days)


_ISSUED_ONWARD = (BookingStatus.ISSUED, BookingStatus.RETURNED, BookingStatus.CLOSED)


def _status_for(day_back: int) -> BookingStatus:
    """Старые брони закрыты, свежие — в работе. Плюс немного черновиков и отмен."""
    roll = RND.random()
    if day_back > 7:
        if roll < 0.06:
            return BookingStatus.CANCELLED
        return BookingStatus.CLOSED
    if day_back > 3:
        if roll < 0.5:
            return BookingStatus.CLOSED
        return BookingStatus.ISSUED
    if roll < 0.15:
        return BookingStatus.NEW  # черновик
    if roll < 0.3:
        return BookingStatus.CANCELLED
    if roll < 0.7:
        return BookingStatus.CONFIRMED
    return BookingStatus.ISSUED


def _apply_stock(db, booking, items, status) -> None:
    """Держим инвариант остатка: подтверждённое — в резерв, выданное — в issued."""
    if status in (BookingStatus.NEW, BookingStatus.CANCELLED, BookingStatus.CLOSED):
        return
    for product_id, item in items.items():
        stock = db.execute(
            select(Stock).where(
                Stock.product_id == product_id, Stock.location_id == booking.location_id
            )
        ).scalar_one()
        if status == BookingStatus.CONFIRMED:
            stock.reserved_qty += item.quantity
        else:  # ISSUED / RETURNED
            stock.issued_qty += item.quantity


def _apply_events(db, booking, items, status, start: date, days: int) -> None:
    if status not in _ISSUED_ONWARD:
        return
    issue = Issue(booking_id=booking.id, issued_at=datetime.combine(start, time(10, 0)))
    db.add(issue)
    db.flush()
    for product_id, item in items.items():
        db.add(IssueItem(issue_id=issue.id, product_id=product_id, quantity=item.quantity))

    if status != BookingStatus.CLOSED:
        return

    back = start + timedelta(days=days)
    ret = Return(booking_id=booking.id, returned_at=datetime.combine(back, time(18, 0)))
    db.add(ret)
    db.flush()
    for product_id, item in items.items():
        product = db.get(Product, product_id)
        # Иногда часть посуды бьётся — это и деньги, и списание со склада.
        broken = RND.randint(1, 3) if RND.random() < 0.25 else 0
        broken = min(broken, item.quantity)
        db.add(
            ReturnItem(
                return_id=ret.id,
                product_id=product_id,
                quantity=item.quantity - broken,
                broken_qty=broken,
            )
        )
        if broken:
            stock = db.execute(
                select(Stock).where(
                    Stock.product_id == product_id, Stock.location_id == booking.location_id
                )
            ).scalar_one()
            stock.total_qty -= broken
            db.add(
                WriteOff(
                    product_id=product_id,
                    location_id=booking.location_id,
                    booking_id=booking.id,
                    quantity=broken,
                    reason=RND.choice((WriteOffReason.BREAKAGE, WriteOffReason.LOSS)),
                    from_issued=True,
                    amount=product.deposit_price * broken,
                    created_at=datetime.combine(back, time(18, 0)),
                )
            )
        item.returned_qty = item.quantity - broken


def _seed_weborders(db, clients, products) -> None:
    statuses = [
        WebOrderStatus.NEW,
        WebOrderStatus.NEW,
        WebOrderStatus.IN_PROGRESS,
        WebOrderStatus.CONVERTED,
        WebOrderStatus.CONVERTED,
        WebOrderStatus.REJECTED,
    ]
    for i, status in enumerate(statuses):
        client = clients[i % len(clients)]
        order = WebOrder(
            name=client.name,
            phone=client.phone,
            comment="Заявка с витрины",
            status=status,
            created_at=datetime.combine(TODAY - timedelta(days=i * 3), time(12, 0)),
        )
        db.add(order)
        db.flush()
        db.add(WebOrderItem(order_id=order.id, product_id=RND.choice(products).id, quantity=20))


if __name__ == "__main__":
    sys.exit(main())
