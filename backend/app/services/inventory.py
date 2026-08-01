"""Работа со складским остатком (Stock): выборка, движения, единая сводка."""

from sqlalchemy import select
from sqlalchemy.orm import Session, lazyload

from app.models.inventory import Stock
from app.services.errors import ConflictError


def get_stock(
    db: Session, product_id: int, location_id: int, *, for_update: bool = False
) -> Stock | None:
    stmt = select(Stock).where(Stock.product_id == product_id, Stock.location_id == location_id)
    if for_update:
        # Блокировка строки — защита от гонок при параллельном резерве (Postgres).
        # На SQLite with_for_update игнорируется (одиночная запись).
        #
        # ВАЖНО: Stock.product/Stock.location объявлены lazy="joined", и без lazyload
        # запрос уходит с LEFT OUTER JOIN, а Postgres на это отвечает
        # "FOR UPDATE cannot be applied to the nullable side of an outer join".
        # Для блокировки связи не нужны — берём голую строку остатка и блокируем
        # только её (of=Stock защитит, даже если eager-загрузку вернут).
        stmt = stmt.options(lazyload(Stock.product), lazyload(Stock.location)).with_for_update(
            of=Stock
        )
    return db.execute(stmt).scalar_one_or_none()


def get_or_create_stock(db: Session, product_id: int, location_id: int) -> Stock:
    stock = get_stock(db, product_id, location_id)
    if stock is None:
        stock = Stock(product_id=product_id, location_id=location_id)
        db.add(stock)
        db.flush()
    return stock


def supply(db: Session, product_id: int, location_id: int, quantity: int) -> Stock:
    if quantity <= 0:
        raise ConflictError("Количество завоза должно быть положительным")
    stock = get_or_create_stock(db, product_id, location_id)
    stock.total_qty += quantity
    return stock


def list_stock(
    db: Session, product_id: int | None = None, location_id: int | None = None
) -> list[Stock]:
    stmt = select(Stock)
    if product_id is not None:
        stmt = stmt.where(Stock.product_id == product_id)
    if location_id is not None:
        stmt = stmt.where(Stock.location_id == location_id)
    return list(db.execute(stmt).scalars().all())


def stock_summary(
    db: Session, product_id: int | None = None, location_id: int | None = None
) -> list[dict]:
    """Единая сводка остатков (используется API, отчётами и ИИ/MCP-слоем)."""
    return [
        {
            "product_id": s.product_id,
            "product_name": s.product.name,
            "product_category": s.product.category.name if s.product.category else "",
            "location_id": s.location_id,
            "location_name": s.location.name,
            "total_qty": s.total_qty,
            "reserved_qty": s.reserved_qty,
            "issued_qty": s.issued_qty,
            "available": s.available,
        }
        for s in list_stock(db, product_id, location_id)
    ]
