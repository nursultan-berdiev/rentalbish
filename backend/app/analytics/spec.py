"""Спецификация виджета: блок дашборда как ДАННЫЕ, а не как код.

Именно эти структуры сочиняет ИИ-ассистент. Валидация здесь жёсткая и работает
против словаря (app.analytics.schema): любое имя, которого нет в словаре, — отказ
с внятным текстом, чтобы ассистент увидел причину и исправился.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.analytics import schema
from app.services.errors import DomainError

CHART_TYPES = (
    "kpi",  # плитки с числами (+ сравнение с прошлым периодом)
    "line",
    "area",
    "bar",
    "combo",  # площадь + столбцы на двух осях
    "stacked_bar",
    "hbar",  # горизонтальные столбцы — для топов
    "donut",
    "table",
)

FilterOp = Literal["eq", "ne", "in", "gt", "lt", "between"]

MAX_LIMIT = 400


class SpecError(DomainError):
    """Спека виджета не сходится со словарём. 422, чтобы ассистент понял и переделал."""

    status_code = 422


class Filter(BaseModel):
    field: str
    op: FilterOp = "eq"
    value: Any = None


class QuerySpec(BaseModel):
    dataset: str
    measures: list[str] = Field(min_length=1, max_length=4)
    dimensions: list[str] = Field(default_factory=list, max_length=2)
    filters: list[Filter] = Field(default_factory=list, max_length=6)
    order_by: str | None = None  # "revenue" или "-revenue" (минус = по убыванию)
    limit: int = Field(default=100, ge=1, le=MAX_LIMIT)


class SeriesSpec(BaseModel):
    measure: str
    label: str | None = None
    # Имя токена палитры: accent | amber | green | violet | danger | by_status | by_value
    color: str | None = None
    type: Literal["bar", "line", "area"] | None = None  # только для chart=combo
    axis: Literal["left", "right"] | None = None  # только для chart=combo


class WidgetSpec(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    chart: Literal[CHART_TYPES]  # type: ignore[valid-type]
    query: QuerySpec
    series: list[SeriesSpec] = Field(default_factory=list, max_length=4)
    span: int = Field(default=1, ge=1, le=3)  # ширина в колонках сетки (сетка из 3)
    compare: bool = False  # сравнивать с предыдущим периодом (осмысленно для kpi)


def validate(spec: WidgetSpec) -> WidgetSpec:
    """Сверить спеку со словарём. Бросает SpecError с человеческим текстом."""
    q = spec.query
    ds = schema.DATASETS.get(q.dataset)
    if ds is None:
        raise SpecError(
            f"Нет набора данных «{q.dataset}». Доступны: {', '.join(sorted(schema.DATASETS))}"
        )

    for m in q.measures:
        if m not in ds.measures:
            raise SpecError(
                f"У набора «{ds.key}» нет метрики «{m}». "
                f"Доступны: {', '.join(sorted(ds.measures))}"
            )
    if len(set(q.measures)) != len(q.measures):
        raise SpecError("Метрики в списке повторяются")

    for d in q.dimensions:
        if d not in ds.dimensions:
            raise SpecError(
                f"У набора «{ds.key}» нет разреза «{d}». "
                f"Доступны: {', '.join(sorted(ds.dimensions))}"
            )
    if len(set(q.dimensions)) != len(q.dimensions):
        raise SpecError("Разрезы в списке повторяются")

    for f in q.filters:
        if f.field not in ds.dimensions:
            raise SpecError(
                f"Фильтровать можно только по разрезам набора «{ds.key}»: "
                f"{', '.join(sorted(ds.dimensions))}. Поля «{f.field}» среди них нет"
            )
        if f.op == "in" and not isinstance(f.value, list):
            raise SpecError(f"Фильтр «{f.field}» с op=in ожидает список значений")
        if f.op == "between" and not (isinstance(f.value, list) and len(f.value) == 2):
            raise SpecError(f"Фильтр «{f.field}» с op=between ожидает список из двух значений")

    if q.order_by:
        name = q.order_by.lstrip("-")
        if name not in ds.measures and name not in ds.dimensions:
            raise SpecError(f"Сортировать по «{name}» нельзя: нет такой метрики или разреза")
        if name not in q.measures and name not in q.dimensions:
            raise SpecError(f"Сортировка по «{name}» требует, чтобы он был в measures/dimensions")

    _validate_chart(spec, ds)
    _validate_series(spec)
    return spec


def _validate_chart(spec: WidgetSpec, ds: schema.Dataset) -> None:
    chart, q = spec.chart, spec.query
    ndim, nmeas = len(q.dimensions), len(q.measures)

    if chart == "kpi":
        if ndim:
            raise SpecError("Плитки (kpi) считают итог за период — разрезы им не нужны")
    elif chart == "donut":
        if ndim != 1 or nmeas != 1:
            raise SpecError("Кольцу (donut) нужен ровно один разрез и одна метрика")
    elif chart == "hbar":
        if ndim != 1 or nmeas != 1:
            raise SpecError("Горизонтальным столбцам нужен один разрез и одна метрика")
    elif chart in ("line", "area", "combo"):
        if ndim != 1:
            raise SpecError(f"Графику «{chart}» нужен ровно один разрез (обычно день)")
    elif chart in ("bar", "stacked_bar"):
        if ndim not in (1, 2):
            raise SpecError(f"Графику «{chart}» нужен один или два разреза")
        if ndim == 2 and nmeas != 1:
            raise SpecError("С двумя разрезами столбцы строятся по одной метрике")
    elif chart == "table":
        if not ndim:
            raise SpecError("Таблице нужен хотя бы один разрез")

    if chart == "donut" and ds.dimensions[q.dimensions[0]].kind == "date":
        raise SpecError("Кольцо по дням бессмысленно — возьмите категорию или статус")


def _validate_series(spec: WidgetSpec) -> None:
    known = set(spec.query.measures)
    for s in spec.series:
        if s.measure not in known:
            raise SpecError(
                f"Серия ссылается на метрику «{s.measure}», которой нет в measures запроса"
            )


def default_series(spec: WidgetSpec) -> list[SeriesSpec]:
    """Если серии не заданы — рисуем по метрике на серию."""
    if spec.series:
        return spec.series
    ds = schema.DATASETS[spec.query.dataset]
    return [SeriesSpec(measure=m, label=ds.measures[m].label) for m in spec.query.measures]
