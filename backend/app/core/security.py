"""Хеширование паролей и работа с JWT."""

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings

ACCESS_TOKEN = "access"
REFRESH_TOKEN = "refresh"

# bcrypt ограничен 72 байтами — длинные пароли усечём детерминированно.
_BCRYPT_MAX_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to_bcrypt_bytes(plain), hashed.encode("utf-8"))
    except ValueError:
        return False


def _create_token(
    subject: str, token_type: str, expires: timedelta, extra: dict | None = None
) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str, role: str) -> str:
    return _create_token(
        subject,
        ACCESS_TOKEN,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        extra={"role": role},
    )


def create_refresh_token(subject: str) -> str:
    return _create_token(
        subject,
        REFRESH_TOKEN,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def create_short_token(subject: str, role: str, minutes: int = 5) -> str:
    """Короткоживущий access-токен — для идентификации сотрудника в MCP-запросах.

    Живёт минуты: его кладут в заголовок MCP-конфига на один диалог, дальше он
    не нужен. Тип — access, чтобы MCP-сервер валидировал так же, как обычные токены.
    """
    return _create_token(subject, ACCESS_TOKEN, timedelta(minutes=minutes), extra={"role": role})


def decode_token(token: str) -> dict:
    """Вернуть payload или бросить jwt.PyJWTError при невалидном токене."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
