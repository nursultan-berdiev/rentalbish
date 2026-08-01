"""Виджеты дашборда: блок аналитики хранится как спецификация, а не как код.

Поэтому ИИ-ассистент может добавить блок прямо в проде, без деплоя. Встроенные
блоки (is_builtin) объявлены в app/analytics/builtin.py и синхронизируются в эту
таблицу при старте: их можно скрыть и переставить, но не удалить.
"""

from typing import Any

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class DashboardWidget(Base, TimestampMixin):
    __tablename__ = "dashboard_widgets"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Стабильный ключ встроенного блока (у созданных ИИ — NULL).
    key: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    chart: Mapped[str] = mapped_column(String(32), nullable=False)
    spec: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<DashboardWidget {self.key or self.id} {self.chart}>"
