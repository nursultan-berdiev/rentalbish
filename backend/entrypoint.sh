#!/bin/sh
set -e

# Ждём готовности Postgres
if [ -n "$POSTGRES_HOST" ]; then
  echo "Ожидание Postgres на $POSTGRES_HOST:${POSTGRES_PORT:-5432}..."
  while ! nc -z "$POSTGRES_HOST" "${POSTGRES_PORT:-5432}"; do
    sleep 0.5
  done
  echo "Postgres доступен."
fi

# Применяем миграции и сидим первичные данные (только процесс API; worker и mcp
# пропускают через RUN_MIGRATIONS=0). Сид здесь, а не в lifespan приложения:
# иначе при нескольких uvicorn-воркерах они гонятся за создание админа
# (UniqueViolation по ix_users_login).
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "Применяю миграции..."
  alembic upgrade head
  echo "Сид первичных данных..."
  python -c "from app.core.init_db import seed_first_admin, seed_dashboard; seed_first_admin(); seed_dashboard()"
fi

exec "$@"
