"""Точка входа FastAPI-приложения."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.init_db import seed_first_admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Каталог для медиа (фото товаров) и сид администратора.
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    seed_first_admin()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
app.mount(settings.MEDIA_URL, StaticFiles(directory=settings.MEDIA_ROOT), name="media")


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
