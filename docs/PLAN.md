# План реализации — сервис аренды посуды (rentalbish)

> Документ передачи для продолжения разработки. Функциональные требования:
> [../ФТ_полное.md](../ФТ_полное.md), [../ФТ_краткое.md](../ФТ_краткое.md).

## Статус на 2026-07-06

| Этап | Состояние |
|------|-----------|
| **Этап 0 — Бутстрап** | ✅ **Готово** (каркас backend/frontend, JWT-аутентификация, docker, миграции, CI, тесты) |
| Этап 1 — Ядро учёта + API | ⬜ Следующий |
| Этап 2 — Ввод товаров (Excel + камера) | ⬜ |
| Этап 3 — Публичный сайт + Telegram | ⬜ |
| Этап 4 — ИИ / MCP на Claude | ⬜ |
| Этап 5 — Отчёты, приёмка, деплой | ⬜ |

### Что уже реализовано (Этап 0)
- **backend/** (FastAPI + SQLAlchemy 2.0 + Alembic): структура `app/` (core/config, security,
  db, models, schemas, api, tasks), конфиг из env.
- **Аутентификация**: OAuth2 password flow, JWT access/refresh, роли `admin`/`staff`,
  зависимости `require_admin` / `require_staff`. Модель `User`, роутеры `auth`
  (`/login`, `/refresh`, `/me`) и `users` (CRUD, только админ). Сид первичного админа.
- **Alembic**: первая миграция `0001_initial` (таблица `users`).
- **web-admin/** и **web-site/** (React+Vite+TS): логин с хранением токенов и защищённым роутом
  (admin); каталог-заглушка + рабочая форма заявки (site). Нейтральная вёрстка под будущий дизайн.
- **Инфра**: `docker-compose.yml` (dev) и `docker-compose.prod.yml`, Dockerfile, entrypoint
  (ждёт Postgres → `alembic upgrade head`), nginx, CI (`.github/workflows/ci.yml`), pre-commit.
- **Тесты**: `backend/tests/` — 9 тестов аутентификации/ролей, зелёные (pytest на SQLite по
  умолчанию; `TEST_DATABASE_URL` переключает на Postgres). ruff + black чистые.

### Важные отклонения от первоначального плана (учесть при продолжении!)
1. **Пароли — `bcrypt` напрямую, НЕ passlib.** `passlib[bcrypt] 1.7.4` несовместим с `bcrypt`
   4.x (ошибка `module 'bcrypt' has no attribute '__about__'`). См. `app/core/security.py`
   (`hash_password`/`verify_password`, усечение до 72 байт).
2. **Enum'ы — `enum.StrEnum` + `enum_type()`** из `app/db/base.py` (`values_callable`), чтобы БД
   хранила **значения** ("admin"/"staff"), а не имена членов. Для новых enum-колонок в Этапе 1
   используйте `enum_type(MyEnum)`, а не `sqlalchemy.Enum(...)` напрямую — иначе рассинхрон с
   миграциями и server_default.
3. **DB через `DATABASE_URL`.** `app/core/config.py`: если задан `DATABASE_URL` — берётся он
   (для SQLite в тестах); иначе URL собирается из `POSTGRES_*`. Тесты в `conftest.py` ставят
   `DATABASE_URL=sqlite...` **до** импорта приложения (иначе модульный движок тянет psycopg2).
4. **Тесты sync (`TestClient`), не async.** В плане упоминался httpx `AsyncClient`; фактически
   выбран sync SQLAlchemy + `fastapi.testclient.TestClient` — проще и совместимо с Celery.
   `conftest.py` создаёт TestClient **без** контекст-менеджера, чтобы не запускать lifespan
   (сид админа в реальный Postgres) во время тестов.
5. **nginx** пока только reverse-proxy на API + отдача `media/`. Хостинг React-билдов
   (dist → `try_files $uri /index.html`) подключается в Этапе 3/5, когда придёт дизайн.
6. **Python:** локально доступен 3.14, целевой рантайм (Docker/CI) — 3.12. Реальный интерпретатор
   на машине разработчика: `C:\Users\n.berdiev\AppData\Local\Python\pythoncore-3.14-64\python.exe`
   (`python` в PATH — это Store-заглушка, venv через неё не создаётся).

### Как продолжить локально
```bash
cd backend
# venv уже создан в backend/.venv (Python 3.14). Либо пересоздать целевым интерпретатором.
./.venv/Scripts/python.exe -m pytest        # 9 passed
./.venv/Scripts/python.exe -m ruff check .
./.venv/Scripts/python.exe -m black --check .
```
Полный запуск (нужен Docker, в текущей среде отсутствовал):
```bash
cp backend/.env.example backend/.env
docker compose up --build      # API :8000, Swagger /docs, вход admin/admin
```

---

## Context

Бизнес сдаёт посуду в аренду. Клиенты обращаются по разным каналам → двойное бронирование
(один товар бронируют/оплачивают несколько человек), приходится отказывать оплатившим. Нужен
единый сервис: учёт склада по нескольким точкам, брони, выдачи/возвраты, бой, посуточный расчёт,
API для интеграций, публичный сайт-витрина, Telegram-уведомления и ИИ-ассистент.

**Согласованные решения:**
- Аренда посуточно (число суток округляется вверх до полных); залог опционален.
- Оплата пока не онлайн — только заявка + звонок.
- Мультисклад (несколько точек), учёт остатков по точкам.
- Комплекты/наборы (объединение товаров в одну позицию).
- Клиент без регистрации (имя + телефон); задача сайта — свести клиента к оператору.
- **Отдельный самостоятельный проект** в папке `rentalbish/` (своя БД, свой репозиторий, свой API).
  Существующий в `MySpace` проект insurance_kg **не используем** — строим независимо.
- **Бэкенд — FastAPI (Python).**
- **Фронтенд — React SPA:** и публичный сайт, и внутренняя панель сотрудников (два отдельных React-приложения поверх общего API).
- **ИИ-ассистент — Claude API (Anthropic)** + собственный MCP-сервер поверх доменных данных.
- Дизайн сайта придёт позже — сейчас делаем функционально, с нейтральной вёрсткой-заглушкой,
  чтобы дизайн накладывался на готовые компоненты без переписывания логики.

---

## Стек

| Слой | Технология |
|------|-----------|
| Бэкенд | **FastAPI** (Python 3.12), Pydantic v2 |
| ORM / миграции | **SQLAlchemy 2.0** + **Alembic** |
| БД | **PostgreSQL 16** |
| Аутентификация | OAuth2 password flow + **JWT** (access/refresh), **`bcrypt` напрямую** для хешей паролей |
| Права/роли | RBAC (роли: администратор, сотрудник; привязка сотрудника к точкам) — свои зависимости FastAPI (`Depends`) |
| Аудит | Своя таблица `AuditLog` + SQLAlchemy event listeners / middleware (пишем кто/что/когда/старое→новое) |
| Фоновые задачи / очередь | **Celery + Redis** (Telegram-уведомления, тяжёлый Excel-импорт, напоминания о просрочках через celery-beat) |
| Excel | **pandas** (чтение) + **openpyxl** (шаблон/экспорт) |
| Фото | загрузка `UploadFile`, локальное хранилище `media/` (S3/minio — опция позже), отдаётся nginx |
| API-докуметация | встроенный OpenAPI/Swagger FastAPI (`/docs`) |
| Фронтенд | **React + Vite + TypeScript**, TanStack Query (данные), React Router; вёрстка-заглушка (минимальный CSS) |
| ИИ | **Anthropic SDK** (Claude) + **MCP Python SDK** (`mcp`) — сервер инструментов доступа к складу |
| Инфра | **docker-compose** (dev/prod), **nginx** (статика React + reverse-proxy на API), Uvicorn/Gunicorn |
| CI/CD | GitHub Actions: линт (ruff/black) + `pytest` (Postgres+Redis service) → сборка образов → деплой |
| Тесты | **pytest** + `fastapi.testclient.TestClient` (sync); БД в тестах — SQLite, опц. Postgres |
| Формат/линт | ruff + black + isort, pre-commit |

---

## Архитектура

Монорепо `rentalbish/`:
```
rentalbish/
  backend/                 # FastAPI-сервис
    app/
      main.py              # сборка приложения, роутеры, CORS, статика media
      core/                # config (env), security (JWT/пароли), celery_app, init_db (сид)
      db/                  # base (Base, TimestampMixin, enum_type), session (get_db)
      models/              # SQLAlchemy: users(+enums), locations, catalog, inventory, bookings, weborders, audit
      schemas/             # Pydantic-схемы (in/out) по доменам
      api/                 # deps (current_user/role), router; routes/: auth, users, locations, catalog, ...
      services/            # доменная логика: availability, reservation, breakage, excel_import, rental_pricing
      tasks/               # celery: telegram_notify, import_products, overdue_reminders
      mcp/                 # MCP-сервер + инструменты (read-доступ к складу)
      ai/                  # чат-эндпоинт на Claude (tool-use → mcp-инструменты)
    alembic/               # миграции (versions/0001_initial.py)
    tests/                 # conftest.py (SQLite-фикстуры), test_auth.py
    pyproject.toml  requirements.txt  Dockerfile  entrypoint.sh
  web-admin/               # React SPA — панель сотрудников (авторизованная)
  web-site/                # React SPA — публичный каталог/заявка (без входа)
  docker-compose.yml  docker-compose.prod.yml
  nginx/
```

Единый **API (FastAPI)** — источник данных и для обеих React-панелей, и для внешних интеграций,
и для MCP. Публичные эндпоинты (каталог, остатки, создание заявки) — без токена; всё остальное — под JWT.

### Доменная модель (SQLAlchemy) — Этап 1
- **User** *(готово)* — сотрудник: логин, хеш пароля, роль, активность; в Этапе 1 добавить
  M2M `user_locations` (право по точкам).
- **Location** — точка/склад: название, адрес, активна.
- **Category**, **Product** — товар: наименование, SKU, тип `товар|комплект`, ед.изм., суточная цена,
  залоговая стоимость, `show_on_site`; **ProductPhoto** (файлы, привязка к товару).
- **SetItem** — состав комплекта: `(комплект → товар, кол-во на 1 набор)`.
- **Stock** — остаток по паре `product × location`: всего / забронировано / выдано / списано.
- **Supply** — завоз (+баланс). **WriteOff** — бой/утеря (−баланс, сумма удержания = кол-во×залог).
- **Client** — имя, телефон (идентификация по телефону, без ЛК).
- **Booking** — точка, период (начало/ожид.возврат), `суток` (округл. вверх), статус
  (`новая→подтверждена→выдана→возвращена→закрыта|отменена`), сумма аренды, залог?, предоплата;
  **BookingItem** (позиции). **Issue** (выдача), **Return** (возврат, частичный).
- **WebOrder** — заявка с сайта: имя, телефон, позиции, статус (`новая→в обработке→в бронь|отклонена`).
- **AuditLog** — кто/что/над чем/старое→новое/когда (для выдач, возвратов, боя, цен, остатков, броней).

> Enum'ы уже объявлены в `app/models/enums.py`: `UserRole`, `ProductType`, `BookingStatus`,
> `WebOrderStatus`, `WriteOffReason` — переиспользовать их в моделях Этапа 1.

### Ключевые сервис-функции (`backend/app/services/`) — Этап 1
- `availability.available(product, location, period)` — единый расчёт свободного остатка; для
  комплекта: `min(доступно_компонента / кол-во_в_наборе)`.
- `reservation.reserve(...)` — **транзакционный резерв с `SELECT … FOR UPDATE`
  (`with_for_update()`)** → защита от двойного бронирования при параллельных запросах.
- `rental_pricing.calc(...)` — посуточно: `кол-во × суточная цена × суток` (суток округляем вверх).
- `breakage.write_off(...)` — списание + сумма удержания.
- `excel_import.parse_and_create(file)` — pandas-парсер шаблона → валидация построчно → массовое создание.

---

## Этапы и шаги

### Этап 0 — Бутстрап ✅ (готово)
- [x] Каркас `backend/` (FastAPI + SQLAlchemy + Alembic), `pyproject.toml`, ruff/black/pre-commit.
- [x] `docker-compose.yml`: сервисы `api`, `db` (Postgres 16), `redis`, `worker` (celery); prod +nginx/beat.
- [x] Конфиг через env (`.env`): БД, `SECRET_KEY`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`.
- [x] Аутентификация: логин, JWT access/refresh, хеш паролей, `Depends(current_user/role)`.
- [x] Каркасы `web-admin/` и `web-site/` (Vite+React+TS), роутинг, клиент API, логин в админке.
- [x] CI: линт + pytest (SQLite + Postgres service).

### Этап 1 — Ядро учёта + API (5–6 нед.)
- Модели + Alembic-миграции: users (+ M2M locations), locations, catalog (+ ProductPhoto, SetItem),
  inventory (Stock, Supply, WriteOff), bookings (Client, Booking, BookingItem, Issue, Return).
- Сервисы: availability (в т.ч. комплекты), reservation (`FOR UPDATE`), rental_pricing (посуточно,
  округление вверх), breakage.
- REST-роутеры (CRUD + операции завоз/бронь/выдача/возврат/бой) с ролевыми правами и пагинацией.
- Аудит: `AuditLog` через event listeners; действующий пользователь из контекста запроса.
- Контроль сроков: «на руках», просрочки, дни с брони (эндпоинты/фильтры).
- pytest на доменную логику; **отдельный тест на конкурентное двойное бронирование** (на Postgres,
  через `TEST_DATABASE_URL`, т.к. `FOR UPDATE` на SQLite не воспроизводится).

### Этап 2 — Ввод товаров (2–2.5 нед.)
- Excel-импорт: эндпоинт скачивания шаблона .xlsx; загрузка → pandas-парсер → превью с ошибками →
  подтверждение → создание (тяжёлый импорт — celery-таска).
- Загрузка фото: `UploadFile` → `media/`, привязка к товару, отдача через nginx.
- В `web-admin`: форма товара с камерой телефона — `<input type="file" accept="image/*"
  capture="environment">` (открывает камеру в мобильном браузере); адаптивная вёрстка.

### Этап 3 — React-панель + публичный сайт + Telegram (4–5 нед.)
- `web-admin` (SPA сотрудников): склад/остатки по точкам, товары/комплекты, брони, выдачи/возвраты,
  бой, клиенты, заявки, расчёты. Мобайл-фёрст, вёрстка-заглушка под будущий дизайн.
- `web-site` (публичный SPA): каталог (сетка карточек, только товары с фото и `show_on_site`,
  актуальные остатки), карточка, корзина, форма заявки (имя + телефон) → `POST /weborders`.
- `notifications`: при `WebOrder` — уведомление в панель + Telegram-бот (celery-таска, Bot API через
  `requests`; токен/чат из env). Сотрудник видит телефон клиента и связывается.

### Этап 4 — ИИ / MCP на Claude (2.5–3 нед.)
- `backend/app/mcp`: MCP-сервер (Python SDK) с read-инструментами поверх сервисов:
  `get_stock`, `get_available`, `get_on_hands`, `get_returns`, `get_overdue`, `search_products`,
  `get_client_debt`.
- `backend/app/ai`: чат-эндпоинт (Anthropic SDK, Claude, tool-use → MCP-инструменты) + виджет чата
  в `web-admin`: вопросы «что на складе», «сколько свободно», «что просрочено», «долги клиента».

### Этап 5 — Отчёты, тесты, приёмка, деплой (2–2.5 нед.)
- Отчёты: остатки, на руках/просрочки, движение за период, активность сотрудников (из AuditLog);
  экспорт в Excel (openpyxl/xlsxwriter).
- Сквозное тестирование, проверка нагрузки на каталог, правки.
- Прод: `docker-compose.prod.yml` (Gunicorn+Uvicorn workers, nginx отдаёт билды React и проксирует
  API), pg-бэкапы, CI/CD-деплой на сервер.

**Сроки (ориентир):** 1 разработчик ≈ 18–20 нед (~4.5–5 мес); команда 2 чел. (бэк + фронт)
≈ 12–14 нед (~3 мес). Рабочий MVP (Этапы 0–2 + минимальная админ-панель) — 1 разработчик 10–11 нед,
команда 6–7 нед.

---

## Verification (как проверять)

- **Локально:** `docker compose up` → `alembic upgrade head` (в entrypoint) → Swagger на `/docs`; логин выдаёт JWT.
- **Тесты:** `pytest` (SQLite по умолчанию); в CI дополнительно на Postgres (service-контейнер).
- **Двойное бронирование (критично):** тест на параллельный резерв одного товара/периода — второй
  запрос получает отказ (`with_for_update`/транзакция). Проверить корректность `available()` после
  завоза/выдачи/возврата/боя и для комплектов (min по компонентам).
- **Посуточный расчёт:** неполные сутки округляются вверх; сумма = кол-во×цена×суток.
- **Excel-импорт:** загрузить шаблон → превью → импорт → товары в БД; битые строки видны.
- **Фото с телефона:** открыть `web-admin` в мобильном браузере, снять фото, товар с фото создан,
  файл в `media/`, отдаётся nginx.
- **API/роли:** публичные read/weborder — без токена; операции — только под JWT нужной роли.
- **Сайт+Telegram:** оформить заявку на `web-site` → запись `WebOrder` в панели + сообщение в
  Telegram (позиции + телефон).
- **ИИ/MCP:** прогнать инструменты через MCP-инспектор; в чат-виджете «сколько свободных бокалов /
  что просрочено» → ответ соответствует БД.

---

## Открытые вопросы (не блокируют старт)
1. Объём номенклатуры (сотни/тысячи позиций) — влияет на индексы/пагинацию/кеш.
2. Перемещение товара между точками — отдельной операцией или точки независимы (модель заложить, реализовать позже).
3. Хранение фото: локальный диск сейчас; S3/minio — если понадобится отказоустойчивость.
4. Очередь: Celery+Redis (в плане) либо более «нативный» для FastAPI ARQ — уточнить предпочтение.
