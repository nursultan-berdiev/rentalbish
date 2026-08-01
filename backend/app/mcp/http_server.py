"""MCP-сервер по HTTP: те же инструменты ассистента, но для claude-gateway.

Шлюз запускает `claude -p`, а CLI ходит сюда за инструментами. Личность сотрудника
приходит в заголовке Authorization (короткоживущий JWT, выпускает провайдер на
каждый диалог): middleware достаёт её в contextvar, инструменты берут пользователя
оттуда. Роль (админ/сотрудник) проверяется здесь, на сервере, — не со слов модели.

Транспорт — streamable-http в stateless-режиме: каждый запрос обрабатывается в
контексте своего HTTP-запроса, поэтому contextvar из middleware виден в инструменте
(проверено). Инструменты исполняются через общий dispatch_tool — один реестр на чат
и MCP.
"""

import contextvars
import json
import logging

import jwt
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.base import BaseHTTPMiddleware

from app.ai.chat import dispatch_tool
from app.core.security import ACCESS_TOKEN, decode_token
from app.db.session import SessionLocal
from app.models.user import User

logger = logging.getLogger(__name__)

# id сотрудника текущего MCP-запроса (ставит middleware из JWT).
_current_uid: contextvars.ContextVar[int | None] = contextvars.ContextVar("mcp_uid", default=None)

# Внутренний сервис в приватной сети claude_net — защиту от DNS-rebinding
# (проверку Host/Origin) отключаем, иначе доступ по имени контейнера даёт 421.
mcp = FastMCP(
    "rentalbish",
    stateless_http=True,
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


def _run(name: str, args: dict) -> str:
    """Выполнить инструмент от лица текущего сотрудника, вернуть JSON-текст."""
    uid = _current_uid.get()
    with SessionLocal() as db:
        user = db.get(User, uid) if uid else None
        result = dispatch_tool(db, name, args, user=user)
    return json.dumps(result, ensure_ascii=False, default=str)


# --- Склад (read) ---
@mcp.tool()
def search_products(query: str = "") -> str:
    """Найти товары/комплекты по части названия (query пуст → все)."""
    return _run("search_products", {"query": query})


@mcp.tool()
def get_stock(product_id: int | None = None, location_id: int | None = None) -> str:
    """Остатки по точкам: всего/забронировано/выдано/доступно."""
    return _run("get_stock", {"product_id": product_id, "location_id": location_id})


@mcp.tool()
def get_available(product_id: int, location_id: int) -> str:
    """Свободный остаток позиции на точке (учитывает комплекты)."""
    return _run("get_available", {"product_id": product_id, "location_id": location_id})


@mcp.tool()
def get_on_hands() -> str:
    """Что сейчас на руках у клиентов."""
    return _run("get_on_hands", {})


@mcp.tool()
def get_overdue() -> str:
    """Просроченные возвраты с контактами клиентов."""
    return _run("get_overdue", {})


@mcp.tool()
def get_returns(days: int = 7) -> str:
    """Что вернулось за последние N дней."""
    return _run("get_returns", {"days": days})


@mcp.tool()
def get_client_debt(phone: str) -> str:
    """Долг клиента по номеру телефона."""
    return _run("get_client_debt", {"phone": phone})


# --- Аналитика дашборда ---
_SPEC_HINT = (
    "Спека блока: {title, chart, span (1-3), compare, query:{dataset, measures[], dimensions[], "
    "filters[{field,op,value}], order_by, limit}, series:[{measure,label,color,type,axis}]}. "
    "Типы графика: kpi, line, area, bar, combo, stacked_bar, hbar, donut, table. "
    "Все имена dataset/measures/dimensions обязаны быть из analytics_schema."
)


@mcp.tool()
def analytics_schema() -> str:
    """Словарь аналитики (наборы, разрезы, метрики). Вызывай ПЕРВЫМ: имена нельзя выдумывать."""
    return _run("analytics_schema", {})


@mcp.tool()
def analytics_query(query: dict, days: int = 30, location_id: int | None = None) -> str:
    """Посчитать данные по спеке (без сохранения блока). QuerySpec = query. """ + _SPEC_HINT
    return _run("analytics_query", {"query": query, "days": days, "location_id": location_id})


@mcp.tool()
def analytics_list_widgets() -> str:
    """Показать блоки, которые сейчас есть на дашборде «Обзор»."""
    return _run("analytics_list_widgets", {})


@mcp.tool()
def analytics_add_widget(widget: dict) -> str:
    """Добавить блок на дашборд «Обзор» (только админ). WidgetSpec = widget. """ + _SPEC_HINT
    return _run("analytics_add_widget", {"widget": widget})


@mcp.tool()
def analytics_remove_widget(widget_id: int) -> str:
    """Удалить блок дашборда по id (только админ). Встроенные блоки нельзя — только скрыть."""
    return _run("analytics_remove_widget", {"widget_id": widget_id})


class _AuthMiddleware(BaseHTTPMiddleware):
    """Достаёт сотрудника из Authorization: Bearer <короткий JWT> в contextvar."""

    async def dispatch(self, request, call_next):
        uid: int | None = None
        auth = request.headers.get("authorization", "")
        token = auth.removeprefix("Bearer ").removeprefix("bearer ").strip()
        if token:
            try:
                payload = decode_token(token)
                if payload.get("type") == ACCESS_TOKEN:
                    uid = int(payload["sub"])
            except (jwt.PyJWTError, KeyError, ValueError):
                uid = None
        _current_uid.set(uid)
        return await call_next(request)


app = mcp.streamable_http_app()
app.add_middleware(_AuthMiddleware)
