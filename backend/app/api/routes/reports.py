"""Отчёты для сотрудников: остатки, движение, активность, on-hands, экспорт в Excel."""

from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_staff
from app.core.constants import XLSX_MIME
from app.db.session import get_db
from app.services import inventory, reports

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_staff)])


@router.get("/stock")
def stock_report(location_id: int | None = None, db: Session = Depends(get_db)) -> list[dict]:
    return inventory.stock_summary(db, location_id=location_id)


@router.get("/on-hands")
def on_hands_report(db: Session = Depends(get_db)) -> list[dict]:
    return reports.on_hands(db)


@router.get("/movement")
def movement_report(date_from: date, date_to: date, db: Session = Depends(get_db)) -> dict:
    return reports.movement(db, date_from, date_to)


@router.get("/staff-activity", dependencies=[Depends(require_admin)])
def staff_activity_report(
    date_from: date, date_to: date, db: Session = Depends(get_db)
) -> list[dict]:
    return reports.staff_activity(db, date_from, date_to)


@router.get("/stock.xlsx")
def stock_excel(location_id: int | None = None, db: Session = Depends(get_db)) -> Response:
    return Response(
        content=reports.stock_to_excel(db, location_id),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": "attachment; filename=stock_report.xlsx"},
    )
