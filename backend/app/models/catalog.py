"""Каталог: категории, товары, фото, состав комплектов."""

from decimal import Decimal

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, enum_type
from app.models.enums import ProductType


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Category {self.name}>"


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    sku: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    type: Mapped[ProductType] = mapped_column(
        enum_type(ProductType), default=ProductType.ITEM, nullable=False
    )
    unit: Mapped[str] = mapped_column(String(32), default="шт", nullable=False)
    # Короткая строка карточки (напр. «Обеденная · фарфор · золотой кант»).
    subtitle: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    # Длинный абзац для детальной модалки.
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Характеристики для таблицы в модалке: [{"label": "Материал", "value": "Фарфор"}, …].
    attributes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    # Залоговая (закупочная) стоимость единицы — база для расчёта удержания за бой.
    deposit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    # Суточная цена аренды за единицу.
    daily_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    show_on_site: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Ручной бейдж «Новинка» на витрине — проставляет оператор, а не дата создания.
    is_new: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    category: Mapped[Category | None] = relationship("Category", lazy="joined")
    photos: Mapped[list["ProductPhoto"]] = relationship(
        "ProductPhoto",
        back_populates="product",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProductPhoto.id",
    )
    # Состав комплекта (заполнено только у type == SET).
    components: Mapped[list["SetItem"]] = relationship(
        "SetItem",
        back_populates="set_product",
        foreign_keys="SetItem.set_id",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Product {self.name} ({self.type.value})>"


class ProductPhoto(Base, TimestampMixin):
    __tablename__ = "product_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    product: Mapped[Product] = relationship("Product", back_populates="photos")


class SetItem(Base):
    """Строка состава комплекта: сколько единиц компонента входит в 1 набор."""

    __tablename__ = "set_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    set_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    component_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    set_product: Mapped[Product] = relationship(
        "Product", foreign_keys=[set_id], back_populates="components"
    )
    component: Mapped[Product] = relationship("Product", foreign_keys=[component_id], lazy="joined")
