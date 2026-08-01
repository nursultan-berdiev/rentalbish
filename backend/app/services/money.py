"""Денежные величины: единая нормализация к 2 знакам."""

from decimal import Decimal

CENTS = Decimal("0.01")


def money(value: object) -> Decimal:
    """Привести число/строку/Decimal к денежному Decimal с 2 знаками."""
    return Decimal(str(value)).quantize(CENTS)
