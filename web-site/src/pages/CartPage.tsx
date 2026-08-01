/**
 * «Ваша заявка» — корзина витрины. Список позиций + сводка (дата, срок, итого).
 * Отправка: мини-шаг контактов (имя+телефон) → сохраняем на бэкенд и открываем
 * WhatsApp. Позиции и суммы — из общей корзины.
 */
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { photoUrl, submitOrder } from "../api";
import { useCart } from "../cart/CartContext";
import { I_ARROW_LEFT, I_CART, I_CLOSE, Svg } from "../components/icons";
import { buildOrderText } from "../lib/whatsapp";
import { useWaLink } from "../site/SiteContext";

const money = (n: number) => `${n.toLocaleString("ru-RU")} сом`;

export default function CartPage() {
  const { lines, count, rentalTotal, itemsInput, setQty, remove, clear } = useCart();
  const waLink = useWaLink();
  const [date, setDate] = useState("");
  const [days, setDays] = useState(1);
  const [stage, setStage] = useState<"cart" | "contacts" | "sent">("cart");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = rentalTotal * Math.max(1, days);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError("Укажите имя и телефон.");
      return;
    }
    const waLines = lines.map((l) => ({ name: l.product.name, quantity: l.qty }));
    const comment = [
      `Дата: ${date || "не указана"}`,
      `Срок: ${days} сут.`,
      `Итого: ${money(total)}`,
    ].join("; ");
    const waText = buildOrderText({
      name,
      phone,
      date,
      comment: `Срок аренды: ${days} сут. Итого ≈ ${money(total)}`,
      lines: waLines,
    });

    setBusy(true);
    try {
      await submitOrder({ name, phone, comment, items: itemsInput });
    } catch {
      setError("Не удалось сохранить на сервере — открываем WhatsApp, отправьте заявку там.");
    } finally {
      setBusy(false);
    }
    window.open(waLink(waText), "_blank", "noopener,noreferrer");
    clear();
    setStage("sent");
  }

  return (
    <main className="page">
      <div className="container cart">
        <nav className="crumbs" aria-label="Хлебные крошки">
          <Link to="/">Главная</Link> · Заявка
        </nav>

        {stage === "sent" ? (
          <div className="cart-empty">
            <div className="cart-empty__icon cart-empty__icon--ok">
              <Svg paths={I_CART} size={30} sw={1.6} />
            </div>
            <h1 className="cart-empty__title">Заявка отправлена</h1>
            <p className="cart-empty__text">
              Спасибо! Мы открыли WhatsApp с деталями и свяжемся по указанному номеру.
            </p>
            <Link to="/catalog" className="btn btn--olive btn--lg">
              Вернуться в каталог
            </Link>
          </div>
        ) : count === 0 ? (
          <>
            <h1 className="cart__h1">Ваша заявка</h1>
            <div className="cart-empty">
              <div className="cart-empty__icon">
                <Svg paths={I_CART} size={30} sw={1.6} />
              </div>
              <h2 className="cart-empty__title">В заявке пока пусто</h2>
              <p className="cart-empty__text">
                Добавьте посуду, мебель или декор из каталога — соберём заявку под ваш праздник
                вместе.
              </p>
              <Link to="/catalog" className="btn btn--olive btn--lg">
                Перейти в каталог
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="cart__head">
              <h1 className="cart__h1">Ваша заявка</h1>
              <span className="cart__count">{count} позиц.</span>
            </div>

            <div className="cart__grid">
              <div className="cart__list">
                {lines.map((l) => (
                  <div className="cart-row card" key={l.product.id}>
                    <div className="cart-row__media">
                      {l.product.photo_url && (
                        <img src={photoUrl(l.product.photo_url)} alt={l.product.name} loading="lazy" />
                      )}
                    </div>
                    <div className="cart-row__info">
                      <div className="cart-row__name">{l.product.name}</div>
                      <div className="cart-row__sub">
                        {l.product.subtitle} · от {l.product.daily_price} сом/шт
                      </div>
                    </div>
                    <div className="qty cart-row__qty">
                      <button
                        type="button"
                        className="qty__btn"
                        aria-label="Убрать одну"
                        onClick={() => setQty(l.product.id, l.qty - 1)}
                      >
                        −
                      </button>
                      <span className="qty__val">{l.qty}</span>
                      <button
                        type="button"
                        className="qty__btn"
                        aria-label="Добавить одну"
                        disabled={l.qty >= l.product.available}
                        onClick={() => setQty(l.product.id, l.qty + 1)}
                      >
                        +
                      </button>
                    </div>
                    <div className="cart-row__sum">{money(l.product.daily_price * l.qty)}</div>
                    <button
                      type="button"
                      className="cart-row__del"
                      aria-label="Удалить позицию"
                      onClick={() => remove(l.product.id)}
                    >
                      <Svg paths={I_CLOSE} size={14} />
                    </button>
                  </div>
                ))}

                <Link to="/catalog" className="cart__back">
                  <Svg paths={I_ARROW_LEFT} size={15} /> Продолжить выбор в каталоге
                </Link>
              </div>

              <aside className="cart-summary card">
                <div className="cart-summary__eyebrow">Итого по заявке</div>
                <div className="cart-summary__row">
                  <span>Позиции</span>
                  <b>{count} шт.</b>
                </div>
                <div className="cart-summary__row">
                  <span>Аренда</span>
                  <b>{money(rentalTotal)}</b>
                </div>
                <label className="cart-summary__row cart-summary__field">
                  <span>Дата</span>
                  <input
                    type="date"
                    className="cart-summary__input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label className="cart-summary__row cart-summary__field">
                  <span>Срок, сут.</span>
                  <input
                    type="number"
                    min={1}
                    className="cart-summary__input cart-summary__input--num"
                    value={days}
                    onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                  />
                </label>

                <div className="cart-summary__total">
                  <span className="cart-summary__total-l">Итого</span>
                  <span className="cart-summary__total-v">
                    {money(total)} <span className="cart-summary__total-u">/ {days} сут.</span>
                  </span>
                </div>

                {stage === "contacts" ? (
                  <form className="cart-contacts" onSubmit={submit} noValidate>
                    <input
                      className="field__input field__input--lg"
                      placeholder="Ваше имя"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      aria-label="Ваше имя"
                      autoFocus
                    />
                    <input
                      className="field__input field__input--lg"
                      placeholder="Телефон"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      aria-label="Телефон"
                    />
                    {error && <p className="form__error">{error}</p>}
                    <button type="submit" className="btn btn--olive cart-summary__send" disabled={busy}>
                      {busy ? "Отправка…" : "Отправить в WhatsApp"}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="btn btn--olive cart-summary__send"
                    onClick={() => setStage("contacts")}
                  >
                    Отправить в WhatsApp
                  </button>
                )}
                <p className="cart-summary__note">
                  Точную сумму и возвратный залог подтвердим в WhatsApp. Минимальный срок аренды — 1
                  сутки.
                </p>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
