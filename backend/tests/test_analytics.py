"""Движок аналитики: словарь, спека, безопасность и инварианты выручки."""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.analytics import engine, service
from app.analytics import spec as spec_mod
from app.analytics.engine import Period
from app.analytics.spec import QuerySpec, SpecError, WidgetSpec
from app.models.booking import Booking, BookingItem, Client
from app.models.catalog import Category, Product
from app.models.enums import BookingStatus, ClientSource, WriteOffReason
from app.models.inventory import Stock, WriteOff
from app.models.location import Location

TODAY = date(2026, 7, 10)
PERIOD = Period(date_from=TODAY - timedelta(days=6), date_to=TODAY)


@pytest.fixture
def world(db):
    """Две точки, товар, клиент и брони на разные дни — общая сцена для тестов."""
    loc1 = Location(name="Центр", address="", comment="")
    loc2 = Location(name="Восток", address="", comment="")
    cat = Category(name="Посуда")
    db.add_all([loc1, loc2, cat])
    db.flush()

    product = Product(
        name="Тарелка",
        category_id=cat.id,
        unit="шт",
        deposit_price=Decimal("100.00"),
        daily_price=Decimal("10.00"),
    )
    client = Client(name="Пётр", phone="+996 555 111 222", source=ClientSource.SITE)
    db.add_all([product, client])
    db.flush()

    db.add(
        Stock(
            product_id=product.id, location_id=loc1.id, total_qty=100, reserved_qty=10, issued_qty=5
        )
    )
    db.add(
        Stock(
            product_id=product.id, location_id=loc2.id, total_qty=20, reserved_qty=0, issued_qty=20
        )
    )

    def booking(day_offset: int, status: BookingStatus, rental: str, location: Location) -> Booking:
        start = TODAY - timedelta(days=day_offset)
        b = Booking(
            client_id=client.id,
            location_id=location.id,
            start_date=start,
            expected_return_date=start + timedelta(days=1),
            days=1,
            status=status,
            rental_total=Decimal(rental),
            prepaid=Decimal("0"),
        )
        db.add(b)
        db.flush()
        db.add(
            BookingItem(
                booking_id=b.id,
                product_id=product.id,
                quantity=5,
                daily_price=Decimal("10.00"),
                line_total=Decimal(rental),
            )
        )
        return b

    paid1 = booking(2, BookingStatus.CLOSED, "100.00", loc1)
    booking(2, BookingStatus.ISSUED, "50.00", loc1)
    booking(1, BookingStatus.CONFIRMED, "200.00", loc2)
    # Эти две в деньги попасть не должны ни при каких фильтрах.
    booking(1, BookingStatus.NEW, "999.00", loc1)  # черновик
    booking(1, BookingStatus.CANCELLED, "777.00", loc1)  # отменена

    # Бой по закрытой брони: 2 шт × 100 = 200 — это часть выручки.
    db.add(
        WriteOff(
            product_id=product.id,
            location_id=loc1.id,
            booking_id=paid1.id,
            quantity=2,
            reason=WriteOffReason.BREAKAGE,
            from_issued=True,
            amount=Decimal("200.00"),
            created_at=datetime.combine(TODAY - timedelta(days=2), datetime.min.time()),
        )
    )
    db.commit()
    return {"loc1": loc1, "loc2": loc2, "product": product, "client": client}


def _run(db, **query) -> list[dict]:
    q = QuerySpec(**query)
    return engine.run(db, q, period=PERIOD, **query.pop("_", {}))["rows"]


# --- инварианты денег ---------------------------------------------------------


def test_revenue_excludes_draft_and_cancelled(db, world):
    """Главный инвариант: черновик и отмена не деньги — и это нельзя обойти фильтром."""
    rows = engine.run(
        db, QuerySpec(dataset="bookings", measures=["revenue", "count"]), period=PERIOD
    )["rows"]
    # 100 + 50 + 200 аренды + 200 боя = 550. Черновик (999) и отмена (777) не в счёт.
    assert rows[0]["revenue"] == pytest.approx(550.0)
    # При этом счётчик броней видит все пять — он не про деньги.
    assert rows[0]["count"] == 5


