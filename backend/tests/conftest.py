"""Общие фикстуры тестов.

По умолчанию используется SQLite в памяти (быстро, без внешних сервисов).
Чтобы прогнать на Postgres (для проверок блокировок FOR UPDATE в Этапе 1),
задайте TEST_DATABASE_URL.
"""

import os

# Указываем SQLite ДО импорта приложения, чтобы модульный движок не тянул psycopg2.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
# Celery-задачи выполняем синхронно (без Redis) — для тестов приёма заявок и импорта.
os.environ.setdefault("CELERY_ALWAYS_EAGER", "1")

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


def _guard_not_a_real_database(url: str) -> None:
    """Предохранитель: фикстура engine делает drop_all — на рабочей БД это её стирает.

    Один раз уже стёрли dev-базу, перепутав `rental` и `rental_test`. Имя базы для
    тестов обязано заканчиваться на _test — иначе падаем до того, как что-то удалим.
    """
    if url.startswith("sqlite"):
        return
    name = url.rsplit("/", 1)[-1].split("?")[0]
    if not name.endswith("_test"):
        raise RuntimeError(
            f"TEST_DATABASE_URL указывает на базу «{name}», а тесты делают drop_all. "
            "Имя тестовой базы должно заканчиваться на _test (например, rental_test)."
        )


_guard_not_a_real_database(TEST_DATABASE_URL)


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


@pytest.fixture
def staff_user(db) -> User:
    user = User(
        login="staff1",
        full_name="Сотрудник",
        role=UserRole.STAFF,
        password_hash=hash_password("staff123"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def staff_headers(client, staff_user) -> dict[str, str]:
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "staff1", "password": "staff123"},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# get_current_user используется как есть; при необходимости тесты могут переопределить.
__all__ = ["get_current_user"]
