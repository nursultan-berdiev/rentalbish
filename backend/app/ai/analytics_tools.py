"""Инструменты аналитики для ИИ-ассистента.

Ассистент не пишет SQL. Он читает словарь (analytics_schema), собирает спеку из
разрешённых имён и просит сохранить её блоком. Роль проверяется здесь, на сервере,
по реальному пользователю сессии — а не по тому, что модель о себе сказала.
"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.analytics import engine, schema, service
from app.analytics import spec as spec_mod
from app.analytics.engine import Period
from app.analytics.spec import QuerySpec, SpecError, WidgetSpec
from app.models.enums import UserRole
from app.models.user import User
from app.services.errors import DomainError

ADMIN_ONLY = {"error": "Менять состав дашборда может только администратор."}


def _period(days: int | None) -> Period:
    d = max(1, min(int(days or 30), 366))
    today = date.today()
    return Period(date_from=today - timedelta(days=d - 1), date_to=today)


def _is_admin(user: User | None) -> bool:
    return user is not None and user.role == UserRole.ADMIN


def analytics_schema(db: Session, user: User | None = None) -> dict:
    """Что можно спрашивать: наборы данных, разрезы, метрики."""
    return schema.describe()


def analytics_query(
    db: Session,
    user: User | None = None,
    *,
    query: dict | None = None,
    days: int | None = None,
    location_id: int | None = None,
) -> dict:
    """Посчитать спеку и вернуть числа — без сохранения блока."""
    try:
        q = QuerySpec(**(query or {}))
        spec_mod.validate(WidgetSpec(title="ad-hoc", chart="table", query=q))
        return engine.run(db, q, period=_period(days), location_id=location_id)
    except (SpecError, ValueError) as exc:
        return {"error": str(exc)}


def analytics_list_widgets(db: Session, user: User | None = None) -> list[dict]:
    """Какие блоки сейчас на дашборде."""
    return [
        {
            "id": w.id,
            "title": w.title,
            "chart": w.chart,
            "visible": w.is_visible,
            "builtin": w.is_builtin,
        }
        for w in service.list_widgets(db)
    ]


def analytics_add_widget(
    db: Session,
    user: User | None = None,
    *,
    widget: dict | None = None,
) -> dict:
    """Добавить блок на дашборд. Спека должна собираться только из словаря."""
    if not _is_admin(user):
        return ADMIN_ONLY
    try:
        body = WidgetSpec(**(widget or {}))
        created = service.create_widget(db, body, user_id=user.id)
    except (SpecError, DomainError, ValueError) as exc:
        return {"error": str(exc)}
    return {"ok": True, "widget_id": created.id, "title": created.title}


def analytics_remove_widget(
    db: Session,
    user: User | None = None,
    *,
    widget_id: int | None = None,
) -> dict:
    """Убрать блок, добавленный ранее. Встроенные блоки удалить нельзя — только скрыть."""
    if not _is_admin(user):
        return ADMIN_ONLY
    try:
        widget = service.get_widget(db, int(widget_id))
        service.delete_widget(db, widget, user_id=user.id)
    except DomainError as exc:
        return {"error": str(exc)}
    return {"ok": True, "widget_id": widget_id}


HANDLERS = {
    "analytics_schema": analytics_schema,
    "analytics_query": analytics_query,
    "analytics_list_widgets": analytics_list_widgets,
    "analytics_add_widget": analytics_add_widget,
    "analytics_remove_widget": analytics_remove_widget,
}

_SPEC_HINT = (
    "Спека блока: {title, chart, span (1-3), compare, query:{dataset, measures[], "
    "dimensions[], filters[{field,op,value}], order_by, limit}, series:[{measure,label,color,"
    "type,axis}]}. Типы графика: kpi, line, area, bar, combo, stacked_bar, hbar, donut, table. "
    "Цвета: accent, amber, green, violet, danger, by_status, by_value. "
    "Все имена dataset/measures/dimensions обязаны быть из analytics_schema."
)

TOOLS = [
    {
        "name": "analytics_schema",
        "description": (
            "Словарь аналитики: какие есть наборы данных, разрезы и метрики. "
            "Вызывай ПЕРВЫМ, прежде чем считать что-либо или добавлять блок: "
            "имена нельзя выдумывать."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "analytics_query",
        "description": "Посчитать данные по спеке запроса (без сохранения блока). " + _SPEC_HINT,
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "object", "description": "QuerySpec"},
                "days": {"type": "integer", "description": "Глубина периода в днях, по умолч. 30"},
                "location_id": {"type": "integer"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "analytics_list_widgets",
        "description": "Показать блоки, которые сейчас есть на дашборде «Обзор».",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "analytics_add_widget",
        "description": (
            "Добавить новый блок на дашборд «Обзор» (только для администратора). " + _SPEC_HINT
        ),
        "input_schema": {
            "type": "object",
            "properties": {"widget": {"type": "object", "description": "WidgetSpec"}},
            "required": ["widget"],
        },
    },
    {
        "name": "analytics_remove_widget",
        "description": (
            "Удалить блок дашборда по id (только для администратора). "
            "Встроенные блоки удалить нельзя — их можно только скрыть в настройках."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"widget_id": {"type": "integer"}},
            "required": ["widget_id"],
        },
    },
]
