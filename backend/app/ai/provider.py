"""Провайдеры модели для ИИ-ассистента.

Два пути:
- ``api``     — прямой Anthropic SDK с инструментами (цикл живёт в ``chat.py``).
- ``gateway`` — сервис claude-gateway (работа на подписке, ключ не нужен). Шлюз
  одноразовый и без инструментов, поэтому сюда уходит уже склеенная переписка,
  а назад приходит только текст.

Здесь — только gateway-ветка (HTTP-клиент). Выбор провайдера — в ``chat.py``.
"""

import logging

import httpx

from app.core.config import settings
from app.core.security import create_short_token
from app.models.user import User

logger = logging.getLogger(__name__)


class AIProviderError(Exception):
    """Сбой обращения к провайдеру модели (сеть, таймаут, ошибка шлюза)."""


def _mcp_config(user: User | None) -> dict | None:
    """Конфиг MCP-сервера rentalbish для CLI шлюза — с личностью сотрудника.

    Личность кладём в короткоживущий JWT в заголовке: MCP-сервер достаёт из него
    пользователя и проверяет роль сам. Без пользователя инструменты не даём.
    """
    if not (settings.AI_TOOLS_VIA_MCP and settings.MCP_SELF_URL and user is not None):
        return None
    token = create_short_token(str(user.id), user.role.value)
    return {
        "mcpServers": {
            "rentalbish": {
                "type": "http",
                "url": settings.MCP_SELF_URL,
                "headers": {"Authorization": f"Bearer {token}"},
            }
        }
    }


def render_prompt(message: str, history: list[dict] | None) -> str:
    """Склеивает переписку в один prompt для одноходового шлюза.

    ``history`` — прежние реплики в хронологии: ``[{"role","content"}, ...]``.
    Роль system уходит отдельным флагом ``--system-prompt`` (см. gateway_reply),
    поэтому здесь только диалог человека и ассистента.
    """
    lines: list[str] = []
    for turn in history or []:
        who = "Ассистент" if turn.get("role") == "assistant" else "Пользователь"
        lines.append(f"{who}: {turn.get('content', '')}")
    lines.append(f"Пользователь: {message}")
    lines.append("Ассистент:")
    return "\n".join(lines)


def gateway_reply(prompt: str, system_prompt: str | None, *, user: User | None = None) -> str:
    """Один вызов claude-gateway ``POST /v1/prompt`` → текст ответа.

    Если включены инструменты (AI_TOOLS_VIA_MCP), прокидываем наш MCP-сервер —
    тогда CLI шлюза сам сходит за реальными данными склада/аналитики.
    """
    url = settings.CLAUDE_GATEWAY_URL.rstrip("/") + "/v1/prompt"
    headers = {}
    if settings.CLAUDE_GATEWAY_API_KEY:
        headers["Authorization"] = f"Bearer {settings.CLAUDE_GATEWAY_API_KEY}"
    payload: dict = {
        "prompt": prompt,
        "system_prompt": system_prompt,
        "model": settings.CLAUDE_GATEWAY_MODEL,
        "timeout": settings.CLAUDE_GATEWAY_TIMEOUT,
    }
    mcp = _mcp_config(user)
    if mcp is not None:
        payload["mcp_servers"] = mcp
        payload["allowed_tools"] = ["mcp__rentalbish"]
    try:
        resp = httpx.post(
            url,
            json=payload,
            headers=headers,
            # Холодный старт claude -p долгий — даём запас над внутренним таймаутом.
            timeout=settings.CLAUDE_GATEWAY_TIMEOUT + 20,
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("claude-gateway недоступен: %s", exc)
        raise AIProviderError(f"claude-gateway недоступен: {exc}") from exc

    if data.get("is_error"):
        raise AIProviderError(f"claude-gateway вернул ошибку: {data.get('text', '')[:200]}")
    return str(data.get("text") or "").strip()
