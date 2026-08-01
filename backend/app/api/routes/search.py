"""Сквозной поиск по системе (строка поиска в шапке панели)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_staff
from app.db.session import get_db
from app.services import search

router = APIRouter(prefix="/search", tags=["search"], dependencies=[Depends(require_staff)])


@router.get("")
def global_search(q: str = "", limit: int = 5, db: Session = Depends(get_db)) -> dict:
    """Найти товары, клиентов и брони одним запросом."""
    return search.search_all(db, q, limit=min(limit, 20))
