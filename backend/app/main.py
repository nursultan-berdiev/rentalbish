"""Точка входа FastAPI-приложения."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.services.errors import DomainError


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Каталог для медиа (фото товаров). Сид первичных данных (админ, встроенные
    # блоки дашборда) выполняется в entrypoint.sh до запуска воркеров — иначе
    # несколько uvicorn-воркеров гонятся за создание админа.
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
)

# В dev панель и витрину открывают не только по localhost, но и по имени хоста
# или по IP (с телефона) — Origin тогда другой. Разрешаем любой хост на портах
# фронтов. В prod регулярка задаётся явно через CORS_ORIGIN_REGEX.
DEV_CORS_ORIGIN_REGEX = r"^https?://[^/]+:(5173|5174)$"

cors_origin_regex = settings.CORS_ORIGIN_REGEX or (
    DEV_CORS_ORIGIN_REGEX if settings.ENV == "dev" else None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DomainError)
async def _domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
    """Доменные ошибки сервисов → аккуратный HTTP-ответ."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


app.include_router(api_router, prefix=settings.API_V1_PREFIX)

os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
app.mount(settings.MEDIA_URL, StaticFiles(directory=settings.MEDIA_ROOT), name="media")


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
