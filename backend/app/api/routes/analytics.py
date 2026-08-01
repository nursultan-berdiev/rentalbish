"""Аналитика: дашборд, словарь метрик, ad-hoc расчёт и управление блоками.

Читать может любой сотрудник. Менять состав дашборда — только админ: и через UI,
и через ИИ-ассистента (роль проверяется на сервере, а не по слову модели).
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.analytics import engine, schema, service
from app.analytics.engine import Period
from app.analytics.spec import QuerySpec, WidgetSpec
from app.api.deps import require_admin, require_staff
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(require_staff)])

DEFAULT_PERIOD_DAYS = 30


def _period(date_from: date | None, date_to: date | None) -> Period:
    end = date_to or date.today()
    start = date_from or (end - timedelta(days=DEFAULT_PERIOD_DAYS - 1))
    return Period(date_from=start, date_to=end)


class WidgetPatch(BaseModel):
    title: str | None = None
    position: int | None = None
    is_visible: bool | None = None


@router.get("/dashboard")
def dashboard(
    date_from: date | None = None,
    date_to: date | None = None,
    location_id: int | None = None,
    db: Session = Depends(get_db),
) -> dict:
    """Весь экран «Обзор» одним запросом: задачи дня + все видимые блоки с данными."""
    return service.render(db, period=_period(date_from, date_to), location_id=location_id)


@router.get("/schema")
def analytics_schema() -> dict:
    """Словарь: какие наборы данных, разрезы и метрики можно использовать в спеке."""
    return schema.describe()


@router.post("/query")
def analytics_query(
    body: QuerySpec,
    date_from: date | None = None,
    date_to: date | None = None,
    location_id: int | None = None,
    db: Session = Depends(get_db),
) -> dict:
    """Разовый расчёт по спеке — без сохранения блока."""
    from app.analytics.spec import validate

    validate(WidgetSpec(title="ad-hoc", chart="table", query=body))
    return engine.run(db, body, period=_period(date_from, date_to), location_id=location_id)


@router.get("/widgets")
def list_widgets(db: Session = Depends(get_db)) -> list[dict]:
    return [_widget_out(w) for w in service.list_widgets(db)]


@router.post("/widgets", status_code=201, dependencies=[Depends(require_admin)])
def create_widget(
    body: WidgetSpec,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
) -> dict:
    return _widget_out(service.create_widget(db, body, user_id=current.id))


@router.patch("/widgets/{widget_id}", dependencies=[Depends(require_admin)])
def patch_widget(
    widget_id: int,
    body: WidgetPatch,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
) -> dict:
    widget = service.get_widget(db, widget_id)
    return _widget_out(
        service.update_widget(
            db,
            widget,
            title=body.title,
            position=body.position,
            is_visible=body.is_visible,
            user_id=current.id,
        )
    )


@router.delete("/widgets/{widget_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_widget(
    widget_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
) -> None:
    service.delete_widget(db, service.get_widget(db, widget_id), user_id=current.id)


def _widget_out(w) -> dict:
    return {
        "id": w.id,
        "key": w.key,
        "title": w.title,
        "chart": w.chart,
        "spec": w.spec,
        "position": w.position,
        "is_visible": w.is_visible,
        "is_builtin": w.is_builtin,
    }
