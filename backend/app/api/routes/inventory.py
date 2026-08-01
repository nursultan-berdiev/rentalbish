"""Остатки, завоз и списание."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_or_404, require_staff
from app.db.session import get_db
from app.models.catalog import Product
from app.models.enums import ProductType
from app.models.inventory import Supply
from app.models.user import User
from app.schemas.inventory import (
    StockRow,
    SupplyCreate,
    SupplyOut,
    WriteOffCreate,
    WriteOffOut,
)
from app.services import availability, breakage, inventory
from app.services.audit import record

router = APIRouter(prefix="/inventory", tags=["inventory"], dependencies=[Depends(require_staff)])

PRODUCT_NOT_FOUND = "Товар не найден"


@router.get("/stock", response_model=list[StockRow])
def list_stock(
    location_id: int | None = None,
    product_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Сводка остатков по парам товар×точка."""
    return inventory.stock_summary(db, product_id=product_id, location_id=location_id)


@router.get("/available")
def get_available(product_id: int, location_id: int, db: Session = Depends(get_db)) -> dict:
    """Свободный остаток позиции на точке (учитывает комплекты)."""
    product = get_or_404(db, Product, product_id, PRODUCT_NOT_FOUND)
    return {
        "product_id": product_id,
        "location_id": location_id,
        "available": availability.available(db, product, location_id),
        "is_set": product.type == ProductType.SET,
    }


@router.post("/supply", response_model=SupplyOut, status_code=201)
def create_supply(
    body: SupplyCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> Supply:
    """Завоз товара на точку (+остаток)."""
    get_or_404(db, Product, body.product_id, PRODUCT_NOT_FOUND)
    inventory.supply(db, body.product_id, body.location_id, body.quantity)
    entry = Supply(
        product_id=body.product_id,
        location_id=body.location_id,
        quantity=body.quantity,
        comment=body.comment,
        created_by_id=current.id,
    )
    db.add(entry)
    record(
        db,
        user_id=current.id,
        action="supply",
        entity="product",
        entity_id=body.product_id,
        new={"quantity": body.quantity, "location_id": body.location_id},
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/write-off", response_model=WriteOffOut, status_code=201)
def create_write_off(
    body: WriteOffCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> object:
    """Списание со склада (бой/утеря/износ)."""
    entry = breakage.write_off(
        db,
        product_id=body.product_id,
        location_id=body.location_id,
        quantity=body.quantity,
        reason=body.reason,
        user_id=current.id,
    )
    db.commit()
    db.refresh(entry)
    return entry
