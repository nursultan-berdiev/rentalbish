"""Встроенные блоки дашборда — те же спецификации, что сочиняет ИИ.

Живут в коде, синхронизируются в таблицу при старте. Админ может их скрыть и
переставить; удалить нельзя — иначе дашборд «из коробки» разъехался бы навсегда.
"""

BUILTIN_WIDGETS: list[dict] = [
    {
        "key": "kpi_main",
        "position": 10,
        "spec": {
            "title": "Итоги за период",
            "chart": "kpi",
            "span": 3,
            "compare": True,
            "query": {
                "dataset": "bookings",
                "measures": ["revenue", "billable_count", "avg_check", "breakage"],
            },
            "series": [
                {"measure": "revenue", "color": "accent"},
                {"measure": "billable_count", "color": "violet"},
                {"measure": "avg_check", "color": "green"},
                {"measure": "breakage", "color": "danger"},
            ],
        },
    },
    {
        "key": "revenue_by_day",
        "position": 20,
        "spec": {
            "title": "Выручка и брони по дням",
            "chart": "combo",
            "span": 2,
            "query": {
                "dataset": "bookings",
                "measures": ["revenue", "billable_count"],
                "dimensions": ["day"],
                "limit": 400,
            },
            "series": [
                {
                    "measure": "revenue",
                    "label": "Выручка",
                    "color": "accent",
                    "type": "area",
                    "axis": "left",
                },
                {
                    # Число броней — линией, а не столбцами: на 30-дневном окне столбцы
                    # с нулевыми днями выглядели «дырявыми» и спорили со столбцами выручки.
                    "measure": "billable_count",
                    "label": "Броней",
                    "color": "violet",
                    "type": "line",
                    "axis": "right",
                },
            ],
        },
    },
    {
        "key": "bookings_by_status",
        "position": 30,
        "spec": {
            "title": "Брони по статусам",
            "chart": "donut",
            "span": 1,
            "query": {
                "dataset": "bookings",
                "measures": ["count"],
                "dimensions": ["status"],
            },
            "series": [{"measure": "count", "color": "by_status"}],
        },
    },
    {
        "key": "top_products",
        "position": 40,
        "spec": {
            "title": "Топ товаров по выручке",
            "chart": "hbar",
            "span": 2,
            "query": {
                "dataset": "booking_items",
                "measures": ["amount"],
                "dimensions": ["product"],
                "order_by": "-amount",
                "limit": 10,
            },
            "series": [{"measure": "amount", "label": "Выручка", "color": "accent"}],
        },
    },
    {
        "key": "breakage_by_reason",
        "position": 50,
        "spec": {
            "title": "Списания по причинам",
            "chart": "donut",
            "span": 1,
            "query": {
                "dataset": "writeoffs",
                "measures": ["amount"],
                "dimensions": ["reason"],
            },
            "series": [{"measure": "amount", "color": "by_value"}],
        },
    },
    {
        "key": "stock_load",
        "position": 60,
        "spec": {
            "title": "Загрузка склада по категориям",
            "chart": "stacked_bar",
            "span": 2,
            "query": {
                "dataset": "stock",
                "measures": ["free", "reserved", "issued"],
                "dimensions": ["category"],
                "order_by": "-free",
                "limit": 12,
            },
            "series": [
                {"measure": "free", "label": "Свободно", "color": "green"},
                {"measure": "reserved", "label": "В брони", "color": "accent"},
                {"measure": "issued", "label": "Выдано", "color": "amber"},
            ],
        },
    },
    {
        "key": "client_sources",
        "position": 70,
        "spec": {
            "title": "Откуда пришли клиенты",
            "chart": "donut",
            "span": 1,
            "query": {
                "dataset": "bookings",
                "measures": ["count"],
                "dimensions": ["client_source"],
            },
            "series": [{"measure": "count", "color": "by_value"}],
        },
    },
    {
        "key": "movements_by_day",
        "position": 80,
        "spec": {
            "title": "Выдачи и возвраты по дням",
            "chart": "bar",
            "span": 2,
            "query": {
                "dataset": "movements",
                "measures": ["qty"],
                "dimensions": ["day", "kind"],
                "limit": 400,
            },
            "series": [{"measure": "qty", "color": "by_value"}],
        },
    },
    {
        "key": "weborder_funnel",
        "position": 90,
        "spec": {
            "title": "Заявки с сайта",
            "chart": "bar",
            "span": 1,
            "query": {
                "dataset": "weborders",
                "measures": ["count"],
                "dimensions": ["status"],
                "order_by": "-count",
            },
            "series": [{"measure": "count", "label": "Заявок", "color": "violet"}],
        },
    },
]
