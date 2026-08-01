"""Схемы каталога: категории, товары, фото, комплекты."""

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ProductType


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ProductPhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_path: str
    is_primary: bool


class SetItemIn(BaseModel):
    component_id: int
    quantity: int = Field(gt=0)


class SetItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    component_id: int
    quantity: int


class ProductAttribute(BaseModel):
    """Строка таблицы характеристик товара в модалке."""

    label: str
    value: str


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category_id: int | None = None
    sku: str | None = Field(default=None, max_length=64)
    type: ProductType = ProductType.ITEM
    unit: str = "шт"
    subtitle: str = ""
    description: str = ""
    attributes: list[ProductAttribute] = []
    deposit_price: float = 0
    daily_price: float = 0
    show_on_site: bool = False
    is_new: bool = False


class ProductCreate(ProductBase):
    # Для комплекта (type=set) — состав; для товара игнорируется.
    components: list[SetItemIn] = []


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category_id: int | None = None
    sku: str | None = None
    unit: str | None = None
    subtitle: str | None = None
    description: str | None = None
    attributes: list[ProductAttribute] | None = None
    deposit_price: float | None = None
    daily_price: float | None = None
    show_on_site: bool | None = None
    is_new: bool | None = None
    components: list[SetItemIn] | None = None


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    photos: list[ProductPhotoOut] = []
    components: list[SetItemOut] = []


class CatalogPublicItem(BaseModel):
    """Карточка витрины — контракт web-site/api.ts (список каталога)."""

    id: int
    name: str
    daily_price: float
    photo_url: str | None = None
    available: int
    # Категория — для чипов-фильтров; subtitle — строка под названием;
    # is_new — бейдж «Новинка».
    category: str | None = None
    subtitle: str = ""
    is_new: bool = False


class CatalogPublicDetail(BaseModel):
    """Полная карточка для модалки товара: галерея, описание, характеристики."""

    id: int
    name: str
    subtitle: str = ""
    description: str = ""
    daily_price: float
    available: int
    category: str | None = None
    is_new: bool = False
    photos: list[str] = []
    attributes: list[ProductAttribute] = []
