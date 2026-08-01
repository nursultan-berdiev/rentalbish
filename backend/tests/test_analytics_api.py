"""API аналитики и права: кто может смотреть, а кто — менять состав дашборда."""

from app.ai import analytics_tools
from app.analytics import service


def test_schema_lists_datasets(client, auth_headers):
    resp = client.get("/api/v1/analytics/schema", headers=auth_headers)
    assert resp.status_code == 200
    keys = {d["key"] for d in resp.json()["datasets"]}
    assert {"bookings", "stock", "writeoffs", "movements", "weborders"} <= keys


def test_dashboard_returns_builtin_widgets(client, auth_headers, db):
    service.sync_builtin_widgets(db)
    resp = client.get("/api/v1/analytics/dashboard", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["period"]["days"] == 30  # период по умолчанию
    assert {w["key"] for w in body["widgets"]} >= {"kpi_main", "revenue_by_day"}
    assert "overdue" in body["now"]


def test_staff_can_read_but_not_change(client, staff_headers, db):
    service.sync_builtin_widgets(db)
    assert client.get("/api/v1/analytics/dashboard", headers=staff_headers).status_code == 200

    spec = {
        "title": "Свой блок",
        "chart": "donut",
        "query": {"dataset": "bookings", "measures": ["count"], "dimensions": ["status"]},
    }
    assert (
        client.post("/api/v1/analytics/widgets", json=spec, headers=staff_headers).status_code
        == 403
    )


def test_admin_creates_and_deletes_widget(client, auth_headers, db):
    service.sync_builtin_widgets(db)
    spec = {
        "title": "Выручка по точкам",
        "chart": "bar",
        "span": 2,
        "query": {
            "dataset": "bookings",
            "measures": ["revenue"],
            "dimensions": ["location"],
            "order_by": "-revenue",
        },
    }
    resp = client.post("/api/v1/analytics/widgets", json=spec, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    widget_id = resp.json()["id"]
    assert resp.json()["is_builtin"] is False

    board = client.get("/api/v1/analytics/dashboard", headers=auth_headers).json()
    added = next(w for w in board["widgets"] if w["id"] == widget_id)
    assert added["title"] == "Выручка по точкам" and added["error"] is None

    assert (
        client.delete(f"/api/v1/analytics/widgets/{widget_id}", headers=auth_headers).status_code
        == 204
    )


def test_builtin_widget_cannot_be_deleted_only_hidden(client, auth_headers, db):
    service.sync_builtin_widgets(db)
    builtin = next(w for w in service.list_widgets(db) if w.key == "kpi_main")

    resp = client.delete(f"/api/v1/analytics/widgets/{builtin.id}", headers=auth_headers)
    assert resp.status_code == 409

    resp = client.patch(
        f"/api/v1/analytics/widgets/{builtin.id}", json={"is_visible": False}, headers=auth_headers
    )
    assert resp.status_code == 200 and resp.json()["is_visible"] is False

    board = client.get("/api/v1/analytics/dashboard", headers=auth_headers).json()
    assert "kpi_main" not in {w["key"] for w in board["widgets"]}  # скрытый не отдаётся


def test_bad_spec_rejected_with_readable_reason(client, auth_headers):
    resp = client.post(
        "/api/v1/analytics/widgets",
        json={
            "title": "Ерунда",
            "chart": "bar",
            "query": {
                "dataset": "bookings",
                "measures": ["avg_rental_days"],
                "dimensions": ["day"],
            },
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert "нет метрики" in resp.json()["detail"]  # ассистент увидит причину и исправится


# --- инструменты ИИ -----------------------------------------------------------


def test_ai_tool_add_widget_requires_admin(db, staff_user, admin_user):
    widget = {
        "title": "Тест",
        "chart": "donut",
        "query": {"dataset": "bookings", "measures": ["count"], "dimensions": ["status"]},
    }
    denied = analytics_tools.analytics_add_widget(db, staff_user, widget=widget)
    assert "error" in denied  # роль проверена на сервере, а не со слов модели

    ok = analytics_tools.analytics_add_widget(db, admin_user, widget=widget)
    assert ok["ok"] is True
    assert any(w["title"] == "Тест" for w in analytics_tools.analytics_list_widgets(db, admin_user))


def test_ai_tool_unknown_metric_returns_error_not_crash(db, admin_user):
    result = analytics_tools.analytics_add_widget(
        db,
        admin_user,
        widget={
            "title": "Средняя длительность",
            "chart": "bar",
            "query": {
                "dataset": "bookings",
                "measures": ["avg_days"],
                "dimensions": ["location"],
            },
        },
    )
    assert "error" in result and "нет метрики" in result["error"]


def test_ai_tool_cannot_reach_beyond_dictionary(db, admin_user):
    """Попытка дотянуться до чужой таблицы упирается в словарь, а не в SQL."""
    result = analytics_tools.analytics_query(
        db, admin_user, query={"dataset": "users", "measures": ["count"], "dimensions": ["login"]}
    )
    assert "error" in result and "Нет набора данных" in result["error"]
