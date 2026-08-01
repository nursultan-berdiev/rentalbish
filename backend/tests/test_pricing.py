"""Юнит-тесты посуточного расчёта (округление вверх, минимум 1 сутки)."""

from datetime import date
from decimal import Decimal

import pytest

from app.services.errors import DomainError
from app.services.rental_pricing import line_total, rental_days


def test_same_day_is_one_day():
    assert rental_days(date(2026, 7, 1), date(2026, 7, 1)) == 1


def test_full_days():
    assert rental_days(date(2026, 7, 1), date(2026, 7, 3)) == 2


def test_return_before_start_raises():
    with pytest.raises(DomainError):
        rental_days(date(2026, 7, 3), date(2026, 7, 1))


def test_line_total():
    assert line_total(10, Decimal("10.00"), 2) == Decimal("200.00")
    assert line_total(2, Decimal("80.00"), 3) == Decimal("480.00")
