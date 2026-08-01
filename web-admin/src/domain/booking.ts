/**
 * Правила брони, общие для всех экранов.
 *
 * Раньше «что на руках» и «сколько дней просрочки» считались в каждом экране заново,
 * и формулы успели разойтись: «Обзор» округлял дни через round, а design/css.ts —
 * через ceil, из-за чего одна и та же бронь могла показать разное число дней.
 */
import type { Booking, BookingItem } from "../api/domain";

/** Сколько единиц позиции реально у клиента: выдано минус возвращено минус бой. */
export function onHandsQty(it: BookingItem): number {
  return it.issued_qty - it.returned_qty - it.broken_qty;
}

/** Состав «на руках» строкой: «10 × Тарелка, 6 × Бокал». */
export function onHandsLabel(b: Booking): string {
  return b.items
    .filter((it) => onHandsQty(it) > 0)
    .map((it) => `${onHandsQty(it)} × ${it.product_name}`)
    .join(", ");
}

/** Бронь просрочена: товар ещё у клиента, а срок возврата прошёл. */
export function isOverdue(b: Booking): boolean {
  return (
    ["issued", "returned"].includes(b.status) &&
    b.items.some((it) => onHandsQty(it) > 0) &&
    new Date(b.expected_return_date) < new Date()
  );
}

/** Дней просрочки, минимум 1. Считаем вверх — как и срок аренды. */
export function daysOverdue(b: Booking): number {
  const ms = Date.now() - new Date(b.expected_return_date).getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}
