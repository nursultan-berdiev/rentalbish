"""Списание со склада (бой/утеря/износ), не связанное с активной выдачей.

Уменьшает total_qty на точке; сумма удержания = кол-во × залоговая цена. Бой в
рамках возврата обрабатывается в reservation.return_items.
"""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.catalog import Product
from app.models.enums import WriteOffReason
from app.models.inventory import WriteOff
from app.services import audit
from app.services.errors import ConflictError, NotFoundError
from app.services.inventory import get_stock
from app.services.money import money


def write_off(
    db: Session,
    *,
    product_id: int,
    location_id: int,
    quantity: int,
    reason: WriteOffReason = WriteOffReason.BREAKAGE,
    user_id: int | None = None,
) -> WriteOff:
    if quantity <= 0:
        raise ConflictError("Количество списания должно быть положительным")
    product = db.get(Product, product_id)
    if product is None:
        raise NotFoundError(f"Товар id={product_id} не найден")
    stock = get_stock(db, product_id, location_id, for_update=True)
    if stock is None or stock.available < quantity:
        available = stock.available if stock else 0
        raise ConflictError(f"Недостаточно свободного остатка для списания: доступно {available}")

    stock.total_qty -= quantity
    amount = money(Decimal(quantity) * Decimal(product.deposit_price))
    entry = WriteOff(
        product_id=product_id,
        location_id=location_id,
        quantity=quantity,
        reason=reason,
        from_issued=False,
        amount=amount,
        created_by_id=user_id,
    )
    db.add(entry)
    db.flush()
    audit.record(
        db,
        user_id=user_id,
        action="write_off",
        entity="product",
        entity_id=product_id,
        new={"quantity": quantity, "reason": reason.value, "amount": str(amount)},
    )
    return entry
