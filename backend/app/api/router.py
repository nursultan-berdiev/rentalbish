"""Сборка всех роутеров API v1."""

from fastapi import APIRouter

from app.api.routes import (
    ai,
    analytics,
    audit,
    auth,
    bookings,
    categories,
    clients,
    inventory,
    locations,
    products,
    public,
    reports,
    search,
    site_settings,
    users,
    weborders,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(locations.router)
api_router.include_router(categories.router)
api_router.include_router(products.router)
api_router.include_router(inventory.router)
api_router.include_router(clients.router)
api_router.include_router(bookings.router)
api_router.include_router(weborders.router)
api_router.include_router(reports.router)
api_router.include_router(search.router)
api_router.include_router(audit.router)
api_router.include_router(ai.router)
api_router.include_router(analytics.router)
api_router.include_router(public.router)  # публичные эндпоинты (каталог, приём заявок)
api_router.include_router(site_settings.router)  # статус витрины + настройки сайта
