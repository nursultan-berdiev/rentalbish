"""Сборка дашборда и управление виджетами."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics import engine
from app.analytics import spec as spec_mod
from app.analytics.builtin import BUILTIN_WIDGETS
from app.analytics.engine import Period
from app.analytics.spec import SpecError, WidgetSpec
from app.models.booking import Booking
from app.models.dashboard import DashboardWidget
from app.models.enums import BookingStatus, WebOrderStatus
from app.models.weborder import WebOrder
from app.services import audit, inventory
from app.services.errors import ConflictError, NotFoundError
from app.services.reservation import bookings_on_hands, on_hands_items, overdue_bookings


def sync_builtin_widgets(db: Session) -> None:
    """Привести встроенные блоки в таблице к тому, что объявлено в коде.

    Идемпотентно и не затирает то, что настроил админ: позиция и видимость
    остаются его, обновляются только заголовок/тип/спека.
    """
    existing = {
        w.key: w
        for w in db.execute(select(DashboardWidget).where(DashboardWidget.key.is_not(None)))
        .scalars()
        .all()
    }
    for item in BUILTIN_WIDGETS:
        body = spec_mod.validate(WidgetSpec(**item["spec"]))
        widget = existing.get(item["key"])
        if widget is None:
            db.add(
                DashboardWidget(
                    key=item["key"],
                    title=body.title,
                    chart=body.chart,
                    spec=body.model_dump(),
                    position=item["position"],
                    is_visible=True,
                    is_builtin=True,
                )
            )
        else:
            widget.title = body.title
            widget.chart = body.chart
            widget.spec = body.model_dump()
            widget.is_builtin = True
    db.commit()


def list_widgets(db: Session, *, only_visible: bool = False) -> list[DashboardWidget]:
    stmt = select(DashboardWidget).order_by(DashboardWidget.position, DashboardWidget.id)
    if only_visible:
        stmt = stmt.where(DashboardWidget.is_visible.is_(True))
    return list(db.execute(stmt).scalars().all())


def get_widget(db: Session, widget_id: int) -> DashboardWidget:
    widget = db.get(DashboardWidget, widget_id)
    if widget is None:
        raise NotFoundError(f"Блок id={widget_id} не найден")
    return widget


def create_widget(db: Session, body: WidgetSpec, *, user_id: int | None) -> DashboardWidget:
    body = spec_mod.validate(body)
    # Проверяем, что спека вообще исполняется, — иначе битый блок сломает весь дашборд.
    engine.run(db, body.query, period=_probe_period(), location_id=None)

    last = db.execute(
        select(DashboardWidget.position).order_by(DashboardWidget.position.desc()).limit(1)
    ).scalar()
    widget = DashboardWidget(
        key=None,
        title=body.title,
        chart=body.chart,
        spec=body.model_dump(),
        position=(last or 0) + 10,
        is_visible=True,
        is_builtin=False,
        created_by_id=user_id,
    )
    db.add(widget)
    db.flush()
    audit.record(
        db,
        user_id=user_id,
        action="create",
        entity="dashboard_widget",
        entity_id=widget.id,
        new={"title": widget.title, "chart": widget.chart, "spec": widget.spec},
    )
    db.commit()
    db.refresh(widget)
    return widget


def update_widget(
    db: Session,
    widget: DashboardWidget,
    *,
    title: str | None = None,
    position: int | None = None,
    is_visible: bool | None = None,
    user_id: int | None = None,
) -> DashboardWidget:
    old = {"title": widget.title, "position": widget.position, "is_visible": widget.is_visible}
    if title is not None:
        widget.title = title
    if position is not None:
        widget.position = position
    if is_visible is not None:
        widget.is_visible = is_visible
    audit.record(
        db,
        user_id=user_id,
        action="update",
        entity="dashboard_widget",
        entity_id=widget.id,
        old=old,
        new={"title": widget.title, "position": widget.position, "is_visible": widget.is_visible},
    )
    db.commit()
    db.refresh(widget)
    return widget


def delete_widget(db: Session, widget: DashboardWidget, *, user_id: int | None = None) -> None:
    if widget.is_builtin:
        raise ConflictError("Встроенный блок нельзя удалить — его можно скрыть")
    audit.record(
        db,
        user_id=user_id,
        action="delete",
        entity="dashboard_widget",
        entity_id=widget.id,
        old={"title": widget.title, "chart": widget.chart, "spec": widget.spec},
    )
    db.delete(widget)
    db.commit()


def _probe_period() -> Period:
    today = date.today()
    return Period(date_from=today, date_to=today)


def render(
    db: Session,
    *,
    period: Period,
    location_id: int | None = None,
) -> dict:
    """Собрать дашборд: снимок «сейчас» + все видимые блоки с данными."""
    widgets = []
    for w in list_widgets(db, only_visible=True):
        try:
            body = WidgetSpec(**w.spec)
            spec_mod.validate(body)
            data = engine.run(db, body.query, period=period, location_id=location_id)
            payload = {
                "id": w.id,
                "key": w.key,
                "title": w.title,
                "chart": w.chart,
                "span": body.span,
                "is_builtin": w.is_builtin,
                "series": [s.model_dump() for s in spec_mod.default_series(body)],
                "data": data,
                "error": None,
            }
            if body.compare:
                prev = engine.run(db, body.query, period=period.previous(), location_id=location_id)
                payload["previous"] = engine.totals(prev)
        except (SpecError, ValueError) as exc:
            # Битый блок не должен ронять весь экран: показываем его с ошибкой.
            payload = {
                "id": w.id,
                "key": w.key,
                "title": w.title,
                "chart": w.chart,
                "span": 1,
                "is_builtin": w.is_builtin,
                "series": [],
                "data": None,
                "error": str(exc),
            }
        widgets.append(payload)

    return {
        "period": {
            "date_from": period.date_from.isoformat(),
            "date_to": period.date_to.isoformat(),
            "days": period.days,
        },
        "now": snapshot_now(db, location_id=location_id),
        "widgets": widgets,
    }


def snapshot_now(db: Session, *, location_id: int | None = None) -> dict:
    """Задачи дня. Это состояние «сейчас», а не аналитика за период, — поэтому отдельно."""
    today = date.today()
    overdue = overdue_bookings(db, as_of=today)
    on_hands = bookings_on_hands(db)
    if location_id is not None:
        overdue = [b for b in overdue if b.location_id == location_id]
        on_hands = [b for b in on_hands if b.location_id == location_id]

    on_hands_qty = sum(
        bi.issued_qty - bi.returned_qty for b in on_hands for bi in on_hands_items(b)
    )
    stock = inventory.stock_summary(db, location_id=location_id)
    new_orders = db.execute(select(WebOrder.id).where(WebOrder.status == WebOrderStatus.NEW)).all()

    active_bookings = db.execute(
        select(Booking.id).where(
            Booking.status.in_(
                (BookingStatus.CONFIRMED, BookingStatus.ISSUED, BookingStatus.RETURNED)
            ),
            *([Booking.location_id == location_id] if location_id is not None else []),
        )
    ).all()

    return {
        "overdue": len(overdue),
        "on_hands_bookings": len(on_hands),
        "on_hands_qty": int(on_hands_qty),
        "active_bookings": len(active_bookings),
        "new_orders": len(new_orders),
        "zero_stock": sum(1 for s in stock if s["available"] <= 0),
    }
