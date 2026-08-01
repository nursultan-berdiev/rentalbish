"""Доступ к singleton-строке настроек сайта."""

from sqlalchemy.orm import Session

from app.models.site import SiteSettings


def get_or_create(db: Session) -> SiteSettings:
    """Вернуть строку настроек (id=1), создав её с дефолтами при отсутствии."""
    row = db.get(SiteSettings, 1)
    if row is None:
        row = SiteSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row
