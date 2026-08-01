"""Виджеты дашборда: блок аналитики как спецификация в БД.

Сами встроенные блоки не сидируются миграцией — их синхронизирует приложение при
старте (app.core.init_db.seed_dashboard), чтобы спеки жили в одном месте, в коде.

Revision ID: 0003_dashboard_widgets
Revises: 0002_stage1_core_domain
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0003_dashboard_widgets"
down_revision: str | None = "0002_stage1_core_domain"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dashboard_widgets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=True),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("chart", sa.String(length=32), nullable=False),
        sa.Column("spec", sa.JSON(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_dashboard_widget_key"),
    )


def downgrade() -> None:
    op.drop_table("dashboard_widgets")
