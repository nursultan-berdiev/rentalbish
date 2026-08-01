"""Публичный каталог/заявки и конвертация заявки в бронь."""

from decimal import Decimal

from app.models.catalog import Category, Product, ProductPhoto


def _catalog_product(
    db,
    *,
    name,
    category=None,
    subtitle="",
    description="",
    attributes=None,
    is_new=False,
    photos=("/media/products/x.jpg",),
):
    """Товар с фото прямо в БД — управляем всеми полями витрины."""
    cat = None
    if category:
        cat = Category(name=category)
        db.add(cat)
        db.flush()
    p = Product(
        name=name,
        subtitle=subtitle,
        description=description,
        attributes=attributes or [],
        show_on_site=True,
        is_new=is_new,
        daily_price=Decimal("10"),
        deposit_price=Decimal("0"),
        category_id=cat.id if cat else None,
    )
    for i, path in enumerate(photos):
        p.photos.append(ProductPhoto(file_path=path, is_primary=(i == 0)))
    db.add(p)
    db.commit()
    return p


def test_public_catalog_list_returns_card_fields(client, db):
    _catalog_product(
        db,
        name="Бокал «Аврора»",
        category="Стекло",
        subtitle="Вино · хрусталь",
        description="Длинное описание для модалки.",
        is_new=True,
    )
    items = client.get("/api/v1/catalog/public").json()
    assert len(items) == 1
    it = items[0]
    assert it["category"] == "Стекло"
    assert it["subtitle"] == "Вино · хрусталь"
    assert it["is_new"] is True
    assert "description" not in it  # длинное описание — только в детальной


def test_public_catalog_product_without_new_flag(client, db):
    _catalog_product(db, name="Скатерть «Айвори»", is_new=False)
    items = client.get("/api/v1/catalog/public").json()
    assert len(items) == 1
    assert items[0]["is_new"] is False
    assert items[0]["category"] is None  # без категории — null, не падаем


def test_public_catalog_detail_returns_gallery_and_attributes(client, db):
    p = _catalog_product(
        db,
        name="Тарелка «Прованс» 25 см",
        category="Тарелки",
        subtitle="Обеденная · фарфор · золотой кант",
        description="Классическая обеденная тарелка из белого фарфора.",
        attributes=[
            {"label": "Материал", "value": "Фарфор"},
            {"label": "Диаметр", "value": "25 см"},
        ],
        is_new=True,
        photos=("/media/products/a.jpg", "/media/products/b.jpg", "/media/products/c.jpg"),
    )
    d = client.get(f"/api/v1/catalog/public/{p.id}").json()
    assert d["name"] == "Тарелка «Прованс» 25 см"
    assert d["subtitle"] == "Обеденная · фарфор · золотой кант"
    assert d["description"].startswith("Классическая")
    assert d["photos"] == [
        "/media/products/a.jpg",
        "/media/products/b.jpg",
        "/media/products/c.jpg",
    ]
    assert d["attributes"] == [
        {"label": "Материал", "value": "Фарфор"},
        {"label": "Диаметр", "value": "25 см"},
    ]
    assert d["is_new"] is True


def test_public_catalog_detail_404_for_hidden(client, db):
    p = _catalog_product(db, name="Скрытый")
    p.show_on_site = False
    db.commit()
    assert client.get(f"/api/v1/catalog/public/{p.id}").status_code == 404
    assert client.get("/api/v1/catalog/public/999999").status_code == 404


def _seed_catalog(client, auth_headers):
    loc = client.post("/api/v1/locations", headers=auth_headers, json={"name": "Точка"}).json()[
        "id"
    ]
    prod = client.post(
        "/api/v1/products",
        headers=auth_headers,
        json={"name": "Тарелка", "daily_price": 10, "deposit_price": 200, "show_on_site": True},
    ).json()["id"]
    client.post(
        "/api/v1/inventory/supply",
        headers=auth_headers,
        json={"product_id": prod, "location_id": loc, "quantity": 30},
    )
    return loc, prod


def test_public_catalog_hides_products_without_photo(client, auth_headers):
    _seed_catalog(client, auth_headers)
    # show_on_site=True, но фото нет → в публичный каталог не попадает
    r = client.get("/api/v1/catalog/public")
    assert r.status_code == 200
    assert r.json() == []


def test_weborder_accepted_without_auth(client, auth_headers):
    _loc, prod = _seed_catalog(client, auth_headers)
    r = client.post(
        "/api/v1/weborders",
        json={"name": "Гость", "phone": "0700", "items": [{"product_id": prod, "quantity": 2}]},
    )
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "new"


def test_weborder_convert_creates_client_and_booking(client, auth_headers):
    loc, prod = _seed_catalog(client, auth_headers)
    order = client.post(
        "/api/v1/weborders",
        json={"name": "Гость", "phone": "0700", "items": [{"product_id": prod, "quantity": 5}]},
    ).json()

    conv = client.post(
        f"/api/v1/weborders/{order['id']}/convert",
        headers=auth_headers,
        json={
            "location_id": loc,
            "start_date": "2026-07-01",
            "expected_return_date": "2026-07-02",
        },
    )
    assert conv.status_code == 201, conv.text
    assert conv.json()["status"] == "confirmed"

    # заявка помечена сконвертированной
    got = client.get(f"/api/v1/weborders/{order['id']}", headers=auth_headers).json()
    assert got["status"] == "converted"
    assert got["booking_id"] == conv.json()["id"]

    # клиент создан по телефону
    clients = client.get("/api/v1/clients", headers=auth_headers, params={"q": "0700"}).json()
    assert len(clients) == 1


def test_weborders_list_requires_auth(client):
    r = client.get("/api/v1/weborders")
    assert r.status_code == 401
