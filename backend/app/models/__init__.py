"""Реестр моделей. Импорт здесь нужен, чтобы Alembic видел все таблицы в Base.metadata."""

from app.db.base import Base
from app.models.ai import AiConversation, AiMessage
from app.models.audit import AuditLog
from app.models.booking import (
    Booking,
    BookingItem,
    Client,
    Issue,
    IssueItem,
    Return,
    ReturnItem,
)
from app.models.catalog import Category, Product, ProductPhoto, SetItem
from app.models.dashboard import DashboardWidget
from app.models.inventory import Stock, Supply, WriteOff
from app.models.location import Location, user_locations
from app.models.site import SiteSettings
from app.models.user import User
from app.models.weborder import WebOrder, WebOrderItem

__all__ = [
    "Base",
    "User",
    "Location",
    "user_locations",
    "Category",
    "Product",
    "ProductPhoto",
    "SetItem",
    "Stock",
    "Supply",
    "WriteOff",
    "Client",
    "Booking",
    "BookingItem",
    "Issue",
    "IssueItem",
    "Return",
    "ReturnItem",
    "WebOrder",
    "WebOrderItem",
    "AuditLog",
    "DashboardWidget",
    "AiConversation",
    "AiMessage",
    "SiteSettings",
]
