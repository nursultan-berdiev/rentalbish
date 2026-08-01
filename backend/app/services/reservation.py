"""Жизненный цикл брони с защитой от двойного бронирования.

Модель остатка (Stock) хранится по компонентам-товарам. Комплект резервируется/
выдаётся через раскрытие в компоненты. Все проверки доступности и изменения
Stock идут под блокировкой строки (``with_for_update`` на Postgres) в рамках
одной транзакции — это исключает гонку при параллельном резерве. Компоненты
всегда блокируются в порядке возрастания id — это исключает взаимоблокировку
двух параллельных операций с пересекающимся составом.
"""

from collections import defaultdict
from collections.abc import Iterator
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import (
    Booking,
    BookingItem,
    Client,
    Issue,
    IssueItem,
    Return,
    ReturnItem,
)
from app.models.catalog import Product
from app.models.enums import BookingStatus, ProductType, WriteOffReason
from app.models.inventory import Stock, WriteOff
from app.models.location import Location
from app.services import audit
from app.services.errors import ConflictError, NotFoundError
from app.services.inventory import get_or_create_stock, get_stock
from app.services.money import money
from app.services.rental_pricing import line_total, rental_days

ACTIVE_STATUSES = (BookingStatus.ISSUED, BookingStatus.RETURNED)


def expand_to_components(product: Product, quantity: int) -> dict[int, int]:
    """Раскрыть позицию в потребность по товарам-компонентам {product_id: qty}."""
    if product.type == ProductType.SET:
        needs: dict[int, int] = defaultdict(int)
        for comp in product.components:
            needs[comp.component_id] += (comp.quantity or 1) * quantity
        return dict(needs)
    return {product.id: quantity}


def _load_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise NotFoundError(f"Товар id={product_id} не найден")
    return product


def _lock_stock(db: Session, product_id: int, location_id: int) -> Stock:
    stock = get_stock(db, product_id, location_id, for_update=True)
    if stock is None:
        stock = get_or_create_stock(db, product_id, location_id)
    return stock


def _locked_components(
    db: Session, product: Product, quantity: int, location_id: int
) -> Iterator[tuple[Stock, int]]:
    """Заблокированные строки остатка по компонентам позиции: (stock, нужное кол-во)."""
    if quantity <= 0:
        return
    for comp_id, comp_qty in sorted(expand_to_components(product, quantity).items()):
        yield _lock_stock(db, comp_id, location_id), comp_qty


def on_hands_items(booking: Booking) -> list[BookingItem]:
    """Позиции брони, которые ещё на руках у клиента."""
    return [bi for bi in booking.items if bi.issued_qty > bi.returned_qty]


def bookings_on_hands(db: Session, *, overdue_as_of: date | None = None) -> list[Booking]:
    """Брони с товаром на руках; при overdue_as_of — только просроченные на эту дату."""
    stmt = select(Booking).where(Booking.status.in_(ACTIVE_STATUSES))
    if overdue_as_of is not None:
        stmt = stmt.where(Booking.expected_return_date < overdue_as_of)
    stmt = stmt.order_by(Booking.expected_return_date)
    return [b for b in db.execute(stmt).scalars().all() if on_hands_items(b)]


def overdue_bookings(db: Session, as_of: date) -> list[Booking]:
    """Брони с товаром на руках и просроченной датой возврата."""
    return bookings_on_hands(db, overdue_as_of=as_of)


def _reserve(db: Session, needs: dict[int, int], location_id: int) -> None:
    """Проверить доступность и занять остаток по компонентам (под блокировкой)."""
    for comp_id, need in sorted(needs.items()):
        stock = _lock_stock(db, comp_id, location_id)
        if stock.available < need:
            comp = db.get(Product, comp_id)
            raise ConflictError(
                f"Недостаточно остатка «{comp.name if comp else comp_id}» на точке: "
                f"нужно {need}, доступно {stock.available}"
            )
        stock.reserved_qty += need


def _needs_of(db: Session, booking: Booking) -> dict[int, int]:
    """Суммарная потребность брони по товарам-компонентам."""
    needs: dict[int, int] = defaultdict(int)
    for bi in booking.items:
        product = _load_product(db, bi.product_id)
        for comp_id, comp_qty in expand_to_components(product, bi.quantity).items():
            needs[comp_id] += comp_qty
    return needs


def confirm_booking(db: Session, booking: Booking, *, user_id: int | None = None) -> Booking:
    """Подтвердить черновик: только здесь остаток проверяется и занимается."""
    if booking.status != BookingStatus.NEW:
        raise ConflictError("Подтвердить можно только черновик")

    _reserve(db, _needs_of(db, booking), booking.location_id)
    booking.status = BookingStatus.CONFIRMED
    audit.record(
        db,
        user_id=user_id,
        action="confirm",
        entity="booking",
        entity_id=booking.id,
        old={"status": BookingStatus.NEW.value},
        new={"status": booking.status.value},
    )
    return booking


