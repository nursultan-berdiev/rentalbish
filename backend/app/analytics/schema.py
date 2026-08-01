"""Семантический слой аналитики — словарь того, что вообще можно спросить.

Это белый список: имя → SQL-выражение. Всё, чего здесь нет, посчитать нельзя,
поэтому ИИ-ассистент, собирающий виджеты, физически не может ни написать SQL,
ни дотянуться до таблиц, которых мы ему не показали.

Ключевое решение про деньги: «оплачиваемость» брони зашита не в фильтр, а в саму
метрику (CASE WHEN status IN billable). Забыть фильтр и получить выручку с учётом
черновиков и отменённых — невозможно, как бы ни ошибся тот, кто составляет спеку.
"""

from collections.abc import Callable
from dataclasses import dataclass, field

from sqlalchemy import Integer, String, case, func, literal, select, union_all
from sqlalchemy.orm import aliased
from sqlalchemy.sql import Select
from sqlalchemy.sql.elements import ColumnElement

from app.models.booking import (
    Booking,
    BookingItem,
    Client,
    Issue,
    IssueItem,
    Return,
    ReturnItem,
)
from app.models.catalog import Category, Product
from app.models.enums import BookingStatus, ClientSource, WebOrderStatus, WriteOffReason
from app.models.inventory import Stock, WriteOff
from app.models.location import Location
from app.models.weborder import WebOrder

# Брони, которые приносят деньги: черновик (new) и отменённая в выручку не идут.
BILLABLE_STATUSES = (
    BookingStatus.CONFIRMED,
    BookingStatus.ISSUED,
    BookingStatus.RETURNED,
    BookingStatus.CLOSED,
)


@dataclass(frozen=True)
class Dimension:
    """Разрез: по чему группируем."""

    key: str
    label: str
    expr: ColumnElement  # значение (идёт в GROUP BY)
    kind: str = "category"  # "category" | "date"
    label_expr: ColumnElement | None = None  # человекочитаемая подпись (тоже в GROUP BY)
    value_labels: dict[str, str] | None = None  # словарь подписей для перечислений
    coerce: Callable[[object], object] | None = None  # приведение значений фильтра


@dataclass(frozen=True)
class Measure:
    """Метрика: что считаем."""

    key: str
    label: str
    expr: ColumnElement  # агрегат
    format: str = "int"  # "int" | "money"


@dataclass(frozen=True)
class Dataset:
    key: str
    label: str
    description: str
    base: Callable[[], Select]
    dimensions: dict[str, Dimension]
    measures: dict[str, Measure]
    period_col: ColumnElement | None = None
    period_kind: str = "date"  # "date" | "datetime" — как фильтровать период
    period_label: str = ""
    location_col: ColumnElement | None = None
    notes: list[str] = field(default_factory=list)


STATUS_LABELS = {
    "new": "Черновик",
    "confirmed": "Подтверждена",
    "issued": "Выдана",
    "returned": "Возвращена",
    "closed": "Закрыта",
    "cancelled": "Отменена",
}
REASON_LABELS = {"breakage": "Бой", "loss": "Утеря", "wear": "Износ"}
SOURCE_LABELS = {
    "site": "Сайт",
    "call": "Звонок",
    "messenger": "Мессенджер",
    "other": "Другое",
}
WEBORDER_STATUS_LABELS = {
    "new": "Новая",
    "in_progress": "В работе",
    "converted": "Переведена в бронь",
    "rejected": "Отклонена",
}


def _enum_coerce(enum_cls):
    """Строку из спеки превращаем в член перечисления — иначе SQL получит мусор."""

    def _c(value):
        if isinstance(value, enum_cls):
            return value
        return enum_cls(str(value))

    return _c


# --- bookings -----------------------------------------------------------------
#
# Бой брони подтягиваем ПОДЗАПРОСОМ, а не join'ом к write_offs напрямую: у брони
# может быть несколько списаний, и прямой join размножил бы строки, задвоив аренду.

_wo_by_booking = (
    select(
        WriteOff.booking_id.label("booking_id"),
        func.sum(WriteOff.amount).label("amount"),
    )
    .where(WriteOff.booking_id.is_not(None))
    .group_by(WriteOff.booking_id)
    .subquery("wo_by_booking")
)
_breakage_of_booking = func.coalesce(_wo_by_booking.c.amount, 0)

