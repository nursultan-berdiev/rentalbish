"""Полный цикл брони: создание (резерв) → выдача → возврат с боем → расчёт."""

import pytest


@pytest.fixture
def setup(client, auth_headers):
    loc = client.post("/api/v1/locations", headers=auth_headers, json={"name": "Точка"}).json()[
        "id"
    ]
    plate = client.post(
        "/api/v1/products",
        headers=auth_headers,
        json={"name": "Тарелка", "daily_price": 10, "deposit_price": 200},
    ).json()["id"]
    client.post(
        "/api/v1/inventory/supply",
        headers=auth_headers,
        json={"product_id": plate, "location_id": loc, "quantity": 100},
    )
    cl = client.post(
        "/api/v1/clients", headers=auth_headers, json={"name": "Иван", "phone": "0555"}
    ).json()["id"]
    return {"loc": loc, "plate": plate, "client": cl}


def _available(client, headers, prod, loc):
    return client.get(
        "/api/v1/inventory/available",
        headers=headers,
        params={"product_id": prod, "location_id": loc},
    ).json()["available"]


def test_booking_reserves_and_prices(client, auth_headers, setup):
    r = client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": setup["client"],
            "location_id": setup["loc"],
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-03",
            "items": [{"product_id": setup["plate"], "quantity": 10}],
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["days"] == 2
    assert body["rental_total"] == 200.0  # 10 × 10 × 2
    assert body["status"] == "confirmed"
    # доступно уменьшилось на 10 (зарезервировано)
    assert _available(client, auth_headers, setup["plate"], setup["loc"]) == 90


def test_double_booking_rejected_when_insufficient(client, auth_headers, setup):
    # завозим ровно 100, бронируем 100 — второй запрос на любую 1 должен упасть
    base = {
        "client_id": setup["client"],
        "location_id": setup["loc"],
        "start_date": "2026-07-01",
        "expected_return_date": "2026-07-02",
    }
    r1 = client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={**base, "items": [{"product_id": setup["plate"], "quantity": 100}]},
    )
    assert r1.status_code == 201
    r2 = client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={**base, "items": [{"product_id": setup["plate"], "quantity": 1}]},
    )
    assert r2.status_code == 409
    assert "Недостаточно" in r2.json()["detail"]


def test_cancel_releases_reserve(client, auth_headers, setup):
    r = client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": setup["client"],
            "location_id": setup["loc"],
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-02",
            "items": [{"product_id": setup["plate"], "quantity": 40}],
        },
    ).json()
    assert _available(client, auth_headers, setup["plate"], setup["loc"]) == 60
    c = client.post(f"/api/v1/bookings/{r['id']}/cancel", headers=auth_headers)
    assert c.status_code == 200
    assert c.json()["status"] == "cancelled"
    assert _available(client, auth_headers, setup["plate"], setup["loc"]) == 100


def test_cancel_rejected_when_items_on_hands(client, auth_headers, setup):
    """Отмена брони с товаром на руках запрещена — иначе выданное «зависает».

    Регресс QA 3.8: раньше отмена выданной брони не возвращала issued в оборот,
    и остаток терялся навсегда. Теперь сначала нужен возврат.
    """
    bk = client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": setup["client"],
            "location_id": setup["loc"],
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-02",
            "items": [{"product_id": setup["plate"], "quantity": 10}],
        },
    ).json()
    bid = bk["id"]
    client.post(
        f"/api/v1/bookings/{bid}/issue",
        headers=auth_headers,
        json={"items": [{"product_id": setup["plate"], "quantity": 6}]},
    )
    # на руках 6 → отмена отклонена, ничего не потеряно
    c = client.post(f"/api/v1/bookings/{bid}/cancel", headers=auth_headers)
    assert c.status_code == 409
    assert "на руках" in c.json()["detail"]
    # 6 выдано + 4 в резерве → доступно 90
    assert _available(client, auth_headers, setup["plate"], setup["loc"]) == 90

    # после возврата целых остаток восстанавливается
    client.post(
        f"/api/v1/bookings/{bid}/return",
        headers=auth_headers,
        json={"items": [{"product_id": setup["plate"], "quantity": 6, "broken_qty": 0}]},
    )
    assert _available(client, auth_headers, setup["plate"], setup["loc"]) == 100


def test_full_cycle_issue_return_breakage_settlement(client, auth_headers, setup):
    bk = client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": setup["client"],
            "location_id": setup["loc"],
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-03",
            "items": [{"product_id": setup["plate"], "quantity": 10}],
            "prepaid": 50,
        },
    ).json()
    bid = bk["id"]

    # выдача всех 10
    i = client.post(
        f"/api/v1/bookings/{bid}/issue",
        headers=auth_headers,
        json={"items": [{"product_id": setup["plate"], "quantity": 10}]},
    )
    assert i.status_code == 200
    assert i.json()["status"] == "issued"

    # возврат: 8 целых + 2 боя
    ret = client.post(
        f"/api/v1/bookings/{bid}/return",
        headers=auth_headers,
        json={"items": [{"product_id": setup["plate"], "quantity": 8, "broken_qty": 2}]},
    )
    assert ret.status_code == 200
    assert ret.json()["status"] == "closed"

    # 2 боя списаны → всего стало 98
    assert _available(client, auth_headers, setup["plate"], setup["loc"]) == 98

    s = client.get(f"/api/v1/bookings/{bid}/settlement", headers=auth_headers).json()
    assert s["rental_total"] == 200.0
    assert s["breakage_total"] == 400.0  # 2 × 200
    assert s["prepaid"] == 50.0
    assert s["to_pay"] == 550.0  # 200 + 400 − 50
    assert s["on_hands"] == []


def test_duplicate_positions_are_merged(client, auth_headers, setup):
    """Одна позиция дважды в запросе → одна строка брони с суммарным количеством.

    Иначе выдача/возврат адресуют позицию по product_id и видят только первую строку.
    """
    bk = client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": setup["client"],
            "location_id": setup["loc"],
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-02",
            "items": [
                {"product_id": setup["plate"], "quantity": 4},
                {"product_id": setup["plate"], "quantity": 6},
            ],
        },
    )
    assert bk.status_code == 201, bk.text
    body = bk.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["quantity"] == 10
    assert body["rental_total"] == 100.0  # 10 × 10 × 1 сутки
    assert _available(client, auth_headers, setup["plate"], setup["loc"]) == 90

    # все 10 доступны к выдаче — не только первая строка
    i = client.post(
        f"/api/v1/bookings/{body['id']}/issue",
        headers=auth_headers,
        json={"items": [{"product_id": setup["plate"], "quantity": 10}]},
    )
    assert i.status_code == 200, i.text
    assert i.json()["items"][0]["issued_qty"] == 10


def test_partial_return_keeps_booking_open(client, auth_headers, setup):
    bk = client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": setup["client"],
            "location_id": setup["loc"],
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-02",
            "items": [{"product_id": setup["plate"], "quantity": 10}],
        },
    ).json()
    bid = bk["id"]
    client.post(
        f"/api/v1/bookings/{bid}/issue",
        headers=auth_headers,
        json={"items": [{"product_id": setup["plate"], "quantity": 10}]},
    )
    r = client.post(
        f"/api/v1/bookings/{bid}/return",
        headers=auth_headers,
        json={"items": [{"product_id": setup["plate"], "quantity": 4}]},
    )
    assert r.json()["status"] == "returned"
    s = client.get(f"/api/v1/bookings/{bid}/settlement", headers=auth_headers).json()
    assert s["on_hands"][0]["product_id"] == setup["plate"]
