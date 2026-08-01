"""Поля товара для детальной модалки: подзаголовок и характеристики.

Модалка товара на витрине показывает короткий подзаголовок (строка над ценой),
длинное описание (уже есть в description) и таблицу характеристик. Заводим
products.subtitle и products.attributes (гибкий JSON-список пар label/value).

Revision ID: 0005_product_detail_fields
Revises: 0004_product_is_new
"""

import sqlalchemy as sa

from alembic import op

revision: str = "0005_product_detail_fields"
down_revision: str | None = "0004_product_is_new"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("subtitle", sa.String(length=255), nullable=False, server_default=""),
    )
    op.add_column(
        "products",
        sa.Column("attributes", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("products", "attributes")
    op.drop_column("products", "subtitle")
