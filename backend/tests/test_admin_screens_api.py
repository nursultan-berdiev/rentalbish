"""API, которое питает новые экраны панели: сводка клиента, фото товара, категории."""

import io

import openpyxl


def _png() -> bytes:
    import base64

    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
    )


def test_client_summary_debt_and_on_hands(client, auth_headers):
    loc = client.post("/api/v1/locations", headers=auth_headers, json={"name": "Точка"}).json()[
        "id"
    ]
    prod = client.post(
        "/api/v1/products",
        headers=auth_headers,
        json={"name": "Тарелка", "daily_price": 10, "deposit_price": 200},
    ).json()["id"]
    client.post(
        "/api/v1/inventory/supply",
        headers=auth_headers,
        json={"product_id": prod, "location_id": loc, "quantity": 50},
    )
    cl = client.post(
        "/api/v1/clients", headers=auth_headers, json={"name": "Иван", "phone": "0555"}
    ).json()["id"]
    bk = client.post(
        "/api/v1/bookings",
        headers=auth_headers,
        json={
            "client_id": cl,
            "location_id": loc,
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-03",
            "items": [{"product_id": prod, "quantity": 10}],
            "prepaid": 50,
        },
    ).json()
    client.post(
        f"/api/v1/bookings/{bk['id']}/issue",
        headers=auth_headers,
        json={"items": [{"product_id": prod, "quantity": 10}]},
    )

    s = client.get(f"/api/v1/clients/{cl}/summary", headers=auth_headers).json()
    assert s["client"]["name"] == "Иван"
    assert s["bookings_count"] == 1
    # аренда 10×10×2 = 200, предоплата 50 → долг 150
    assert s["debt"] == 150.0
    assert s["on_hands"][0]["qty"] == 10


def test_photo_delete_and_primary(client, auth_headers):
    prod = client.post("/api/v1/products", headers=auth_headers, json={"name": "Тарелка"}).json()[
        "id"
    ]
    for _ in range(2):
        client.post(
            f"/api/v1/products/{prod}/photos",
            headers=auth_headers,
            files={"file": ("p.png", _png(), "image/png")},
        )
    p = client.get(f"/api/v1/products/{prod}", headers=auth_headers).json()
    assert len(p["photos"]) == 2
    first, second = p["photos"]
    assert first["is_primary"] and not second["is_primary"]

    # назначаем главным второе
    p = client.post(
        f"/api/v1/products/{prod}/photos/{second['id']}/primary", headers=auth_headers
    ).json()
    assert [ph["is_primary"] for ph in p["photos"]] == [False, True]

    # удаляем главное → главным становится оставшееся
    p = client.delete(f"/api/v1/products/{prod}/photos/{second['id']}", headers=auth_headers).json()
    assert len(p["photos"]) == 1
    assert p["photos"][0]["is_primary"] is True


def test_category_rename(client, auth_headers):
    cat = client.post("/api/v1/categories", headers=auth_headers, json={"name": "Тарелки"}).json()
    r = client.patch(
        f"/api/v1/categories/{cat['id']}", headers=auth_headers, json={"name": "Посуда"}
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Посуда"


def test_excel_import_wizard(client, auth_headers):
    from app.services import excel_import

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(excel_import.COLUMNS)
    ws.append(["Вилка", "Приборы", "FRK-1", "шт", 120, 8, "да"])
    buf = io.BytesIO()
    wb.save(buf)
    data = buf.getvalue()

    prev = client.post(
        "/api/v1/products/import/preview",
        headers=auth_headers,
        files={"file": ("t.xlsx", data, "application/octet-stream")},
    ).json()
    assert prev["parsed"] == 1 and prev["rows"][0]["name"] == "Вилка"

    commit = client.post(
        "/api/v1/products/import/commit",
        headers=auth_headers,
        files={"file": ("t.xlsx", data, "application/octet-stream")},
    ).json()
    assert commit["created"] == 1


def test_excel_import_marks_invalid_rows(client, auth_headers):
    """QA 4.6: в предпросмотре видны ВСЕ строки, битые помечены error и не импортируются."""
    from app.services import excel_import

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(excel_import.COLUMNS)
    ws.append(["Хороший", "Посуда", "OK-1", "шт", 100, 20, "да"])  # валидная
    ws.append(["", "Посуда", "X-1", "шт", 100, 20, "да"])  # пустое имя
    ws.append(["Битая цена", "Посуда", "X-2", "шт", "abc", "xyz", "да"])  # не число
    buf = io.BytesIO()
    wb.save(buf)
    data = buf.getvalue()

    prev = client.post(
        "/api/v1/products/import/preview",
        headers=auth_headers,
        files={"file": ("t.xlsx", data, "application/octet-stream")},
    ).json()
    # в предпросмотре ВСЕ три строки; к импорту — только одна валидная
    assert len(prev["rows"]) == 3
    assert prev["parsed"] == 1
    valid = [r for r in prev["rows"] if not r["error"]]
    invalid = [r for r in prev["rows"] if r["error"]]
    assert [r["name"] for r in valid] == ["Хороший"]
    assert len(invalid) == 2  # пустое имя + битые числа
    assert "пустое наименование" in invalid[0]["error"]

    commit = client.post(
        "/api/v1/products/import/commit",
        headers=auth_headers,
        files={"file": ("t.xlsx", data, "application/octet-stream")},
    ).json()
    assert commit["created"] == 1  # битые не создались
