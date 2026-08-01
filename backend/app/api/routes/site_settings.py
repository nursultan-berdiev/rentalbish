"""Настройки сайта: публичный статус витрины (без авторизации) и админское обновление."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.schemas.site import SiteSettingsOut, SiteSettingsUpdate, SiteStatusOut
from app.services import site_settings

router = APIRouter(prefix="/site", tags=["site"])


@router.get("/status", response_model=SiteStatusOut)
def site_status(db: Session = Depends(get_db)) -> SiteStatusOut:
    """Публичный статус витрины: режим обслуживания и контактный номер."""
    row = site_settings.get_or_create(db)
    return SiteStatusOut(maintenance=row.maintenance_mode, whatsapp_phone=row.whatsapp_phone)


@router.patch("/settings", response_model=SiteSettingsOut, dependencies=[Depends(require_admin)])
def update_site_settings(
    body: SiteSettingsUpdate, db: Session = Depends(get_db)
) -> SiteSettingsOut:
    """Изменить настройки сайта (только админ). Применяются лишь переданные поля."""
    row = site_settings.get_or_create(db)
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return SiteSettingsOut.model_validate(row)
