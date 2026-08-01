"""Складские read-запросы (слой ИИ/MCP) и поведение чата без ключа."""

from app.ai.chat import dispatch_tool
from app.services import warehouse_queries as wq


def _seed(client, auth_headers):
    loc = client.post("/api/v1/locations", headers=auth_headers, json={"name": "Точка"}).json()[
        "id"
    ]
    prod = client.post(
        "/api/v1/products",
        headers=auth_headers,
        json={"name": "Бокал", "daily_price": 5, "deposit_price": 150},
    ).json()["id"]
    client.post(
        "/api/v1/inventory/supply",
        headers=auth_headers,
        json={"product_id": prod, "location_id": loc, "quantity": 40},
    )
    cl = client.post(
        "/api/v1/clients", headers=auth_headers, json={"name": "Пётр", "phone": "0999"}
    ).json()["id"]
    bk = client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": cl,
            "location_id": loc,
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-02",
            "items": [{"product_id": prod, "quantity": 10}],
            "prepaid": 20,
        },
    ).json()
    return loc, prod, cl, bk["id"]


def test_search_and_stock_queries(client, auth_headers, db):
    loc, prod, _cl, _bid = _seed(client, auth_headers)
    found = wq.search_products(db, "Бокал")
    assert found and found[0]["name"] == "Бокал"
    stock = wq.get_stock(db, product_id=prod)
    assert stock[0]["available"] == 30  # 40 − 10 в резерве


def test_client_debt_query(client, auth_headers, db):
    _loc, _prod, _cl, _bid = _seed(client, auth_headers)
    debt = wq.get_client_debt(db, "0999")
    assert debt["found"] is True
    # аренда 10×5×1=50, предоплата 20 → долг 30
    assert debt["debt"] == 30.0


def test_dispatch_tool_routes_to_query(client, auth_headers, db):
    _seed(client, auth_headers)
    result = dispatch_tool(db, "get_client_debt", {"phone": "0999"})
    assert result["debt"] == 30.0
    assert dispatch_tool(db, "nonexistent", {})["error"]


def test_overdue_query(client, auth_headers, db):
    loc, prod, cl, bid = _seed(client, auth_headers)
    # выдаём и делаем дату возврата в прошлом уже прошла (2026-07-02 < today 2026-07-07)
    client.post(
        f"/api/v1/bookings/{bid}/issue",
        headers=auth_headers,
        json={"items": [{"product_id": prod, "quantity": 10}]},
    )
    overdue = wq.get_overdue(db)
    assert any(o["booking_id"] == bid for o in overdue)
    assert overdue[0]["days_overdue"] >= 1


def test_ai_chat_returns_503_without_key(client, auth_headers):
    r = client.post("/api/v1/ai/chat", headers=auth_headers, json={"message": "что на складе?"})
    assert r.status_code == 503