_billable = Booking.status.in_(BILLABLE_STATUSES)


def _billable_sum(expr: ColumnElement) -> ColumnElement:
    return func.coalesce(func.sum(case((_billable, expr), else_=0)), 0)


_billable_count = func.coalesce(func.sum(case((_billable, 1), else_=0)), 0)

# Первая бронь клиента — по минимальному id: отличаем новых клиентов от повторных.
_b2 = aliased(Booking)
_first_booking_id = (
    select(func.min(_b2.id)).where(_b2.client_id == Booking.client_id).scalar_subquery()
)


def _bookings_base() -> Select:
    return (
        select()
        .select_from(Booking)
        .join(Client, Client.id == Booking.client_id)
        .join(Location, Location.id == Booking.location_id)
        .outerjoin(_wo_by_booking, _wo_by_booking.c.booking_id == Booking.id)
    )


_revenue_expr = _billable_sum(Booking.rental_total + _breakage_of_booking)

BOOKINGS = Dataset(
    key="bookings",
    label="Брони",
    description="Брони за период. Деньги считаются только по оплачиваемым броням "
    "(подтверждена/выдана/возвращена/закрыта) — черновики и отменённые исключены автоматически.",
    base=_bookings_base,
    period_col=Booking.start_date,
    period_kind="date",
    period_label="дата начала аренды",
    location_col=Booking.location_id,
    dimensions={
        "day": Dimension("day", "День (начало аренды)", Booking.start_date, kind="date"),
        "created_day": Dimension(
            "created_day", "День оформления", func.date(Booking.created_at), kind="date"
        ),
        "status": Dimension(
            "status",
            "Статус брони",
            Booking.status,
            value_labels=STATUS_LABELS,
            coerce=_enum_coerce(BookingStatus),
        ),
        "location": Dimension("location", "Точка", Location.id, label_expr=Location.name),
        "client_source": Dimension(
            "client_source",
            "Источник клиента",
            Client.source,
            value_labels=SOURCE_LABELS,
            coerce=_enum_coerce(ClientSource),
        ),
        "client_kind": Dimension(
            "client_kind",
            "Новый или повторный клиент",
            case((Booking.id == _first_booking_id, literal("new")), else_=literal("repeat")),
            value_labels={"new": "Новый", "repeat": "Повторный"},
        ),
    },
    measures={
        "revenue": Measure("revenue", "Выручка", _revenue_expr, "money"),
        "rental": Measure("rental", "Аренда", _billable_sum(Booking.rental_total), "money"),
        "breakage": Measure(
            "breakage", "Бой и утеря", _billable_sum(_breakage_of_booking), "money"
        ),
        "prepaid": Measure("prepaid", "Предоплата", _billable_sum(Booking.prepaid), "money"),
        "debt": Measure(
            "debt",
            "К оплате",
            _billable_sum(Booking.rental_total + _breakage_of_booking - Booking.prepaid),
            "money",
        ),
        "count": Measure("count", "Броней всего", func.count(Booking.id)),
        "billable_count": Measure("billable_count", "Оплачиваемых броней", _billable_count),
        "avg_check": Measure(
            "avg_check",
            "Средний чек",
            func.coalesce(_revenue_expr / func.nullif(_billable_count, 0), 0),
            "money",
        ),
    },
    notes=["Выручка = аренда + бой этой же брони, отнесённая к дате начала аренды."],
)


# --- booking_items ------------------------------------------------------------


def _booking_items_base() -> Select:
    return (
        select()
        .select_from(BookingItem)
        .join(Booking, Booking.id == BookingItem.booking_id)
        .join(Product, Product.id == BookingItem.product_id)
        .join(Location, Location.id == Booking.location_id)
        .outerjoin(Category, Category.id == Product.category_id)
    )


