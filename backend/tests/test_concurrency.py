"""Конкурентное двойное бронирование — проверка блокировки FOR UPDATE.

Воспроизводится только на Postgres (SQLite не поддерживает row-level FOR UPDATE
с реальным параллелизмом). Запуск:
    TEST_DATABASE_URL=postgresql+psycopg2://rental:rental@localhost:5433/rental \
        pytest -k concurrency
"""

import os
import threading
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.booking import Client
from app.models.catalog import Product
from app.models.enums import BookingStatus
from app.models.location import Location
from app.services import inventory, reservation
from app.services.errors import ConflictError

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"),
    reason="Требуется Postgres (TEST_DATABASE_URL) для проверки FOR UPDATE",
)


def test_parallel_booking_of_last_unit_rejects_one():
    engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    # Подготовка: 1 точка, 1 товар, ровно 1 единица на складе.
    with Session() as s:
        loc = Location(name="Точка")
        prod = Product(name="Единственная тарелка")
        cl = Client(name="Клиент", phone="0555")
        s.add_all([loc, prod, cl])
        s.flush()
        inventory.supply(s, prod.id, loc.id, 1)
        s.commit()
        loc_id, prod_id, client_id = loc.id, prod.id, cl.id

    results: list[str] = []
    barrier = threading.Barrier(2)

    def attempt():
        barrier.wait()  # стартуем одновременно
        with Session() as s:
            try:
                reservation.create_booking(
                    s,
                    client_id=client_id,
                    location_id=loc_id,
                    start_date=date(2026, 7, 1),
                    expected_return_date=date(2026, 7, 2),
                    items=[(prod_id, 1)],
                )
                s.commit()
                results.append("ok")
            except ConflictError:
                s.rollback()
                results.append("rejected")

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Ровно один успех и один отказ — двойного бронирования не произошло.
    assert sorted(results) == ["ok", "rejected"]

    with Session() as s:
        confirmed = (
            s.query(reservation.Booking)
            .filter(reservation.Booking.status == BookingStatus.CONFIRMED)
            .count()
        )
        assert confirmed == 1

    Base.metadata.drop_all(engine)