def create_booking(
    db: Session,
    *,
    client_id: int,
    location_id: int,
    start_date: date,
    expected_return_date: date,
    items: list[tuple[int, int]],
    deposit: Decimal | None = None,
    prepaid: Decimal = Decimal("0"),
    draft: bool = False,
    user_id: int | None = None,
) -> Booking:
    """Создать бронь.

    По умолчанию бронь сразу подтверждается и резервирует остаток. С draft=True
    создаётся ЧЕРНОВИК: он ничего не резервирует и не влияет на доступность —
    остаток проверяется и занимается только при подтверждении (confirm_booking).
    """
    if not items:
        raise ConflictError("Бронь должна содержать хотя бы одну позицию")
    if db.get(Client, client_id) is None:
        raise NotFoundError(f"Клиент id={client_id} не найден")
    location = db.get(Location, location_id)
    if location is None or not location.is_active:
        raise NotFoundError(f"Точка id={location_id} не найдена или неактивна")

    days = rental_days(start_date, expected_return_date)

    # Одна и та же позиция могла прийти несколькими строками — схлопываем,
    # иначе в брони будет два BookingItem с одним product_id, а выдача/возврат
    # адресуют позицию по product_id и увидят только первый.
    requested: dict[int, int] = defaultdict(int)
    for product_id, qty in items:
        if qty <= 0:
            raise ConflictError("Количество позиции должно быть положительным")
        requested[product_id] += qty

    # Суммарная потребность по компонентам: разные позиции могут делить один
    # компонент — доступность проверяется совокупно.
    needs: dict[int, int] = defaultdict(int)
    booking_items: list[BookingItem] = []
    for product_id, qty in requested.items():
        product = _load_product(db, product_id)
        for comp_id, comp_qty in expand_to_components(product, qty).items():
            needs[comp_id] += comp_qty
        booking_items.append(
            BookingItem(
                product_id=product_id,
                quantity=qty,
                daily_price=product.daily_price,
                line_total=line_total(qty, product.daily_price, days),
            )
        )

    # Черновик остаток не занимает — резерв произойдёт при подтверждении.
    if not draft:
        _reserve(db, needs, location_id)

    booking = Booking(
        client_id=client_id,
        location_id=location_id,
        start_date=start_date,
        expected_return_date=expected_return_date,
        days=days,
        status=BookingStatus.NEW if draft else BookingStatus.CONFIRMED,
        rental_total=sum((bi.line_total for bi in booking_items), Decimal("0")),
        deposit=deposit,
        prepaid=prepaid,
        created_by_id=user_id,
        items=booking_items,
    )
    db.add(booking)
    db.flush()
    audit.record(
        db,
        user_id=user_id,
        action="create",
        entity="booking",
        entity_id=booking.id,
        new={"status": booking.status.value, "location_id": location_id, "days": days},
    )
    return booking


def cancel_booking(db: Session, booking: Booking, *, user_id: int | None = None) -> Booking:
    """Отменить бронь и вернуть зарезервированный (ещё не выданный) остаток.

    Отмена не трогает выданное: если у клиента что-то на руках, эти позиции
    нельзя «потерять» простой отменой — сначала оформляется возврат (он вернёт
    целое в оборот и спишет бой). Иначе `issued_qty` завис бы навсегда.
    """
    if booking.status in (BookingStatus.CLOSED, BookingStatus.CANCELLED):
        raise ConflictError("Бронь уже закрыта или отменена")

    on_hands = sum(bi.issued_qty - bi.returned_qty for bi in booking.items)
    if on_hands > 0:
        raise ConflictError(
            f"Нельзя отменить бронь: на руках {on_hands} ед. Сначала примите возврат."
        )

    # Черновик остаток не занимал — снимать нечего, иначе уменьшим чужой резерв.
    if booking.status != BookingStatus.NEW:
        for bi in booking.items:
            not_issued = bi.quantity - bi.issued_qty
            product = _load_product(db, bi.product_id)
            for stock, comp_qty in _locked_components(db, product, not_issued, booking.location_id):
                stock.reserved_qty = max(0, stock.reserved_qty - comp_qty)

    old_status = booking.status.value
    booking.status = BookingStatus.CANCELLED
    audit.record(
        db,
        user_id=user_id,
        action="cancel",
        entity="booking",
        entity_id=booking.id,
        old={"status": old_status},
        new={"status": booking.status.value},
    )
    return booking


