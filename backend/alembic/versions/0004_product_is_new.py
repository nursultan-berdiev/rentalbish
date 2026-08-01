"""Ручной бейдж «Новинка» у товара.

Раньше признак «новинки» вычислялся по дате создания (created_at ≤ 30 дней), но
это красит новинкой любой недавно заведённый товар. Оператору нужен явный флаг,
совпадающий с макетом витрины, поэтому заводим колонку products.is_new.

Revision ID: 0004_product_is_new
Revises: 0003_dashboard_widgets
"""

import sqlalchemy as sa

from alembic import op

revision: str = "0004_product_is_new"
down_revision: str | None = "0003_dashboard_widgets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("is_new", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("products", "is_new")
