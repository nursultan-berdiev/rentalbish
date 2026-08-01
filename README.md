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
# API:     http://localhost:8010
# Swagger: http://localhost:8010/docs
# Первичный вход: admin / admin (см. FIRST_ADMIN_* в .env)
```
Поднимаются `db` (Postgres, наружу на 5460), `redis` (6390), `api` (8010) и `worker` (celery).
Миграции применяет `entrypoint.sh` при старте API. Порты dev-стенда намеренно нестандартные —
чтобы не конфликтовать с другими проектами на машине.

Фронтенды (в отдельных терминалах, в compose не входят):
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
Прогон на Postgres — **обязателен перед релизом**: часть поведения (блокировки `FOR UPDATE`
в резервировании) на SQLite не воспроизводится, и тест конкурентного бронирования там
пропускается. Поднимите стенд и создайте тестовую БД:
```bash
docker compose exec db psql -U rental -d postgres -c "CREATE DATABASE rental_test;"
TEST_DATABASE_URL=postgresql+psycopg2://rental:rental@localhost:5460/rental_test pytest
```

## Миграции
```bash
cd backend
alembic upgrade head                       # применить
alembic revision --autogenerate -m "..."   # создать новую (нужна поднятая БД)
```

## MCP-сервер (для внешних ИИ-агентов)
Read-инструменты по складу (`get_stock`, `get_available`, `get_on_hands`, `get_overdue`,
`get_returns`, `search_products`, `get_client_debt`) через stdio:
```bash
cd backend && python -m app.mcp.server
```
Тот же набор инструментов доступен в панели через чат-виджет (`POST /api/v1/ai/chat`,
нужен `ANTHROPIC_API_KEY`).

## Дорожная карта (этапы)
- **Этап 0 (готово):** каркас backend/frontend, аутентификация (JWT, роли), docker, миграции, CI.
- **Этап 1 (готово):** ядро учёта — точки, каталог/комплекты, остатки, брони/выдачи/возвраты/бой, API, аудит.
- **Этап 2 (готово):** ввод товаров — Excel-импорт (шаблон/превью/коммит), фото с камеры телефона.
- **Этап 3 (готово):** публичный сайт (каталог + корзина + заявка) + Telegram-уведомления (celery).
- **Этап 4 (готово):** ИИ-ассистент (Claude tool-use + MCP-сервер).
- **Этап 5 (готово):** отчёты (остатки/движение/активность/on-hands) + Excel-экспорт, приёмка, прод-деплой.
