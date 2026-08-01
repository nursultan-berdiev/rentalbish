"""История ИИ-чатов: диалоги сотрудника и его реплики.

Хранятся только реплики человека и финальные ответы ассистента — промежуточные
tool-вызовы не сохраняем. Диалог привязан к сотруднику; чужой чат недоступен.
"""

from typing import Any

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, enum_type
from app.models.enums import MessageRole


class AiConversation(Base, TimestampMixin):
    __tablename__ = "ai_conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Заголовок для списка чатов — из первого вопроса.
    title: Mapped[str] = mapped_column(String(120), default="", nullable=False)

    messages: Mapped[list["AiMessage"]] = relationship(
        "AiMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AiMessage.id",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AiConversation {self.id} u{self.user_id}>"


class AiMessage(Base, TimestampMixin):
    __tablename__ = "ai_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[MessageRole] = mapped_column(enum_type(MessageRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    used_tools: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)

    conversation: Mapped[AiConversation] = relationship("AiConversation", back_populates="messages")