BOOKING_ITEMS = Dataset(
    key="booking_items",
    label="Позиции броней",
    description="Строки броней — что именно арендовали. Разрез по товарам и категориям.",
    base=_booking_items_base,
    period_col=Booking.start_date,
    period_kind="date",
    period_label="дата начала аренды",
    location_col=Booking.location_id,
    dimensions={
        "product": Dimension("product", "Товар", Product.id, label_expr=Product.name),
        "category": Dimension(
            "category",
            "Категория",
            func.coalesce(Category.name, literal("Без категории")),
        ),
        "day": Dimension("day", "День (начало аренды)", Booking.start_date, kind="date"),
        "location": Dimension("location", "Точка", Location.id, label_expr=Location.name),
        "status": Dimension(
            "status",
            "Статус брони",
            Booking.status,
            value_labels=STATUS_LABELS,
            coerce=_enum_coerce(BookingStatus),
        ),
    },
    measures={
        "amount": Measure("amount", "Сумма аренды", _billable_sum(BookingItem.line_total), "money"),
        "qty": Measure("qty", "Штук забронировано", _billable_sum(BookingItem.quantity)),
        "issued_qty": Measure("issued_qty", "Штук выдано", _billable_sum(BookingItem.issued_qty)),
    },
)


# --- stock --------------------------------------------------------------------


def _stock_base() -> Select:
    return (
        select()
        .select_from(Stock)
        .join(Product, Product.id == Stock.product_id)
        .join(Location, Location.id == Stock.location_id)
        .outerjoin(Category, Category.id == Product.category_id)
    )


_free_expr = Stock.total_qty - Stock.reserved_qty - Stock.issued_qty

STOCK = Dataset(
    key="stock",
    label="Остатки",
    description="Текущий остаток на складе. Это снимок «сейчас» — фильтр периода к нему "
    "не применяется.",
    base=_stock_base,
    period_col=None,
    location_col=Stock.location_id,
    dimensions={
        "product": Dimension("product", "Товар", Product.id, label_expr=Product.name),
        "category": Dimension(
            "category",
            "Категория",
            func.coalesce(Category.name, literal("Без категории")),
        ),
        "location": Dimension("location", "Точка", Location.id, label_expr=Location.name),
    },
    measures={
        "total": Measure("total", "Всего на складе", func.coalesce(func.sum(Stock.total_qty), 0)),
        "free": Measure("free", "Свободно", func.coalesce(func.sum(_free_expr), 0)),
        "reserved": Measure("reserved", "В брони", func.coalesce(func.sum(Stock.reserved_qty), 0)),
        "issued": Measure("issued", "Выдано", func.coalesce(func.sum(Stock.issued_qty), 0)),
        "zero_positions": Measure(
            "zero_positions",
            "Позиций в нуле",
            func.coalesce(func.sum(case((_free_expr <= 0, 1), else_=0)), 0),
        ),
    },
    notes=["Период на остатки не влияет: это состояние склада на текущий момент."],
)


# --- writeoffs ----------------------------------------------------------------


def _writeoffs_base() -> Select:
    return (
        select()
        .select_from(WriteOff)
        .join(Product, Product.id == WriteOff.product_id)
        .join(Location, Location.id == WriteOff.location_id)
        .outerjoin(Category, Category.id == Product.category_id)
    )


WRITEOFFS = Dataset(
    key="writeoffs",
    label="Списания",
    description="Бой, утеря и износ по дате списания. Включает и складские списания "
    "без привязки к брони.",
    base=_writeoffs_base,
    period_col=WriteOff.created_at,
    period_kind="datetime",
    period_label="дата списания",
    location_col=WriteOff.location_id,
    dimensions={
        "reason": Dimension(
            "reason",
            "Причина",
            WriteOff.reason,
            value_labels=REASON_LABELS,
            coerce=_enum_coerce(WriteOffReason),
        ),
        "day": Dimension("day", "День списания", func.date(WriteOff.created_at), kind="date"),
        "product": Dimension("product", "Товар", Product.id, label_expr=Product.name),
        "category": Dimension(
            "category",
            "Категория",
            func.coalesce(Category.name, literal("Без категории")),
        ),
        "location": Dimension("location", "Точка", Location.id, label_expr=Location.name),
    },
    measures={
        "qty": Measure("qty", "Штук списано", func.coalesce(func.sum(WriteOff.quantity), 0)),
        "amount": Measure(
            "amount", "Сумма списаний", func.coalesce(func.sum(WriteOff.amount), 0), "money"
        ),
    },
)


