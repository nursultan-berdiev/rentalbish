"""Общие фикстуры тестов.

По умолчанию используется SQLite в памяти (быстро, без внешних сервисов).
Чтобы прогнать на Postgres (для проверок блокировок FOR UPDATE в Этапе 1),
задайте TEST_DATABASE_URL.
"""

import os

# Указываем SQLite ДО импорта приложения, чтобы модульный движок не тянул psycopg2.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.deps import get_current_user  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.models.user import User  # noqa: E402

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")


@pytest.fixture
def engine():
    if TEST_DATABASE_URL.startswith("sqlite"):
        eng = create_engine(
            TEST_DATABASE_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    else:
        eng = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture
def db(engine):
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(engine, db):
    """TestClient с подменённой сессией БД (без сида администратора)."""

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    # Без контекст-менеджера: lifespan (сид админа в реальный Postgres) не запускается.
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db) -> User:
    user = User(
        login="admin",
        full_name="Администратор",
        role=UserRole.ADMIN,
        password_hash=hash_password("admin123"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(client, admin_user) -> dict[str, str]:
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# get_current_user используется как есть; при необходимости тесты могут переопределить.
__all__ = ["get_current_user"]
