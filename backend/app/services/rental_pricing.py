"""Посуточный расчёт аренды.

Правило (согласовано в ФТ): число суток = дата возврата − дата начала, всегда
округляется ВВЕРХ до полных суток; минимум — 1 сутки. Аренда за позицию =
кол-во × суточная цена × число суток.
"""

from datetime import date
from decimal import Decimal

from app.services.errors import DomainError
from app.services.money import money


def rental_days(start: date, expected_return: date) -> int:
    """Число полных суток аренды (минимум 1). Возврат в тот же день = 1 сутки."""
    if expected_return < start:
        raise DomainError("Дата возврата не может быть раньше даты начала")
    delta = (expected_return - start).days
    return max(delta, 1)


def line_total(quantity: int, daily_price: Decimal, days: int) -> Decimal:
    return money(Decimal(quantity) * Decimal(daily_price) * Decimal(days))
