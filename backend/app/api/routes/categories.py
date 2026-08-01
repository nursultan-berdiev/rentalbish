"""Категории товаров."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_or_404, require_admin, require_staff
from app.db.session import get_db
from app.models.catalog import Category
from app.schemas.catalog import CategoryCreate, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut], dependencies=[Depends(require_staff)])
def list_categories(db: Session = Depends(get_db)) -> list[Category]:
    return list(db.execute(select(Category).order_by(Category.name)).scalars().all())


@router.post(
    "",
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)) -> Category:
    exists = db.execute(select(Category).where(Category.name == body.name)).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Категория уже существует")
    cat = Category(name=body.name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=CategoryOut, dependencies=[Depends(require_admin)])
def rename_category(
    category_id: int, body: CategoryCreate, db: Session = Depends(get_db)
) -> Category:
    cat = get_or_404(db, Category, category_id, "Категория не найдена")
    exists = db.execute(
        select(Category).where(Category.name == body.name, Category.id != category_id)
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Категория уже существует")
    cat.name = body.name
    db.commit()
    db.refresh(cat)
    return cat
