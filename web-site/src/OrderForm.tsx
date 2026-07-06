import { useState, type FormEvent } from "react";
import { submitOrder, type CatalogProduct } from "./api";

export default function OrderForm({ products }: { products: CatalogProduct[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await submitOrder({
        name,
        phone,
        comment,
        // На каркасе позиции корзины ещё не выбираются — отправляем контакт.
        // Выбор позиций из каталога подключается в Этапе 3.
        items: products.length ? [{ product_id: products[0].id, quantity: 1 }] : [],
      });
      setSent(true);
    } catch {
      setError("Не удалось отправить заявку. Попробуйте позже.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <section className="order">
        <h2>Заявка отправлена</h2>
        <p>Спасибо! Мы свяжемся с вами по указанному номеру.</p>
      </section>
    );
  }

  return (
    <section className="order">
      <h2>Оставить заявку</h2>
      <form onSubmit={onSubmit}>
        <label>
          Имя
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Телефон
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            inputMode="tel"
            placeholder="+996 ___ __ __ __"
          />
        </label>
        <label>
          Комментарий
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Отправка..." : "Отправить заявку"}
        </button>
      </form>
    </section>
  );
}
