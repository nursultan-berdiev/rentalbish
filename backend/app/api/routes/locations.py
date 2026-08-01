"""Точки/склады. Просмотр — под ролью staff, изменение — только admin."""

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_or_404, require_admin, require_staff
from app.db.session import get_db
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationOut, LocationUpdate

router = APIRouter(prefix="/locations", tags=["locations"])

NOT_FOUND = "Точка не найдена"


@router.get("", response_model=list[LocationOut], dependencies=[Depends(require_staff)])
def list_locations(active_only: bool = False, db: Session = Depends(get_db)) -> list[Location]:
    stmt = select(Location).order_by(Location.id)
    if active_only:
        stmt = stmt.where(Location.is_active.is_(True))
    return list(db.execute(stmt).scalars().all())


@router.post(
    "",
    response_model=LocationOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_location(body: LocationCreate, db: Session = Depends(get_db)) -> Location:
    loc = Location(**body.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.patch("/{location_id}", response_model=LocationOut, dependencies=[Depends(require_admin)])
def update_location(
    location_id: int, body: LocationUpdate, db: Session = Depends(get_db)
) -> Location:
    loc = get_or_404(db, Location, location_id, NOT_FOUND)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    db.commit()
    db.refresh(loc)
    return loc
