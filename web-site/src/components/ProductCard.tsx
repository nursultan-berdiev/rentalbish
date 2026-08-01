/** Карточка товара — общая для лендинга и страницы каталога. */
import { photoUrl, type CatalogProduct } from "../api";
import { useCart } from "../cart/CartContext";
import { useProductModal } from "../product/productModal";

export default function ProductCard({ product: p }: { product: CatalogProduct }) {
  const { items, setQty, add } = useCart();
  const { open } = useProductModal();
  const qty = items[p.id] ?? 0;

  return (
    <article className="card prod-card">
      <button
        type="button"
        className="prod-card__media"
        onClick={() => open(p.id)}
        aria-label={`Подробнее: ${p.name}`}
      >
        {p.photo_url ? (
          <img
            className="tile-img zoom"
            src={photoUrl(p.photo_url)}
            alt={p.name}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="prod-card__noimg" />
        )}
        {p.is_new && <span className="badge-new">Новинка</span>}
      </button>
      <div className="prod-card__body">
        <button type="button" className="prod-card__name prod-card__name--btn" onClick={() => open(p.id)}>
          {p.name}
        </button>
        {p.subtitle && <div className="prod-card__sub">{p.subtitle}</div>}
        <div className="prod-card__row">
          <span className="prod-card__price">от {p.daily_price} сом</span>
          {qty > 0 ? (
            <div className="qty">
              <button
                type="button"
                className="qty__btn"
                aria-label="Убрать одну"
                onClick={() => setQty(p.id, qty - 1)}
              >
                −
              </button>
              <span className="qty__val">{qty}</span>
              <button
                type="button"
                className="qty__btn"
                aria-label="Добавить одну"
                disabled={qty >= p.available}
                onClick={() => setQty(p.id, qty + 1)}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-add"
              disabled={p.available <= 0}
              onClick={() => add(p.id)}
            >
              + в заявку
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