def test_revenue_by_day_fills_empty_days(db, world):
    result = engine.run(
        db,
        QuerySpec(dataset="bookings", measures=["revenue"], dimensions=["day"]),
        period=PERIOD,
    )
    rows = result["rows"]
    assert len(rows) == PERIOD.days == 7  # дни без броней присутствуют нулями
    by_day = {r["day"]: r["revenue"] for r in rows}
    assert by_day[(TODAY - timedelta(days=2)).isoformat()] == pytest.approx(350.0)  # 100+50+200 бой
    assert by_day[(TODAY - timedelta(days=1)).isoformat()] == pytest.approx(200.0)
    assert by_day[TODAY.isoformat()] == 0


def test_breakage_join_does_not_double_rental(db, world):
    """Два списания по одной брони не должны задвоить аренду (грабли прямого join)."""
    booking = db.query(Booking).filter(Booking.status == BookingStatus.CLOSED).one()
    db.add(
        WriteOff(
            product_id=world["product"].id,
            location_id=world["loc1"].id,
            booking_id=booking.id,
            quantity=1,
            reason=WriteOffReason.LOSS,
            from_issued=True,
            amount=Decimal("100.00"),
        )
    )
    db.commit()
    rows = engine.run(
        db, QuerySpec(dataset="bookings", measures=["rental", "breakage"]), period=PERIOD
    )["rows"]
    assert rows[0]["rental"] == pytest.approx(350.0)  # 100 + 50 + 200, не задвоено
    assert rows[0]["breakage"] == pytest.approx(300.0)  # 200 + 100


def test_avg_check(db, world):
    rows = engine.run(db, QuerySpec(dataset="bookings", measures=["avg_check"]), period=PERIOD)[
        "rows"
    ]
    # Деньги округляются до копеек, поэтому сверяем с допуском в 1 копейку.
    assert rows[0]["avg_check"] == pytest.approx(550.0 / 3, abs=0.01)


# --- фильтры и разрезы --------------------------------------------------------


def test_location_filter_cuts_data(db, world):
    rows = engine.run(
        db,
        QuerySpec(dataset="bookings", measures=["revenue"]),
        period=PERIOD,
        location_id=world["loc2"].id,
    )["rows"]
    assert rows[0]["revenue"] == pytest.approx(200.0)


def test_status_filter_by_string_value(db, world):
    rows = engine.run(
        db,
        QuerySpec(
            dataset="bookings",
            measures=["count"],
            filters=[{"field": "status", "op": "in", "value": ["issued", "closed"]}],
        ),
        period=PERIOD,
    )["rows"]
    assert rows[0]["count"] == 2


def test_dimension_labels_are_human(db, world):
    rows = engine.run(
        db,
        QuerySpec(dataset="bookings", measures=["count"], dimensions=["status"]),
        period=PERIOD,
    )["rows"]
    labels = {r["status"]: r["status_label"] for r in rows}
    assert labels["new"] == "Черновик"
    assert labels["cancelled"] == "Отменена"


def test_period_does_not_apply_to_stock(db, world):
    """Остатки — снимок «сейчас»: период на них не влияет, но точка влияет."""
    rows = engine.run(
        db,
        QuerySpec(
            dataset="stock", measures=["free", "reserved", "issued"], dimensions=["category"]
        ),
        period=Period(date_from=date(2020, 1, 1), date_to=date(2020, 1, 2)),
    )["rows"]
    assert rows[0]["free"] == 85  # (100-10-5) + (20-0-20)
    assert rows[0]["reserved"] == 10


