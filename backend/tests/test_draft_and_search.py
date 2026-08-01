"""Черновик брони (не резервирует остаток) и сквозной поиск."""

import os

import pytest


@pytest.fixture
def setup(client, auth_headers):
    loc = client.post("/api/v1/locations", headers=auth_headers, json={"name": "Точка"}).json()[
        "id"
    ]
    plate = client.post(
        "/api/v1/products",
        headers=auth_headers,
        json={"name": "Тарелка", "sku": "PLT-1", "daily_price": 10, "deposit_price": 200},
    ).json()["id"]
    client.post(
        "/api/v1/inventory/supply",
        headers=auth_headers,
        json={"product_id": plate, "location_id": loc, "quantity": 100},
    )
    cl = client.post(
        "/api/v1/clients", headers=auth_headers, json={"name": "Иван", "phone": "+996 555 123 456"}
    ).json()["id"]
    return {"loc": loc, "plate": plate, "client": cl}


def _available(client, headers, prod, loc):
    return client.get(
        "/api/v1/inventory/available",
        headers=headers,
        params={"product_id": prod, "location_id": loc},
    ).json()["available"]


def _draft(client, headers, setup, qty=10):
    return client.post(
        "/api/v1/bookings",
        headers=headers,
        json={
            "client_id": setup["client"],
            "location_id": setup["loc"],
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-03",
            "items": [{"product_id": setup["plate"], "quantity": qty}],
            "draft": True,
        },
    )


def test_draft_does_not_reserve_stock(client, auth_headers, setup):
    r = _draft(client, auth_headers, setup)
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "new"
    # черновик не занимает остаток — доступно по-прежнему 100
    assert _available(client, auth_headers, setup["plate"], setup["loc"]) == 100


def test_confirm_reserves_stock(client, auth_headers, setup):
    bid = _draft(client, auth_headers, setup).json()["id"]
    r = client.post(f"/api/v1/bookings/{bid}/confirm", headers=auth_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "confirmed"
    assert _available(client, auth_headers, setup["plate"], setup["loc"]) == 90


def test_confirm_rejects_when_stock_gone(client, auth_headers, setup):
    """Черновик на 100 + подтверждённая бронь на 100 → подтвердить черновик нельзя."""
    draft_id = _draft(client, auth_headers, setup, qty=100).json()["id"]
    # обычная бронь забирает весь остаток
    client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": setup["client"],
            "location_id": setup["loc"],
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-02",
            "items": [{"product_id": setup["plate"], "quantity": 100}],
        },
    )
    r = client.post(f"/api/v1/bookings/{draft_id}/confirm", headers=auth_headers)
    assert r.status_code == 409
    assert "Недостаточно" in r.json()["detail"]


def test_cancel_draft_does_not_touch_stock(client, auth_headers, setup):
    """Отмена черновика не должна снимать резерв, которого не было."""
    # сначала занимаем 40 обычной бронью
    client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": setup["client"],
            "location_id": setup["loc"],
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-02",
            "items": [{"product_id": setup["plate"], "quantity": 40}],
        },
    )
    assert _available(client, auth_headers, setup["plate"], setup["loc"]) == 60

    draft_id = _draft(client, auth_headers, setup, qty=30).json()["id"]
    c = client.post(f"/api/v1/bookings/{draft_id}/cancel", headers=auth_headers)
    assert c.status_code == 200
    assert c.json()["status"] == "cancelled"
    # резерв чужой брони не пострадал
    assert _available(client, auth_headers, setup["plate"], setup["loc"]) == 60


def test_draft_cannot_be_issued(client, auth_headers, setup):
    bid = _draft(client, auth_headers, setup).json()["id"]
    r = client.post(
        f"/api/v1/bookings/{bid}/issue",
        headers=auth_headers,
        json={"items": [{"product_id": setup["plate"], "quantity": 1}]},
    )
    assert r.status_code == 409


def test_confirm_only_draft(client, auth_headers, setup):
    bid = _draft(client, auth_headers, setup).json()["id"]
    client.post(f"/api/v1/bookings/{bid}/confirm", headers=auth_headers)
    again = client.post(f"/api/v1/bookings/{bid}/confirm", headers=auth_headers)
    assert again.status_code == 409


