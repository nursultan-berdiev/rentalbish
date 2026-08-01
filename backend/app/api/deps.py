"""Общие FastAPI-зависимости: текущий пользователь, проверка роли, выборка-или-404."""

from typing import TypeVar

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import ACCESS_TOKEN, decode_token
from app.db.base import Base
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User

M = TypeVar("M", bound=Base)


def get_or_404(db: Session, model: type[M], obj_id: int, not_found: str) -> M:
    """Достать запись по id или бросить 404 с готовым сообщением."""
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=not_found)
    return obj


oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Не удалось проверить учётные данные",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = decode_token(token)
        if payload.get("type") != ACCESS_TOKEN:
            raise _credentials_exc
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _credentials_exc from None

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _credentials_exc
    return user


def require_roles(*roles: UserRole):
    """Фабрика зависимости: доступ только для указанных ролей."""

    def _checker(current: User = Depends(get_current_user)) -> User:
        if current.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
        return current

    return _checker


require_admin = require_roles(UserRole.ADMIN)
require_staff = require_roles(UserRole.ADMIN, UserRole.STAFF)
