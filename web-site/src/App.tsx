import { useEffect, useState } from "react";
import { fetchCatalog, type CatalogProduct } from "./api";
import OrderForm from "./OrderForm";

export default function App() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    fetchCatalog()
      .then((data) => {
        setProducts(data);
        setStatus(data.length ? "ready" : "empty");
      })
      .catch(() => setStatus("empty")); // API/каталог ещё не готов — показываем заглушку
  }, []);

  return (
    <div className="page">
      <header className="hero">
        <h1>Аренда посуды</h1>
        <p>Выберите позиции и оставьте заявку — мы свяжемся с вами.</p>
      </header>

      <section className="catalog">
        {status === "loading" && <p>Загрузка каталога...</p>}
        {status === "empty" && (
          <p className="muted">
            Каталог появится после наполнения склада (Этапы 1–2). Форма заявки ниже уже работает.
          </p>
        )}
        {status === "ready" && (
          <div className="grid">
            {products.map((p) => (
              <article key={p.id} className="tile">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} />
                ) : (
                  <div className="tile-noimg" />
                )}
                <h3>{p.name}</h3>
                <div className="tile-meta">
                  <span>{p.daily_price} / сутки</span>
                  <span className="muted">в наличии: {p.available}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <OrderForm products={products} />
    </div>
  );
}
