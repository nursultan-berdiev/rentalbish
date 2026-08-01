/** Секция каталога на главной: чипы-фильтры + плоская сетка карточек. */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ProductCard from "../components/ProductCard";
import { useCart } from "../cart/CartContext";

const ALL = "Все";

export default function Catalog() {
  const { products, status } = useCart();
  const [active, setActive] = useState<string>(ALL);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(p.category);
    return [ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b, "ru"))];
  }, [products]);

  const shown = useMemo(
    () => (active === ALL ? products : products.filter((p) => p.category === active)),
    [products, active]
  );

  return (
    <section id="catalog" className="section container--wide container">
      <div className="catalog__head">
        <div>
          <span className="eyebrow">Каталог аренды</span>
          <h2 className="title">Выберите посуду и декор</h2>
        </div>
        {status === "ready" && (
          <Link to="/catalog" className="catalog__all">
            Весь каталог →
          </Link>
        )}
      </div>

      {status === "ready" && categories.length > 1 && (
        <div className="chips" role="tablist" aria-label="Категории">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={c === active ? "chip chip--active" : "chip"}
              aria-pressed={c === active}
              onClick={() => setActive(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {status === "loading" && <p className="catalog__note">Загрузка каталога…</p>}
      {status === "empty" && (
        <p className="catalog__note">
          Каталог появится после наполнения склада. Форма заявки ниже уже работает.
        </p>
      )}

      {status === "ready" && (
        <div className="prod-grid">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
