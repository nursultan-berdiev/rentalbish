# Rentalbish — сервис аренды посуды

Учёт склада по нескольким точкам, брони, выдачи/возвраты, бой, посуточный расчёт,
публичный сайт-витрина, Telegram-уведомления и ИИ-ассистент (Claude/MCP).

Функциональные требования: [ФТ_полное.md](ФТ_полное.md), [ФТ_краткое.md](ФТ_краткое.md).

## Стек
- **Backend:** FastAPI + SQLAlchemy 2.0 + Alembic, PostgreSQL, JWT-аутентификация.
- **Очередь:** Celery + Redis (Telegram-уведомления, импорт, напоминания).
- **Frontend:** React + Vite + TypeScript — `web-admin` (панель сотрудников) и `web-site` (публичный сайт).
- **ИИ:** Anthropic Claude + собственный MCP-сервер.
- **Инфра:** docker-compose, nginx.

## Структура
```
backend/     FastAPI-сервис (app/, alembic/, tests/)
web-admin/   React SPA — панель сотрудников
web-site/    React SPA — публичный каталог и форма заявки
nginx/       reverse-proxy (API + media)
docker-compose.yml / docker-compose.prod.yml
```

## Запуск (dev)
```bash
cp backend/.env.example backend/.env      # заполнить SECRET_KEY и пр.
docker compose up --build
# API:     http://localhost:8000
# Swagger: http://localhost:8000/docs
# Первичный вход: admin / admin (см. FIRST_ADMIN_* в .env)
```
Фронтенды (в отдельных терминалах):
```bash
cd web-admin && npm install && npm run dev   # http://localhost:5173
cd web-site  && npm install && npm run dev   # http://localhost:5174
```

## Тесты и линт (backend)
```bash
cd backend
pip install -r requirements-dev.txt
pytest                 # по умолчанию SQLite в памяти
ruff check . && black --check .
```
Прогон на Postgres (проверка блокировок FOR UPDATE):
```bash
TEST_DATABASE_URL=postgresql+psycopg2://rental:rental@localhost:5433/rental pytest
```

## Миграции
```bash
cd backend
alembic upgrade head                       # применить
alembic revision --autogenerate -m "..."   # создать новую (нужна поднятая БД)
```

## Дорожная карта (этапы)
- **Этап 0 (готово):** каркас backend/frontend, аутентификация (JWT, роли), docker, миграции, CI.
- **Этап 1:** ядро учёта — точки, каталог/комплекты, остатки, брони/выдачи/возвраты/бой, API, аудит.
- **Этап 2:** ввод товаров — Excel-импорт, фото с камеры телефона.
- **Этап 3:** публичный сайт (каталог + заявка) + Telegram-уведомления.
- **Этап 4:** ИИ-ассистент (Claude + MCP).
- **Этап 5:** отчёты, приёмка, прод-деплой.
