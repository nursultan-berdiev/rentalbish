"""Тесты каталога, остатков и доступности (в т.ч. комплекты) через API."""


def _mk_location(client, headers, name="Точка 1"):
    r = client.post("/api/v1/locations", headers=headers, json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _mk_product(client, headers, name, daily=10, deposit=200, show=False):
    r = client.post(
        "/api/v1/products",
        headers=headers,
        json={"name": name, "daily_price": daily, "deposit_price": deposit, "show_on_site": show},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_location_crud_requires_admin(client, staff_headers):
    r = client.post("/api/v1/locations", headers=staff_headers, json={"name": "X"})
    assert r.status_code == 403


def test_staff_can_read_locations(client, auth_headers, staff_headers):
    _mk_location(client, auth_headers)
    r = client.get("/api/v1/locations", headers=staff_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_supply_increases_available(client, auth_headers):
    loc = _mk_location(client, auth_headers)
    prod = _mk_product(client, auth_headers, "Тарелка")
    r = client.post(
        "/api/v1/inventory/supply",
        headers=auth_headers,
        json={"product_id": prod, "location_id": loc, "quantity": 50},
    )
    assert r.status_code == 201, r.text
    a = client.get(
        "/api/v1/inventory/available",
        headers=auth_headers,
        params={"product_id": prod, "location_id": loc},
    )
    assert a.json()["available"] == 50


def test_set_availability_limited_by_scarcest_component(client, auth_headers):
    loc = _mk_location(client, auth_headers)
    plate = _mk_product(client, auth_headers, "Тарелка")
    glass = _mk_product(client, auth_headers, "Бокал")
    for pid, qty in ((plate, 100), (glass, 50)):
        client.post(
            "/api/v1/inventory/supply",
            headers=auth_headers,
            json={"product_id": pid, "location_id": loc, "quantity": qty},
        )
    # набор: 6 тарелок + 6 бокалов → min(100//6, 50//6) = 8
    r = client.post(
        "/api/v1/products",
        headers=auth_headers,
        json={
            "name": "Набор на 6",
            "type": "set",
            "daily_price": 80,
            "components": [
                {"component_id": plate, "quantity": 6},
                {"component_id": glass, "quantity": 6},
            ],
        },
    )
    assert r.status_code == 201, r.text
    set_id = r.json()["id"]
    a = client.get(
        "/api/v1/inventory/available",
        headers=auth_headers,
        params={"product_id": set_id, "location_id": loc},
    )
    assert a.json()["available"] == 8
    assert a.json()["is_set"] is True


def test_write_off_reduces_total(client, auth_headers):
    loc = _mk_location(client, auth_headers)
    prod = _mk_product(client, auth_headers, "Бокал", deposit=150)
    client.post(
        "/api/v1/inventory/supply",
        headers=auth_headers,
        json={"product_id": prod, "location_id": loc, "quantity": 20},
    )
    r = client.post(
        "/api/v1/inventory/write-off",
        headers=auth_headers,
        json={"product_id": prod, "location_id": loc, "quantity": 3, "reason": "breakage"},
    )
    assert r.status_code == 201, r.text
    assert float(r.json()["amount"]) == 450.0  # 3 × 150
    a = client.get(
        "/api/v1/inventory/available",
        headers=auth_headers,
        params={"product_id": prod, "location_id": loc},
    )
    assert a.json()["available"] == 17
