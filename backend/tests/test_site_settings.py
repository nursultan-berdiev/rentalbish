"""Настройки сайта: публичный статус витрины + админское обновление (тумблер, номер)."""


def test_public_status_default(client):
    """Публичный GET без токена — заглушка включена по умолчанию, номер засеян."""
    r = client.get("/api/v1/site/status")
    assert r.status_code == 200
    body = r.json()
    assert body["maintenance"] is True
    assert body["whatsapp_phone"] == "996552080610"


def test_admin_toggles_maintenance(client, auth_headers):
    r = client.patch(
        "/api/v1/site/settings", headers=auth_headers, json={"maintenance_mode": False}
    )
    assert r.status_code == 200
    assert r.json()["maintenance_mode"] is False
    # публичный статус отражает изменение
    assert client.get("/api/v1/site/status").json()["maintenance"] is False


def test_admin_updates_phone_only(client, auth_headers):
    """exclude_unset: обновление только телефона не трогает режим обслуживания."""
    r = client.patch(
        "/api/v1/site/settings", headers=auth_headers, json={"whatsapp_phone": "996700111222"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["whatsapp_phone"] == "996700111222"
    assert body["maintenance_mode"] is True  # не изменился

    status = client.get("/api/v1/site/status").json()
    assert status["whatsapp_phone"] == "996700111222"
    assert status["maintenance"] is True


def test_staff_forbidden(client, staff_headers):
    r = client.patch(
        "/api/v1/site/settings", headers=staff_headers, json={"maintenance_mode": False}
    )
    assert r.status_code == 403


def test_anonymous_forbidden(client):
    r = client.patch("/api/v1/site/settings", json={"maintenance_mode": False})
    assert r.status_code == 401
