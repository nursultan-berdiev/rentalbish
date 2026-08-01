"""ИИ-чат: история диалогов, изоляция по сотруднику, провайдер замокан."""

import pytest


@pytest.fixture
def fake_gateway(monkeypatch):
    """Подменяем вызов claude-gateway: возвращаем канон, копим prompt'ы."""
    calls: list[str] = []

    def fake(prompt: str, system_prompt: str | None, *, user=None) -> str:
        calls.append(prompt)
        return "Готово."

    monkeypatch.setattr("app.ai.provider.gateway_reply", fake)
    return calls


def test_chat_creates_conversation(client, auth_headers, fake_gateway):
    r = client.post("/api/v1/ai/chat", headers=auth_headers, json={"message": "привет"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reply"] == "Готово."
    assert isinstance(body["conversation_id"], int)


def test_second_message_gets_history(client, auth_headers, fake_gateway):
    first = client.post(
        "/api/v1/ai/chat", headers=auth_headers, json={"message": "сколько тарелок"}
    ).json()
    cid = first["conversation_id"]
    client.post(
        "/api/v1/ai/chat",
        headers=auth_headers,
        json={"message": "а бокалов", "conversation_id": cid},
    )
    # во втором запросе провайдер получил историю первого
    assert "сколько тарелок" in fake_gateway[1]
    assert "Готово." in fake_gateway[1]  # прошлый ответ ассистента тоже в контексте


def test_conversation_messages_persisted(client, auth_headers, fake_gateway):
    cid = client.post("/api/v1/ai/chat", headers=auth_headers, json={"message": "вопрос"}).json()[
        "conversation_id"
    ]
    msgs = client.get(f"/api/v1/ai/conversations/{cid}", headers=auth_headers).json()
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert msgs[0]["content"] == "вопрос"
    assert msgs[1]["content"] == "Готово."


def test_list_conversations_only_own(client, auth_headers, staff_headers, fake_gateway):
    cid = client.post("/api/v1/ai/chat", headers=auth_headers, json={"message": "мой чат"}).json()[
        "conversation_id"
    ]
    # у другого сотрудника этого чата в списке нет
    other = client.get("/api/v1/ai/conversations", headers=staff_headers).json()
    assert all(c["id"] != cid for c in other)
    mine = client.get("/api/v1/ai/conversations", headers=auth_headers).json()
    assert any(c["id"] == cid and c["title"] == "мой чат" for c in mine)


def test_foreign_conversation_is_404(client, auth_headers, staff_headers, fake_gateway):
    cid = client.post("/api/v1/ai/chat", headers=auth_headers, json={"message": "секрет"}).json()[
        "conversation_id"
    ]
    # чужой чат — 404 (не 403: не подтверждаем существование)
    assert client.get(f"/api/v1/ai/conversations/{cid}", headers=staff_headers).status_code == 404
    assert (
        client.post(
            "/api/v1/ai/chat",
            headers=staff_headers,
            json={"message": "влезаю", "conversation_id": cid},
        ).status_code
        == 404
    )


def test_delete_removes_conversation_and_messages(client, auth_headers, fake_gateway):
    cid = client.post("/api/v1/ai/chat", headers=auth_headers, json={"message": "удалю"}).json()[
        "conversation_id"
    ]
    assert client.delete(f"/api/v1/ai/conversations/{cid}", headers=auth_headers).status_code == 204
    assert client.get(f"/api/v1/ai/conversations/{cid}", headers=auth_headers).status_code == 404
    assert client.get("/api/v1/ai/conversations", headers=auth_headers).json() == []


def test_provider_error_keeps_history_clean(client, auth_headers, monkeypatch):
    """Если провайдер упал — ничего не сохраняем (нет вопросов без ответов)."""
    from app.ai.provider import AIProviderError

    def boom(prompt, system_prompt, *, user=None):
        raise AIProviderError("шлюз лёг")

    monkeypatch.setattr("app.ai.provider.gateway_reply", boom)
    r = client.post("/api/v1/ai/chat", headers=auth_headers, json={"message": "упадёт"})
    assert r.status_code == 503
    assert client.get("/api/v1/ai/conversations", headers=auth_headers).json() == []
