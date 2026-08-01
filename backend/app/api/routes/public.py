"""Публичные эндпоинты витрины (без авторизации): каталог и приём заявок."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.catalog import Product
from app.models.enums import WebOrderStatus
from app.models.location import Location
from app.models.weborder import WebOrder, WebOrderItem
from app.schemas.catalog import CatalogPublicDetail, CatalogPublicItem, ProductAttribute
from app.schemas.weborder import WebOrderCreate, WebOrderOut
from app.services import availability
from app.tasks.telegram_notify import notify_web_order

router = APIRouter(tags=["public"])


def _active_location_ids(db: Session) -> list[int]:
    return list(db.execute(select(Location.id).where(Location.is_active.is_(True))).scalars().all())


def _total_available(db: Session, product: Product, location_ids: list[int]) -> int:
    return sum(availability.available(db, product, loc_id) for loc_id in location_ids)


def _ordered_photos(product: Product) -> list[str]:
    """Главное фото первым, остальные — по порядку загрузки."""
    return [p.file_path for p in sorted(product.photos, key=lambda ph: (not ph.is_primary, ph.id))]


@router.get("/catalog/public", response_model=list[CatalogPublicItem])
def public_catalog(db: Session = Depends(get_db)) -> list[CatalogPublicItem]:
    """Только товары с признаком show_on_site и хотя бы одним фото; остаток —
    сумма доступного по всем активным точкам."""
    active_locations = _active_location_ids(db)
    products = (
        db.execute(select(Product).where(Product.show_on_site.is_(True)).order_by(Product.name))
        .scalars()
        .all()
    )

    out: list[CatalogPublicItem] = []
    for p in products:
        if not p.photos:
            continue
        primary = next((ph for ph in p.photos if ph.is_primary), p.photos[0])
        out.append(
            CatalogPublicItem(
                id=p.id,
                name=p.name,
                daily_price=float(p.daily_price),
                photo_url=primary.file_path,
                available=_total_available(db, p, active_locations),
                category=p.category.name if p.category else None,
                subtitle=p.subtitle,
                is_new=p.is_new,
            )
        )
    return out


@router.get("/catalog/public/{product_id}", response_model=CatalogPublicDetail)
def public_catalog_detail(product_id: int, db: Session = Depends(get_db)) -> CatalogPublicDetail:
    """Полная карточка для модалки: галерея, длинное описание, характеристики."""
    product = db.get(Product, product_id)
    if product is None or not product.show_on_site or not product.photos:
        raise HTTPException(status_code=404, detail="Товар не найден")
    return CatalogPublicDetail(
        id=product.id,
        name=product.name,
        subtitle=product.subtitle,
        description=product.description,
        daily_price=float(product.daily_price),
        available=_total_available(db, product, _active_location_ids(db)),
        category=product.category.name if product.category else None,
        is_new=product.is_new,
        photos=_ordered_photos(product),
        attributes=[ProductAttribute(**a) for a in (product.attributes or [])],
    )


@router.post("/weborders", response_model=WebOrderOut, status_code=201)
def create_web_order(body: WebOrderCreate, db: Session = Depends(get_db)) -> WebOrder:
    """Приём заявки с сайта: сохраняем и дублируем в Telegram (celery-таска)."""
    order = WebOrder(
        name=body.name,
        phone=body.phone,
        comment=body.comment,
        status=WebOrderStatus.NEW,
        items=[WebOrderItem(product_id=i.product_id, quantity=i.quantity) for i in body.items],
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    notify_web_order.delay(order.id)
    return order