def test_global_search(client, auth_headers, setup):
    client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": setup["client"],
            "location_id": setup["loc"],
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-02",
            "items": [{"product_id": setup["plate"], "quantity": 5}],
        },
    )
    # по названию товара
    r = client.get("/api/v1/search", headers=auth_headers, params={"q": "Тарел"}).json()
    assert [p["name"] for p in r["products"]] == ["Тарелка"]

    # по артикулу
    r = client.get("/api/v1/search", headers=auth_headers, params={"q": "PLT"}).json()
    assert r["products"][0]["sku"] == "PLT-1"

    # по имени клиента — находит и клиента, и его бронь
    r = client.get("/api/v1/search", headers=auth_headers, params={"q": "Иван"}).json()
    assert r["clients"][0]["name"] == "Иван"
    assert len(r["bookings"]) == 1

    # по телефону с другим форматированием (только цифры)
    r = client.get("/api/v1/search", headers=auth_headers, params={"q": "555123"}).json()
    assert r["clients"][0]["phone"] == "+996 555 123 456"


def test_search_empty_query(client, auth_headers):
    r = client.get("/api/v1/search", headers=auth_headers, params={"q": " "}).json()
    assert r["products"] == [] and r["clients"] == [] and r["bookings"] == []


# --- реальный ввод: так люди печатают на самом деле (нашёл QA) ---


@pytest.fixture
def petr(client, auth_headers):
    """Клиент с «ё» в имени и телефоном с пробелами — как в жизни."""
    return client.post(
        "/api/v1/clients",
        headers=auth_headers,
        json={"name": "Пётр Иванов", "phone": "+996 555 111 222"},
    ).json()["id"]


def test_search_name_without_yo(client, auth_headers, petr):
    """«Петр» через «е» должен находить «Пётр»: ё почти никто не печатает."""
    r = client.get("/api/v1/search", headers=auth_headers, params={"q": "Петр"}).json()
    assert [c["name"] for c in r["clients"]] == ["Пётр Иванов"]


@pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL", "").startswith("postgresql"),
    reason="кириллица без учёта регистра: у SQLite lower()/LIKE только для латиницы, "
    "прод на Postgres — проверяем там",
)
def test_search_name_is_case_insensitive(client, auth_headers, petr):
    r = client.get("/api/v1/search", headers=auth_headers, params={"q": "пЕТР иванов"}).json()
    assert [c["name"] for c in r["clients"]] == ["Пётр Иванов"]


@pytest.mark.parametrize(
    "typed",
    [
        "+996 555 111 222",  # как показано в интерфейсе
        "996555111222",  # без пробелов
        "0555111222",  # местный формат: ведущий 0 вместо +996
        "555 111",  # кусок номера
    ],
)
def test_search_phone_any_format(client, auth_headers, petr, typed):
    r = client.get("/api/v1/search", headers=auth_headers, params={"q": typed}).json()
    assert [c["phone"] for c in r["clients"]] == ["+996 555 111 222"], f"не нашёлся по «{typed}»"


def test_search_booking_by_number_with_prefix(client, auth_headers, setup):
    """Номер брони ищется и как «170», и как «№170»."""
    bid = client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": setup["client"],
            "location_id": setup["loc"],
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-02",
            "items": [{"product_id": setup["plate"], "quantity": 1}],
        },
    ).json()["id"]

    for typed in (str(bid), f"№{bid}"):
        r = client.get("/api/v1/search", headers=auth_headers, params={"q": typed}).json()
        assert bid in [b["id"] for b in r["bookings"]], f"не нашлась по «{typed}»"


def test_search_product_name_without_yo(client, auth_headers):
    client.post(
        "/api/v1/products",
        headers=auth_headers,
        json={"name": "Тёрка", "daily_price": 5, "deposit_price": 50},
    )
    r = client.get("/api/v1/search", headers=auth_headers, params={"q": "Терка"}).json()
    assert [p["name"] for p in r["products"]] == ["Тёрка"]