def test_movements_count_issues_and_returns_separately(db, world, auth_headers, client):
    """Выдача и возврат с одинаковым id не должны склеиться в COUNT(DISTINCT)."""
    result = engine.run(
        db,
        QuerySpec(dataset="movements", measures=["ops", "qty"], dimensions=["kind"]),
        period=PERIOD,
    )
    assert result["rows"] == []  # операций не было — набор просто пуст, а не падает


def test_top_products_ordered_by_revenue(db, world):
    rows = engine.run(
        db,
        QuerySpec(
            dataset="booking_items",
            measures=["amount"],
            dimensions=["product"],
            order_by="-amount",
            limit=10,
        ),
        period=PERIOD,
    )["rows"]
    assert rows[0]["product_label"] == "Тарелка"
    assert rows[0]["amount"] == pytest.approx(350.0)  # только оплачиваемые брони


# --- безопасность спеки -------------------------------------------------------


def test_unknown_dataset_rejected():
    with pytest.raises(SpecError, match="Нет набора данных"):
        spec_mod.validate(
            WidgetSpec(
                title="x",
                chart="table",
                query=QuerySpec(dataset="users", measures=["count"], dimensions=["day"]),
            )
        )


def test_unknown_measure_rejected():
    with pytest.raises(SpecError, match="нет метрики"):
        spec_mod.validate(
            WidgetSpec(
                title="x",
                chart="kpi",
                query=QuerySpec(dataset="bookings", measures=["password_hash"]),
            )
        )


def test_filter_on_unknown_field_rejected():
    with pytest.raises(SpecError, match="Фильтровать можно только по разрезам"):
        spec_mod.validate(
            WidgetSpec(
                title="x",
                chart="kpi",
                query=QuerySpec(
                    dataset="bookings",
                    measures=["revenue"],
                    filters=[{"field": "client_phone", "op": "eq", "value": "1"}],
                ),
            )
        )


def test_limit_capped():
    with pytest.raises(ValueError):
        QuerySpec(dataset="bookings", measures=["count"], limit=10_000)


def test_donut_by_day_rejected():
    with pytest.raises(SpecError, match="Кольцо по дням"):
        spec_mod.validate(
            WidgetSpec(
                title="x",
                chart="donut",
                query=QuerySpec(dataset="bookings", measures=["revenue"], dimensions=["day"]),
            )
        )


def test_all_builtin_widgets_are_valid_and_runnable(db, world):
    """Встроенные блоки обязаны и валидироваться, и реально исполняться."""
    from app.analytics.builtin import BUILTIN_WIDGETS

    for item in BUILTIN_WIDGETS:
        body = spec_mod.validate(WidgetSpec(**item["spec"]))
        engine.run(db, body.query, period=PERIOD, location_id=None)


# --- сборка дашборда ----------------------------------------------------------


def test_render_dashboard(db, world):
    service.sync_builtin_widgets(db)
    result = service.render(db, period=PERIOD)
    assert result["period"]["days"] == 7
    keys = {w["key"] for w in result["widgets"]}
    assert "kpi_main" in keys and "top_products" in keys
    assert all(w["error"] is None for w in result["widgets"])

    kpi = next(w for w in result["widgets"] if w["key"] == "kpi_main")
    assert kpi["data"]["rows"][0]["revenue"] == pytest.approx(550.0)
    assert "previous" in kpi  # сравнение с прошлым периодом посчитано


def test_sync_builtin_is_idempotent_and_keeps_admin_choices(db, world):
    service.sync_builtin_widgets(db)
    widgets = service.list_widgets(db)
    first = next(w for w in widgets if w.key == "kpi_main")
    service.update_widget(db, first, is_visible=False, position=999)

    service.sync_builtin_widgets(db)
    again = service.list_widgets(db)
    assert len(again) == len(widgets)  # дублей не наплодило
    kept = next(w for w in again if w.key == "kpi_main")
    assert kept.is_visible is False and kept.position == 999  # выбор админа не затёрт
