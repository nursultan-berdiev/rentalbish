"""Чат-ассистент на Claude (Anthropic tool-use) поверх складских read-запросов.

Клиент задаёт вопрос на естественном языке («сколько свободных бокалов»,
«что просрочено», «долг клиента 0555»), модель вызывает нужные инструменты,
ассистент возвращает связный ответ. Инструменты — те же, что в MCP-сервере.
"""

import json
import logging

from sqlalchemy.orm import Session

from app.ai import analytics_tools, provider
from app.core.config import settings
from app.models.user import User
from app.services import warehouse_queries as wq

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Ты — ассистент сервиса аренды посуды Rentalbish. Отвечай кратко и по-русски. "
    "Используй инструменты, чтобы посмотреть актуальное состояние склада, не выдумывай числа. "
    "Если данных нет — так и скажи.\n"
    "Ты умеешь настраивать дашборд «Обзор»: считать аналитику и добавлять на него блоки. "
    "Перед любым расчётом или добавлением блока ОБЯЗАТЕЛЬНО вызови analytics_schema и бери "
    "имена наборов данных, разрезов и метрик только оттуда — выдумывать их нельзя. "
    "Если нужной метрики в словаре нет, честно скажи, что её нет, и предложи ближайшую.\n"
    "Когда пользователь просит добавить блок — СРАЗУ добавляй его через analytics_add_widget "
    "и коротко подтверждай, что готово. Не переспрашивай и не проси подтверждения. "
    "Наличие похожего или встроенного блока — НЕ повод отказываться: всё равно добавь "
    "запрошенный. Уточняй, только если из запроса совсем непонятно, какой набор/метрику "
    "взять и разумного варианта в словаре нет."
)

# Схемы инструментов для Anthropic API (совпадают с warehouse_queries).
TOOLS = [
    {
        "name": "search_products",
        "description": "Найти товары/комплекты по части названия (query пуст → все).",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
        },
    },
    {
        "name": "get_stock",
        "description": "Остатки по точкам: всего/забронировано/выдано/доступно.",
        "input_schema": {
            "type": "object",
            "properties": {
                "product_id": {"type": "integer"},
                "location_id": {"type": "integer"},
            },
        },
    },
    {
        "name": "get_available",
        "description": "Свободный остаток позиции на точке (учитывает комплекты).",
        "input_schema": {
            "type": "object",
            "properties": {
                "product_id": {"type": "integer"},
                "location_id": {"type": "integer"},
            },
            "required": ["product_id", "location_id"],
        },
    },
    {
        "name": "get_on_hands",
        "description": "Что сейчас на руках у клиентов.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_overdue",
        "description": "Просроченные возвраты с контактами клиентов.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_returns",
        "description": "Что вернулось за последние N дней.",
        "input_schema": {
            "type": "object",
            "properties": {"days": {"type": "integer"}},
        },
    },
    {
        "name": "get_client_debt",
        "description": "Долг клиента по номеру телефона.",
        "input_schema": {
            "type": "object",
            "properties": {"phone": {"type": "string"}},
            "required": ["phone"],
        },
    },
]


ALL_TOOLS = TOOLS + analytics_tools.TOOLS


def dispatch_tool(db: Session, name: str, tool_input: dict, user: User | None = None):
    """Выполнить инструмент по имени. Общая точка для чата и (потенциально) MCP.

    Пользователь передаётся из сессии запроса: роль для операций с дашбордом
    проверяется по нему, а не по тому, что модель написала в аргументах.
    """
    handler = analytics_tools.HANDLERS.get(name)
    if handler is not None:
        return handler(db, user, **tool_input)
    fn = getattr(wq, name, None)
    if fn is None:
        return {"error": f"Неизвестный инструмент: {name}"}
    return fn(db, **tool_input)


class AINotConfigured(Exception):
    """ANTHROPIC_API_KEY не задан — чат недоступен."""


def chat(
    db: Session,
    message: str,
    *,
    user: User | None = None,
    history: list[dict] | None = None,
    max_tool_rounds: int = 8,
) -> dict:
    """Провести один обмен: вопрос пользователя → ответ ассистента.

    ``history`` — прежние реплики диалога (``[{"role","content"}, ...]``), чтобы
    ассистент помнил контекст. Провайдер выбирается по ``settings.AI_BACKEND``:
    gateway (подписка, без инструментов) или api (Anthropic SDK, с инструментами).
    """
    if settings.AI_BACKEND == "gateway":
        prompt = provider.render_prompt(message, history)
        reply = provider.gateway_reply(prompt, SYSTEM_PROMPT, user=user)
        return {"reply": reply, "used_tools": []}

    return _chat_api(db, message, user=user, history=history, max_tool_rounds=max_tool_rounds)


def _chat_api(
    db: Session,
    message: str,
    *,
    user: User | None = None,
    history: list[dict] | None = None,
    max_tool_rounds: int = 8,
) -> dict:
    """Ветка Anthropic SDK с tool-use (нужен ANTHROPIC_API_KEY)."""
    if not settings.ANTHROPIC_API_KEY:
        raise AINotConfigured("ANTHROPIC_API_KEY не задан")

    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    messages: list[dict] = [{"role": t["role"], "content": t["content"]} for t in (history or [])]
    messages.append({"role": "user", "content": message})
    used_tools: list[str] = []

    for _ in range(max_tool_rounds):
        resp = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=ALL_TOOLS,
            messages=messages,
        )
        if resp.stop_reason != "tool_use":
            text = "".join(block.text for block in resp.content if block.type == "text")
            return {"reply": text, "used_tools": used_tools}

        messages.append({"role": "assistant", "content": resp.content})
        tool_results = []
        for block in resp.content:
            if block.type == "tool_use":
                used_tools.append(block.name)
                result = dispatch_tool(db, block.name, dict(block.input), user=user)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result, ensure_ascii=False, default=str),
                    }
                )
        messages.append({"role": "user", "content": tool_results})

    return {
        "reply": "Не удалось получить ответ за отведённое число шагов.",
        "used_tools": used_tools,
    }
