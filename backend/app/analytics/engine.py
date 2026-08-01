"""Исполнитель спеки: JSON → безопасный SELECT → строки.

Строку SQL здесь принять неоткуда: каждое выражение берётся из словаря
(app.analytics.schema) по имени. Худшее, что может сделать автор спеки, —
собрать бессмысленный график.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.analytics import schema
from app.analytics.spec import Filter, QuerySpec, SpecError


@dataclass(frozen=True)
class Period:
    date_from: date
    date_to: date

    @property
    def days(self) -> int:
        return (self.date_to - self.date_from).days + 1

    def previous(self) -> "Period":
        """Предыдущий период такой же длины — база для дельт в плитках."""
        return Period(
            date_from=self.date_from - timedelta(days=self.days),
            date_to=self.date_from - timedelta(days=1),
        )


def _norm(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if hasattr(value, "value"):  # член перечисления
        return value.value
    return value


def _date_label(iso: str) -> str:
    try:
        d = date.fromisoformat(str(iso)[:10])
    except ValueError:
        return str(iso)
    return f"{d.day:02d}.{d.month:02d}"


def _condition(ds: schema.Dataset, f: Filter):
    dim = ds.dimensions[f.field]  # наличие проверено в spec.validate
    col = dim.expr
    coerce = dim.coerce or (lambda v: v)

    if f.op == "in":
        return col.in_([coerce(v) for v in f.value])
    if f.op == "between":
        return col.between(coerce(f.value[0]), coerce(f.value[1]))
    value = coerce(f.value)
    if f.op == "eq":
        return col == value
    if f.op == "ne":
        return col != value
    if f.op == "gt":
        return col > value
    if f.op == "lt":
        return col < value
    raise SpecError(f"Неизвестный оператор фильтра: {f.op}")


def run(
    db: Session,
    q: QuerySpec,
    *,
    period: Period | None = None,
    location_id: int | None = None,
) -> dict:
    """Посчитать спеку. Возвращает описание колонок и строки."""
    ds = schema.DATASETS[q.dataset]

    dims = [ds.dimensions[k] for k in q.dimensions]
    measures = [ds.measures[k] for k in q.measures]

    cols, group = [], []
    for d in dims:
        cols.append(d.expr.label(f"d_{d.key}"))
        group.append(d.expr)
        if d.label_expr is not None:
            cols.append(d.label_expr.label(f"l_{d.key}"))
            group.append(d.label_expr)
    cols.extend(m.expr.label(f"m_{m.key}") for m in measures)

    stmt = ds.base().add_columns(*cols)

    if period is not None and ds.period_col is not None:
        if ds.period_kind == "datetime":
            start = datetime.combine(period.date_from, time.min)
            end = datetime.combine(period.date_to, time.max)
            stmt = stmt.where(ds.period_col >= start, ds.period_col <= end)
        else:
            stmt = stmt.where(ds.period_col >= period.date_from, ds.period_col <= period.date_to)

    if location_id is not None and ds.location_col is not None:
        stmt = stmt.where(ds.location_col == location_id)

    for f in q.filters:
        stmt = stmt.where(_condition(ds, f))

    if group:
        stmt = stmt.group_by(*group)
        stmt = stmt.order_by(*_order(ds, q, dims, measures))
        stmt = stmt.limit(q.limit)

    rows = [_row(dims, measures, r) for r in db.execute(stmt).mappings().all()]

    if group and len(dims) == 1 and dims[0].kind == "date" and period is not None:
        rows = _fill_days(rows, dims[0], measures, period)

    return {
        "dataset": ds.key,
        "dimensions": [{"key": d.key, "label": d.label, "kind": d.kind} for d in dims],
        "measures": [{"key": m.key, "label": m.label, "format": m.format} for m in measures],
        "rows": rows,
    }


def _order(ds: schema.Dataset, q: QuerySpec, dims, measures):
    if q.order_by:
        descending = q.order_by.startswith("-")
        name = q.order_by.lstrip("-")
        col = (
            ds.measures[name].expr.label(f"m_{name}")
            if name in ds.measures
            else ds.dimensions[name].expr
        )
        return [desc(col) if descending else col]
    # По умолчанию: даты — по возрастанию, всё остальное — по убыванию первой метрики.
    if dims and dims[0].kind == "date":
        return [dims[0].expr]
    return [desc(measures[0].expr.label(f"m_{measures[0].key}"))]


def _row(dims, measures, mapping) -> dict:
    row: dict = {}
    for d in dims:
        raw = _norm(mapping[f"d_{d.key}"])
        row[d.key] = raw
        if d.label_expr is not None:
            row[f"{d.key}_label"] = mapping[f"l_{d.key}"]
        elif d.value_labels:
            row[f"{d.key}_label"] = d.value_labels.get(str(raw), str(raw))
        elif d.kind == "date":
            row[f"{d.key}_label"] = _date_label(raw)
        else:
            row[f"{d.key}_label"] = str(raw)
    for m in measures:
        row[m.key] = _norm(mapping[f"m_{m.key}"])
    return row


def _fill_days(rows, dim, measures, period: Period) -> list[dict]:
    """Дни без событий — это ноль, а не дырка в графике."""
    by_key = {str(r[dim.key])[:10]: r for r in rows}
    out = []
    cur = period.date_from
    while cur <= period.date_to:
        iso = cur.isoformat()
        row = by_key.get(iso)
        if row is None:
            row = {dim.key: iso, f"{dim.key}_label": _date_label(iso)}
            row.update({m.key: 0 for m in measures})
        out.append(row)
        cur += timedelta(days=1)
    return out


def totals(result: dict) -> dict:
    """Итог по метрикам — для плиток и подписей."""
    return {
        m["key"]: sum(r.get(m["key"], 0) or 0 for r in result["rows"]) for m in result["measures"]
    }
