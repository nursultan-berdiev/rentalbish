"""Просмотр журнала аудита (только администратор)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/audit", tags=["audit"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[AuditLogOut])
def list_audit(
    entity: str | None = None,
    action: str | None = None,
    user_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[AuditLog]:
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(min(limit, 500))
    if entity is not None:
        stmt = stmt.where(AuditLog.entity == entity)
    if action is not None:
        stmt = stmt.where(AuditLog.action == action)
    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)
    return list(db.execute(stmt).scalars().all())