def issue(
    db: Session,
    booking: Booking,
    *,
    items: list[tuple[int, int]],
    user_id: int | None = None,
) -> Issue:
    """Выдать позиции по брони (возможна частичная выдача)."""
    if booking.status not in (BookingStatus.CONFIRMED, BookingStatus.ISSUED):
        raise ConflictError("Выдавать можно только подтверждённую бронь")

    by_product = {bi.product_id: bi for bi in booking.items}
    issue_event = Issue(booking_id=booking.id, issued_at=datetime.now())

    for product_id, qty in items:
        if qty <= 0:
            raise ConflictError("Количество выдачи должно быть положительным")
        bi = by_product.get(product_id)
        if bi is None:
            raise ConflictError(f"Позиция id={product_id} отсутствует в брони")
        remaining = bi.quantity - bi.issued_qty
        if qty > remaining:
            raise ConflictError(
                f"Нельзя выдать {qty} «{bi.product.name}»: осталось к выдаче {remaining}"
            )

        product = _load_product(db, product_id)
        for stock, comp_qty in _locked_components(db, product, qty, booking.location_id):
            if stock.reserved_qty < comp_qty:
                raise ConflictError(f"Рассинхрон резерва по компоненту id={stock.product_id}")
            stock.reserved_qty -= comp_qty
            stock.issued_qty += comp_qty

        bi.issued_qty += qty
        issue_event.items.append(IssueItem(product_id=product_id, quantity=qty))

    if not issue_event.items:
        raise ConflictError("Не переданы позиции для выдачи")

    db.add(issue_event)
    booking.status = BookingStatus.ISSUED
    db.flush()
    audit.record(
        db,
        user_id=user_id,
        action="issue",
        entity="booking",
        entity_id=booking.id,
        new={"items": [(i.product_id, i.quantity) for i in issue_event.items]},
    )
    return issue_event


def return_items(
    db: Session,
    booking: Booking,
    *,
    items: list[tuple[int, int, int]],
    user_id: int | None = None,
) -> Return:
    """Принять возврат по брони. items: (product_id, целых, боя).

    Целые возвращаются в оборот; бой списывается (−total_qty) с удержанием
    по залоговой цене позиции.
    """
    if booking.status not in ACTIVE_STATUSES:
        raise ConflictError("Возврат возможен только по выданной брони")

    by_product = {bi.product_id: bi for bi in booking.items}
    ret = Return(booking_id=booking.id, returned_at=datetime.now())

    for product_id, good, broken in items:
        if good < 0 or broken < 0:
            raise ConflictError("Количества возврата не могут быть отрицательными")
        moved = good + broken
        if moved <= 0:
            continue
        bi = by_product.get(product_id)
        if bi is None:
            raise ConflictError(f"Позиция id={product_id} отсутствует в брони")
        on_hands = bi.issued_qty - bi.returned_qty
        if moved > on_hands:
            raise ConflictError(f"Нельзя принять {moved} «{bi.product.name}»: на руках {on_hands}")

        product = _load_product(db, product_id)
        # Целые: снимаем с issued — возвращаются в доступный остаток.
        for stock, comp_qty in _locked_components(db, product, good, booking.location_id):
            stock.issued_qty = max(0, stock.issued_qty - comp_qty)
        # Бой: снимаем с issued и уменьшаем total — позиция физически выбыла.
        for stock, comp_qty in _locked_components(db, product, broken, booking.location_id):
            stock.issued_qty = max(0, stock.issued_qty - comp_qty)
            stock.total_qty = max(0, stock.total_qty - comp_qty)

        if broken > 0:
            db.add(
                WriteOff(
                    product_id=product_id,
                    location_id=booking.location_id,
                    booking_id=booking.id,
                    quantity=broken,
                    reason=WriteOffReason.BREAKAGE,
                    from_issued=True,
                    amount=money(Decimal(broken) * Decimal(product.deposit_price)),
                    created_by_id=user_id,
                )
            )

        bi.returned_qty += moved
        ret.items.append(ReturnItem(product_id=product_id, quantity=good, broken_qty=broken))

    if not ret.items:
        raise ConflictError("Не переданы позиции для возврата")

    db.add(ret)

    # Ничего не осталось на руках → бронь завершена (после возврата довыдать
    # нельзя). Клиент мог взять меньше, чем бронировал: недовыданный резерв
    # больше не нужен — освобождаем его и закрываем. Иначе — частичный возврат.
    nothing_on_hands = all(bi.returned_qty == bi.issued_qty for bi in booking.items)
    if nothing_on_hands:
        for bi in booking.items:
            not_issued = bi.quantity - bi.issued_qty
            if not_issued <= 0:
                continue
            product = _load_product(db, bi.product_id)
            for stock, comp_qty in _locked_components(db, product, not_issued, booking.location_id):
                stock.reserved_qty = max(0, stock.reserved_qty - comp_qty)
        booking.status = BookingStatus.CLOSED
    else:
        booking.status = BookingStatus.RETURNED
    db.flush()
    audit.record(
        db,
        user_id=user_id,
        action="return",
        entity="booking",
        entity_id=booking.id,
        new={
            "items": [(i.product_id, i.quantity, i.broken_qty) for i in ret.items],
            "status": booking.status.value,
        },
    )
    return ret
