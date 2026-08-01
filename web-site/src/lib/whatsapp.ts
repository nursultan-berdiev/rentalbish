/**
 * Текст заявки и ссылка для WhatsApp.
 *
 * Форма отправляет заявку и на бэкенд (/weborders → админка + Telegram), и в
 * WhatsApp — по букве макета. Номер — единый на весь сайт; берётся из настроек
 * сайта (см. useWaLink в site/SiteContext). Константа ниже — фолбэк на случай,
 * если настройки ещё не загрузились или запрос упал.
 */

export const WA_PHONE_FALLBACK = "996552080610";

export interface OrderLine {
  name: string;
  quantity: number;
}

export interface OrderText {
  name: string;
  phone: string;
  date?: string;
  event?: string;
  guests?: number;
  comment?: string;
  lines: OrderLine[];
}

/** Многострочный текст заявки: детали мероприятия → позиции → контакты → комментарий. */
export function buildOrderText(o: OrderText): string {
  const parts: string[] = ["Здравствуйте! Заявка на аренду с сайта Rental_bish."];

  const details: string[] = [];
  if (o.date) details.push(`Дата: ${o.date}`);
  if (o.event) details.push(`Мероприятие: ${o.event}`);
  if (o.guests) details.push(`Гостей: ${o.guests}`);
  if (details.length) parts.push("", ...details);

  if (o.lines.length) {
    parts.push("", "Позиции:");
    for (const l of o.lines) parts.push(`• ${l.name} × ${l.quantity}`);
  }

  parts.push("", `Имя: ${o.name}`, `Телефон: ${o.phone}`);
  if (o.comment?.trim()) parts.push(`Комментарий: ${o.comment.trim()}`);

  return parts.join("\n");
}

/** Ссылка wa.me с готовым текстом. Номер передаётся явно (из настроек сайта). */
export function buildWaLink(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
