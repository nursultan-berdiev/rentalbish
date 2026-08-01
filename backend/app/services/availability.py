"""Расчёт свободного остатка (доступности) товара/комплекта на точке.

- Обычный товар: available = Stock.available (total − reserved − issued) на точке.
- Комплект: доступность лимитируется самым дефицитным компонентом:
      Доступно наборов = min( available(компонент) // кол-во_в_наборе )
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.catalog import Product
from app.models.enums import ProductType
from app.services.errors import NotFoundError
from app.services.inventory import get_stock


@dataclass
class ComponentShortage:
    product_id: int
    name: str
    available: int
    required_per_set: int


def available(db: Session, product: Product, location_id: int) -> int:
    """Свободный остаток позиции на точке (для товара и для комплекта)."""
    if product.type == ProductType.SET:
        return _set_available(db, product, location_id)
    stock = get_stock(db, product.id, location_id)
    return stock.available if stock else 0


def available_by_id(db: Session, product_id: int, location_id: int) -> int:
    product = db.get(Product, product_id)
    if product is None:
        raise NotFoundError(f"Товар id={product_id} не найден")
    return available(db, product, location_id)


def _set_available(db: Session, set_product: Product, location_id: int) -> int:
    if not set_product.components:
        return 0
    best = None
    for comp in set_product.components:
        per_set = comp.quantity or 1
        comp_stock = get_stock(db, comp.component_id, location_id)
        comp_avail = comp_stock.available if comp_stock else 0
        possible = comp_avail // per_set
        best = possible if best is None else min(best, possible)
    return best or 0


def set_shortages(db: Session, set_product: Product, location_id: int) -> list[ComponentShortage]:
    """Детализация по компонентам комплекта — что и сколько доступно."""
    out: list[ComponentShortage] = []
    for comp in set_product.components:
        comp_stock = get_stock(db, comp.component_id, location_id)
        out.append(
            ComponentShortage(
                product_id=comp.component_id,
                name=comp.component.name,
                available=comp_stock.available if comp_stock else 0,
                required_per_set=comp.quantity or 1,
            )
        )
    return out
