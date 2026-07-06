"""Тесты аутентификации и ролевого доступа."""


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_login_success(client, admin_user):
    resp = client.post("/api/v1/auth/login", data={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client, admin_user):
    resp = client.post("/api/v1/auth/login", data={"username": "admin", "password": "nope"})
    assert resp.status_code == 401


def test_me_requires_token(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_returns_current_user(client, auth_headers):
    resp = client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["login"] == "admin"
    assert resp.json()["role"] == "admin"


def test_refresh_flow(client, admin_user):
    login = client.post("/api/v1/auth/login", data={"username": "admin", "password": "admin123"})
    refresh_token = login.json()["refresh_token"]
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_refresh_rejects_access_token(client, admin_user):
    login = client.post("/api/v1/auth/login", data={"username": "admin", "password": "admin123"})
    access_token = login.json()["access_token"]
    # access-токен не должен приниматься как refresh
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401


def test_users_endpoint_requires_admin(client, admin_user, auth_headers):
    resp = client.get("/api/v1/users", headers=auth_headers)
    assert resp.status_code == 200
    assert any(u["login"] == "admin" for u in resp.json())


def test_admin_can_create_staff(client, auth_headers):
    resp = client.post(
        "/api/v1/users",
        headers=auth_headers,
        json={"login": "ivan", "full_name": "Иван", "role": "staff", "password": "secret"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["role"] == "staff"
