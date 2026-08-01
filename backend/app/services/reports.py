"""Отчёты: остатки, движение за период, активность сотрудников, on-hands/просрочки."""

import io
from datetime import date, datetime, time

import openpyxl
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.booking import Issue, Return
from app.models.inventory import Supply, WriteOff
from app.models.user import User
from app.services.inventory import stock_summary
from app.services.money import money
from app.services.reservation import bookings_on_hands, on_hands_items


def _range(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    return datetime.combine(date_from, time.min), datetime.combine(date_to, time.max)


def movement(db: Session, date_from: date, date_to: date) -> dict:
    start, end = _range(date_from, date_to)

    supplies_qty = db.execute(
        select(func.coalesce(func.sum(Supply.quantity), 0)).where(
            Supply.created_at >= start, Supply.created_at <= end
        )
    ).scalar_one()
    writeoff_qty, writeoff_amount = db.execute(
        select(
            func.coalesce(func.sum(WriteOff.quantity), 0),
            func.coalesce(func.sum(WriteOff.amount), 0),
        ).where(WriteOff.created_at >= start, WriteOff.created_at <= end)
    ).one()
    issues_cnt = db.execute(
        select(func.count(Issue.id)).where(Issue.issued_at >= start, Issue.issued_at <= end)
    ).scalar_one()
    returns_cnt = db.execute(
        select(func.count(Return.id)).where(Return.returned_at >= start, Return.returned_at <= end)
    ).scalar_one()

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "supplied_qty": int(supplies_qty),
        "written_off_qty": int(writeoff_qty),
        "written_off_amount": float(money(writeoff_amount)),
        "issues_count": int(issues_cnt),
        "returns_count": int(returns_cnt),
    }


def staff_activity(db: Session, date_from: date, date_to: date) -> list[dict]:
    start, end = _range(date_from, date_to)
    rows = db.execute(
        select(AuditLog.user_id, AuditLog.action, func.count(AuditLog.id))
        .where(AuditLog.created_at >= start, AuditLog.created_at <= end)
        .group_by(AuditLog.user_id, AuditLog.action)
    ).all()
    logins = {u.id: u.login for u in db.execute(select(User)).scalars().all()}
    agg: dict[int | None, dict] = {}
    for user_id, action, count in rows:
        entry = agg.setdefault(
            user_id, {"user_id": user_id, "login": logins.get(user_id, "—"), "actions": {}}
        )
        entry["actions"][action] = int(count)
    return list(agg.values())


def on_hands(db: Session, *, as_of: date | None = None) -> list[dict]:
    """Брони с товаром на руках (выданные, не полностью возвращённые)."""
    today = as_of or date.today()
    return [
        {
            "booking_id": b.id,
            "client_name": b.client.name,
            "client_phone": b.client.phone,
            "expected_return_date": b.expected_return_date.isoformat(),
            "overdue": b.expected_return_date < today,
            "days_overdue": max(0, (today - b.expected_return_date).days),
            "items": [
                {
                    "product_id": bi.product_id,
                    "product_name": bi.product.name,
                    "qty": bi.issued_qty - bi.returned_qty,
                }
                for bi in on_hands_items(b)
            ],
        }
        for b in bookings_on_hands(db)
    ]


def stock_to_excel(db: Session, location_id: int | None = None) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Остатки"
    ws.append(["Товар", "Точка", "Всего", "Забронировано", "Выдано", "Доступно"])
    for r in stock_summary(db, location_id=location_id):
        ws.append(
            [
                r["product_name"],
                r["location_name"],
                r["total_qty"],
                r["reserved_qty"],
                r["issued_qty"],
                r["available"],
            ]
        )
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
