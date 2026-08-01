"""MCP-сервер с read-инструментами доступа к складу.

Запуск (stdio-транспорт, для подключения ИИ-агентов/инспектора):
    python -m app.mcp.server

Инструменты — тонкие обёртки над app.services.warehouse_queries; каждая
открывает собственную сессию БД. Только чтение.
"""

from mcp.server.fastmcp import FastMCP

from app.db.session import SessionLocal
from app.services import warehouse_queries as wq

mcp = FastMCP("rentalbish-warehouse")


@mcp.tool()
def search_products(query: str = "") -> list[dict]:
    """Найти товары/комплекты по части названия (или все, если query пуст)."""
    with SessionLocal() as db:
        return wq.search_products(db, query)


@mcp.tool()
def get_stock(product_id: int | None = None, location_id: int | None = None) -> list[dict]:
    """Остатки по точкам: всего/забронировано/выдано/доступно."""
    with SessionLocal() as db:
        return wq.get_stock(db, product_id, location_id)


@mcp.tool()
def get_available(product_id: int, location_id: int) -> dict:
    """Свободный остаток позиции на точке (с учётом комплектов)."""
    with SessionLocal() as db:
        return wq.get_available(db, product_id, location_id)


@mcp.tool()
def get_on_hands() -> list[dict]:
    """Что сейчас на руках у клиентов (выдано и не возвращено)."""
    with SessionLocal() as db:
        return wq.get_on_hands(db)


@mcp.tool()
def get_overdue() -> list[dict]:
    """Просроченные возвраты: клиент, контакты, позиции, дни просрочки."""
    with SessionLocal() as db:
        return wq.get_overdue(db)


@mcp.tool()
def get_returns(days: int = 7) -> list[dict]:
    """Что вернулось за последние N дней (целые и бой)."""
    with SessionLocal() as db:
        return wq.get_returns(db, days)


@mcp.tool()
def get_client_debt(phone: str) -> dict:
    """Долг клиента по номеру телефона: аренда + бой − предоплата."""
    with SessionLocal() as db:
        return wq.get_client_debt(db, phone)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
