"""Excel-импорт каталога и отчёты."""

import io

import openpyxl

from app.services import excel_import


def _make_xlsx(rows: list[list]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(excel_import.COLUMNS)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_template_download(client, auth_headers):
    r = client.get("/api/v1/products/import/template", headers=auth_headers)
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers["content-type"]
    assert len(r.content) > 0


def test_import_preview_and_commit(client, auth_headers):
    data = _make_xlsx(
        [
            ["Тарелка белая", "Тарелки", "PLT-1", "шт", 200, 10, "да"],
            ["Бокал", "Бокалы", "GLS-1", "шт", 150, 5, "нет"],
            ["", "нет имени", "", "шт", 0, 0, ""],  # битая строка
        ]
    )
    files = {"file": ("t.xlsx", data, "application/octet-stream")}

    prev = client.post("/api/v1/products/import/preview", headers=auth_headers, files=files)
    assert prev.status_code == 200, prev.text
    assert prev.json()["parsed"] == 2
    assert len(prev.json()["errors"]) == 1

    files = {"file": ("t.xlsx", data, "application/octet-stream")}
    commit = client.post("/api/v1/products/import/commit", headers=auth_headers, files=files)
    assert commit.status_code == 200, commit.text
    assert commit.json()["created"] == 2

    products = client.get("/api/v1/products", headers=auth_headers).json()
    assert {p["name"] for p in products} == {"Тарелка белая", "Бокал"}


def test_reports_stock_and_movement(client, auth_headers):
    loc = client.post("/api/v1/locations", headers=auth_headers, json={"name": "Точка"}).json()[
        "id"
    ]
    prod = client.post(
        "/api/v1/products", headers=auth_headers, json={"name": "Тарелка", "deposit_price": 200}
    ).json()["id"]
    client.post(
        "/api/v1/inventory/supply",
        headers=auth_headers,
        json={"product_id": prod, "location_id": loc, "quantity": 40},
    )

    stock = client.get("/api/v1/reports/stock", headers=auth_headers).json()
    assert stock[0]["total_qty"] == 40

    mv = client.get(
        "/api/v1/reports/movement",
        headers=auth_headers,
        params={"date_from": "2026-01-01", "date_to": "2030-01-01"},
    ).json()
    assert mv["supplied_qty"] == 40

    xlsx = client.get("/api/v1/reports/stock.xlsx", headers=auth_headers)
    assert xlsx.status_code == 200
    assert "spreadsheetml" in xlsx.headers["content-type"]


def test_staff_activity_admin_only(client, staff_headers):
    r = client.get(
        "/api/v1/reports/staff-activity",
        headers=staff_headers,
        params={"date_from": "2026-01-01", "date_to": "2030-01-01"},
    )
    assert r.status_code == 403
