"""Сид первичных данных: создание администратора при пустой таблице пользователей."""

import logging

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.models.user import User

logger = logging.getLogger(__name__)


def seed_first_admin() -> None:
    with SessionLocal() as db:
        exists = db.execute(select(User.id).limit(1)).first()
        if exists:
            return
        admin = User(
            login=settings.FIRST_ADMIN_LOGIN,
            full_name="Администратор",
            role=UserRole.ADMIN,
            password_hash=hash_password(settings.FIRST_ADMIN_PASSWORD),
        )
        db.add(admin)
        db.commit()
        logger.info("Создан первичный администратор: %s", settings.FIRST_ADMIN_LOGIN)
