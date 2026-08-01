"""Настройки сайта (singleton): режим обслуживания + номер WhatsApp.

Заводим таблицу site_settings с единственной строкой (id=1). Стартовое состояние —
режим обслуживания ВКЛЮЧЁН (витрина показывает заставку «Скоро открытие»), номер
WhatsApp засевается текущим значением из фронта.

Revision ID: 0007_site_settings
Revises: 0006_ai_conversations
"""

import sqlalchemy as sa

from alembic import op

revision: str = "0007_site_settings"
down_revision: str | None = "0006_ai_conversations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("maintenance_mode", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "whatsapp_phone",
            sa.String(length=32),
            nullable=False,
            server_default="996552080610",
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Singleton-строка с дефолтами (заглушка включена, номер — текущий).
    op.execute(
        "INSERT INTO site_settings (id, maintenance_mode, whatsapp_phone) "
        "VALUES (1, true, '996552080610')"
    )


def downgrade() -> None:
    op.drop_table("site_settings")