# --- movements (выдачи и возвраты) -------------------------------------------
#
# Объединяем два события в один набор. op_key делаем уникальным на весь UNION
# (id*2 и id*2+1), иначе COUNT(DISTINCT) склеил бы выдачу №3 с возвратом №3.

_issue_rows = (
    select(
        Issue.issued_at.label("at"),
        literal("issue", String).label("kind"),
        Booking.location_id.label("location_id"),
        (Issue.id * 2).label("op_key"),
        IssueItem.quantity.label("qty"),
    )
    .select_from(Issue)
    .join(Booking, Booking.id == Issue.booking_id)
    .join(IssueItem, IssueItem.issue_id == Issue.id)
)
_return_rows = (
    select(
        Return.returned_at.label("at"),
        literal("return", String).label("kind"),
        Booking.location_id.label("location_id"),
        (Return.id * 2 + literal(1, Integer)).label("op_key"),
        (ReturnItem.quantity + ReturnItem.broken_qty).label("qty"),
    )
    .select_from(Return)
    .join(Booking, Booking.id == Return.booking_id)
    .join(ReturnItem, ReturnItem.return_id == Return.id)
)
_mov = union_all(_issue_rows, _return_rows).subquery("movements")


def _movements_base() -> Select:
    return select().select_from(_mov)


MOVEMENTS = Dataset(
    key="movements",
    label="Выдачи и возвраты",
    description="Операционный ритм точки: сколько выдали и приняли по дням.",
    base=_movements_base,
    period_col=_mov.c.at,
    period_kind="datetime",
    period_label="дата операции",
    location_col=_mov.c.location_id,
    dimensions={
        "day": Dimension("day", "День операции", func.date(_mov.c.at), kind="date"),
        "kind": Dimension(
            "kind",
            "Тип операции",
            _mov.c.kind,
            value_labels={"issue": "Выдачи", "return": "Возвраты"},
        ),
        "location": Dimension("location", "Точка", _mov.c.location_id),
    },
    measures={
        "qty": Measure("qty", "Штук", func.coalesce(func.sum(_mov.c.qty), 0)),
        "ops": Measure("ops", "Операций", func.count(func.distinct(_mov.c.op_key))),
    },
)


# --- weborders ----------------------------------------------------------------


def _weborders_base() -> Select:
    return select().select_from(WebOrder)


WEBORDERS = Dataset(
    key="weborders",
    label="Заявки с сайта",
    description="Заявки из витрины и их судьба. У заявки нет точки, поэтому фильтр "
    "по точке к ней не применяется.",
    base=_weborders_base,
    period_col=WebOrder.created_at,
    period_kind="datetime",
    period_label="дата заявки",
    location_col=None,
    dimensions={
        "status": Dimension(
            "status",
            "Статус заявки",
            WebOrder.status,
            value_labels=WEBORDER_STATUS_LABELS,
            coerce=_enum_coerce(WebOrderStatus),
        ),
        "day": Dimension("day", "День заявки", func.date(WebOrder.created_at), kind="date"),
    },
    measures={
        "count": Measure("count", "Заявок", func.count(WebOrder.id)),
    },
    notes=["Фильтр по точке на заявки не влияет: точка у заявки не указывается."],
)


DATASETS: dict[str, Dataset] = {
    d.key: d for d in (BOOKINGS, BOOKING_ITEMS, STOCK, WRITEOFFS, MOVEMENTS, WEBORDERS)
}


def describe() -> dict:
    """Словарь для ИИ и для отладки: что можно спросить и какими словами."""
    return {
        "datasets": [
            {
                "key": ds.key,
                "label": ds.label,
                "description": ds.description,
                "period_by": ds.period_label or None,
                "supports_location_filter": ds.location_col is not None,
                "dimensions": [
                    {
                        "key": d.key,
                        "label": d.label,
                        "kind": d.kind,
                        "values": sorted(d.value_labels) if d.value_labels else None,
                    }
                    for d in ds.dimensions.values()
                ],
                "measures": [
                    {"key": m.key, "label": m.label, "format": m.format}
                    for m in ds.measures.values()
                ],
                "notes": ds.notes,
            }
            for ds in DATASETS.values()
        ],
    }
