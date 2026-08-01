"""ИИ-чат по складу (глобальная панель web-admin) + история диалогов.

Требует роль staff. Провайдер (gateway | api) выбирается в chat(). История
привязана к сотруднику: чужой чат недоступен (404, чтобы не подтверждать факт).
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.chat import AINotConfigured, chat
from app.ai.provider import AIProviderError
from app.api.deps import require_staff
from app.db.session import get_db
from app.models.ai import AiConversation, AiMessage
from app.models.enums import MessageRole
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(require_staff)])


class ChatRequest(BaseModel):
    message: str
    conversation_id: int | None = None


class ChatResponse(BaseModel):
    conversation_id: int
    reply: str
    used_tools: list[str] = []


class ConversationOut(BaseModel):
    id: int
    title: str
    updated_at: datetime


class MessageOut(BaseModel):
    role: MessageRole
    content: str
    used_tools: list[str] = []


def _get_owned(db: Session, conversation_id: int, user: User) -> AiConversation:
    """Чат текущего сотрудника или 404 (чужой не подтверждаем)."""
    conv = db.get(AiConversation, conversation_id)
    if conv is None or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Чат не найден")
    return conv


@router.post("/chat", response_model=ChatResponse)
def ai_chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> ChatResponse:
    conv = _get_owned(db, body.conversation_id, current) if body.conversation_id else None

    history = [{"role": m.role.value, "content": m.content} for m in conv.messages] if conv else []

    try:
        result = chat(db, body.message, user=current, history=history)
    except AINotConfigured as exc:
        raise HTTPException(
            status_code=503, detail="ИИ-ассистент не настроен (нет ANTHROPIC_API_KEY)"
        ) from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=503, detail="ИИ-ассистент временно недоступен") from exc

    # Сохраняем только после успешного ответа — иначе в истории осели бы
    # вопросы без ответов.
    if conv is None:
        conv = AiConversation(user_id=current.id, title=body.message[:120])
        db.add(conv)
        db.flush()
    conv.messages.append(AiMessage(role=MessageRole.USER, content=body.message, used_tools=[]))
    conv.messages.append(
        AiMessage(
            role=MessageRole.ASSISTANT,
            content=result["reply"],
            used_tools=result.get("used_tools", []),
        )
    )
    db.commit()
    db.refresh(conv)

    return ChatResponse(
        conversation_id=conv.id, reply=result["reply"], used_tools=result.get("used_tools", [])
    )


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> list[AiConversation]:
    return list(
        db.execute(
            select(AiConversation)
            .where(AiConversation.user_id == current.id)
            .order_by(AiConversation.updated_at.desc())
        )
        .scalars()
        .all()
    )


@router.get("/conversations/{conversation_id}", response_model=list[MessageOut])
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> list[AiMessage]:
    return _get_owned(db, conversation_id, current).messages


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_staff),
) -> None:
    conv = _get_owned(db, conversation_id, current)
    db.delete(conv)
    db.commit()
