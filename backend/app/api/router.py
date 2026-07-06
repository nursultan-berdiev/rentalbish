"""Сборка всех роутеров API v1."""

from fastapi import APIRouter

from app.api.routes import auth, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)

# По мере реализации сюда добавляются: locations, catalog, inventory,
# bookings, clients, weborders, reports, ai.
