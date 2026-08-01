import { useState, type FormEvent } from "react";

import { submitOrder } from "../api";
import { useCart } from "../cart/CartContext";
import { EVENT_OPTIONS } from "../content";
import { buildOrderText } from "../lib/whatsapp";
import { useWaLink } from "../site/SiteContext";

/**
 * Быстрая форма заявки на главной. По кнопке — и сохраняем на бэкенд (админка +
 * Telegram), и открываем WhatsApp с готовым текстом. Позиции берём из общей
 * корзины. Доп. поля (дата/мероприятие/гостей) модель заявки не хранит — уходят
 * в текст комментария.
 */
export default function RequestForm() {
  const { lines: cartLines, itemsInput: items, clear } = useCart();
  const waLink = useWaLink();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [event, setEvent] = useState(EVENT_OPTIONS[0]);
  const [guests, setGuests] = useState(120);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function detailsComment(): string {
    const bits = [`Дата: ${date || "не указана"}`, `Мероприятие: ${event}`, `Гостей: ${guests}`];
    const base = comment.trim();
    return base ? `${bits.join("; ")}. ${base}` : bits.join("; ");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (items.length === 0) {
      setError("Добавьте хотя бы одну позицию из каталога.");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError("Укажите имя и телефон.");
      return;
    }

    const lines = cartLines.map((l) => ({ name: l.product.name, quantity: l.qty }));
    const waText = buildOrderText({ name, phone, date, event, guests, comment, lines });

    setBusy(true);
    try {
      // Заявка на бэкенд — не теряем её, даже если клиент не завершит чат.
      await submitOrder({ name, phone, comment: detailsComment(), items });
    } catch {
      // Бэкенд недоступен — всё равно даём уйти в WhatsApp, но честно предупреждаем.
      setError("Заявка не сохранилась на сервере, но мы открыли WhatsApp — отправьте её там.");
    } finally {
      setBusy(false);
    }

    window.open(waLink(waText), "_blank", "noopener,noreferrer");
    setSent(true);
    clear();
  }

  if (sent) {
    return (
      <section id="zayavka" className="section container container--form">
        <div className="form-card form-sent">
          <h2 className="form-sent__title">Заявка отправлена</h2>
          <p className="form-sent__text">
            Спасибо! Мы открыли WhatsApp с деталями и свяжемся с вами по указанному номеру.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="zayavka" className="section container container--form">
      <form className="form-card" onSubmit={onSubmit} noValidate>
        <span className="eyebrow">Ваша заявка</span>
        <h2 className="form-card__title">Соберём всё для праздника</h2>

        <div className="form-group-label">Детали мероприятия</div>
        <div className="form-details">
          <label className="field">
            <span className="field__label">Дата</span>
            <input
              className="field__input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Мероприятие</span>
            <select
              className="field__select"
              value={event}
              onChange={(e) => setEvent(e.target.value)}
            >
              {EVENT_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Гостей · {guests}</span>
            <input
              className="field__range"
              type="range"
              min={10}
              max={500}
              step={10}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="form-group-label">Контакты</div>
        <div className="form-contacts">
          <input
            className="field__input field__input--lg"
            placeholder="Ваше имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Ваше имя"
          />
          <input
            className="field__input field__input--lg"
            placeholder="Телефон"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-label="Телефон"
          />
          <input
            className="field__input field__input--lg"
            placeholder="Комментарий"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            aria-label="Комментарий"
          />
        </div>

        {error && <p className="form__error">{error}</p>}

        <div className="form__actions">
          <button type="submit" className="form__submit" disabled={busy}>
            {busy ? "Отправка…" : "Отправить в WhatsApp"}
          </button>
          <span className="form__hint">
            В заявке: {items.length} позиц. — укажите детали и контакты выше
          </span>
        </div>
      </form>
    </section>
  );
}
