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

# Применяем миграции (только процесс API; worker пропускает через RUN_MIGRATIONS=0)
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "Применяю миграции..."
  alembic upgrade head
fi

exec "$@"
