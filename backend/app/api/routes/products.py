"""Товары и комплекты (справочник каталога) + загрузка фото."""

import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_or_404, require_admin, require_staff
from app.core.config import settings
from app.core.constants import XLSX_MIME
from app.db.session import get_db
from app.models.catalog import Product, ProductPhoto, SetItem
from app.models.enums import ProductType
from app.models.user import User
from app.schemas.catalog import ProductCreate, ProductOut, ProductUpdate
from app.services import excel_import

router = APIRouter(prefix="/products", tags=["products"])

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
NOT_FOUND = "Товар не найден"


def _apply_components(db: Session, product: Product, components: list) -> None:
    """Пересобрать состав комплекта из списка SetItemIn."""
    product.components.clear()
    db.flush()
    for c in components:
        if c.component_id == product.id:
            raise HTTPException(status_code=400, detail="Комплект не может включать сам себя")
        if db.get(Product, c.component_id) is None:
            raise HTTPException(status_code=400, detail=f"Компонент id={c.component_id} не найден")
        product.components.append(SetItem(component_id=c.component_id, quantity=c.quantity))


@router.get("/import/template", dependencies=[Depends(require_staff)])
def download_template() -> Response:
    """Скачать пустой Excel-шаблон для массового заведения товаров."""
    return Response(
        content=excel_import.build_template(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": "attachment; filename=products_template.xlsx"},
    )


@router.post("/import/preview", dependencies=[Depends(require_staff)])
def preview_import(file: UploadFile = File(...)) -> dict:
    """Разобрать загруженный файл и показать строки/ошибки без сохранения."""
    parsed = excel_import.parse(file.file.read())
    return {
        # parsed — сколько строк реально импортируется (валидные); в rows отдаём ВСЕ
        # строки, битые помечены полем error, чтобы показать их в предпросмотре.
        "parsed": sum(1 for r in parsed.rows if r.error is None),
        "errors": parsed.errors,
        "rows": [
            {
                "row_number": r.row_number,
                "name": r.name,
                "category": r.category,
                "sku": r.sku,
                "unit": r.unit,
                "deposit_price": float(r.deposit_price),
                "daily_price": float(r.daily_price),
                "show_on_site": r.show_on_site,
                "error": r.error,
            }
            for r in parsed.rows
        ],
    }


@router.post("/import/commit", dependencies=[Depends(require_staff)])
def commit_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> dict:
    """Разобрать и создать/обновить товары из файла."""
    parsed = excel_import.parse(file.file.read())
    valid = [r for r in parsed.rows if r.error is None]
    created = excel_import.create_products(db, valid, user_id=current.id)
    return {"created": created, "parsed": len(valid), "errors": parsed.errors}


@router.get("", response_model=list[ProductOut], dependencies=[Depends(require_staff)])
def list_products(
    type: ProductType | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
) -> list[Product]:
    stmt = select(Product).order_by(Product.name)
    if type is not None:
        stmt = stmt.where(Product.type == type)
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    return list(db.execute(stmt).scalars().all())


@router.get("/{product_id}", response_model=ProductOut, dependencies=[Depends(require_staff)])
def get_product(product_id: int, db: Session = Depends(get_db)) -> Product:
    return get_or_404(db, Product, product_id, NOT_FOUND)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
) -> Product:
    data = body.model_dump(exclude={"components"})
    product = Product(**data, created_by_id=current.id)
    db.add(product)
    db.flush()
    if product.type == ProductType.SET:
        _apply_components(db, product, body.components)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut, dependencies=[Depends(require_admin)])
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db)) -> Product:
    product = get_or_404(db, Product, product_id, NOT_FOUND)
    data = body.model_dump(exclude_unset=True, exclude={"components"})
    for field, value in data.items():
        setattr(product, field, value)
    if body.components is not None and product.type == ProductType.SET:
        _apply_components(db, product, body.components)
    db.commit()
    db.refresh(product)
    return product


@router.post(
    "/{product_id}/photos",
    response_model=ProductOut,
    dependencies=[Depends(require_staff)],
)
def upload_photo(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> Product:
    """Загрузка фото товара (в т.ч. с камеры телефона). Файл кладётся в media/."""
    product = get_or_404(db, Product, product_id, NOT_FOUND)
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Поддерживаются только JPEG/PNG/WebP")

    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    photos_dir = os.path.join(settings.MEDIA_ROOT, "products")
    os.makedirs(photos_dir, exist_ok=True)
    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = os.path.join(photos_dir, fname)
    with open(fpath, "wb") as out:
        out.write(file.file.read())

    rel_url = f"{settings.MEDIA_URL}/products/{fname}"
    is_first = len(product.photos) == 0
    product.photos.append(ProductPhoto(file_path=rel_url, is_primary=is_first))
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}/photos/{photo_id}", response_model=ProductOut)
def delete_photo(
    product_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
) -> Product:
    """Удалить фото товара. Если удалили главное — главным становится первое из оставшихся."""
    product = get_or_404(db, Product, product_id, NOT_FOUND)
    photo = next((p for p in product.photos if p.id == photo_id), None)
    if photo is None:
        raise HTTPException(status_code=404, detail="Фото не найдено")

    was_primary = photo.is_primary
    product.photos.remove(photo)
    db.flush()
    if was_primary and product.photos:
        product.photos[0].is_primary = True
    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/photos/{photo_id}/primary", response_model=ProductOut)
def set_primary_photo(
    product_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
) -> Product:
    """Назначить фото главным — именно оно показывается на сайте."""
    product = get_or_404(db, Product, product_id, NOT_FOUND)
    if not any(p.id == photo_id for p in product.photos):
        raise HTTPException(status_code=404, detail="Фото не найдено")
    for p in product.photos:
        p.is_primary = p.id == photo_id
    db.commit()
    db.refresh(product)
    return product
