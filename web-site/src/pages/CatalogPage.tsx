/**
 * Страница каталога: товары сгруппированы по категориям в сворачиваемые секции,
 * сверху — чипы-фильтры. Данные — из общей корзины (каталог грузится там один раз).
 */
import { useMemo, useState } from "react";

import ProductCard from "../components/ProductCard";
import { I_CHEVRON, Svg } from "../components/icons";
import { useCart } from "../cart/CartContext";
import type { CatalogProduct } from "../api";

const ALL = "Все";

// Порядок секций каталога (неизвестные категории — в конец, по алфавиту).
const ORDER = [
  "Тарелки",
  "Стекло",
  "Приборы",
  "Текстиль",
  "Столы и стулья",
  "Шатры",
  "Декор",
  "Готовые комплекты",
];

function orderOf(cat: string): number {
  const i = ORDER.indexOf(cat);
  return i === -1 ? ORDER.length : i;
}

export default function CatalogPage() {
  const { products, status } = useCart();
  const [active, setActive] = useState<string>(ALL);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, CatalogProduct[]>();
    for (const p of products) {
      const cat = p.category ?? "Прочее";
      (map.get(cat) ?? map.set(cat, []).get(cat)!).push(p);
    }
    return [...map.entries()].sort((a, b) => orderOf(a[0]) - orderOf(b[0]) || a[0].localeCompare(b[0], "ru"));
  }, [products]);

  const categories = useMemo(() => [ALL, ...groups.map(([c]) => c)], [groups]);
  const shownGroups = active === ALL ? groups : groups.filter(([c]) => c === active);

  return (
    <main className="page">
      <div className="section container--wide container">
        <span className="eyebrow">Каталог аренды</span>
        <h1 className="title page__title">Всё для вашего праздника</h1>

        {status === "loading" && <p className="catalog__note">Загрузка каталога…</p>}
        {status === "empty" && (
          <p className="catalog__note">Каталог появится после наполнения склада.</p>
        )}

        {status === "ready" && (
          <>
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

            {shownGroups.map(([cat, list]) => {
              const isCollapsed = collapsed[cat];
              return (
                <section className="cat-group" key={cat}>
                  <div className="cat-group__head">
                    <h2 className="cat-group__title">
                      {cat} <span className="cat-group__count">{list.length}</span>
                    </h2>
                    <button
                      type="button"
                      className="cat-group__toggle"
                      aria-expanded={!isCollapsed}
                      onClick={() => setCollapsed((s) => ({ ...s, [cat]: !s[cat] }))}
                    >
                      {isCollapsed ? "Развернуть" : "Свернуть"}
                      <Svg
                        paths={I_CHEVRON}
                        size={14}
                        style={{ transform: isCollapsed ? "rotate(-90deg)" : "none" }}
                      />
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="prod-grid">
                      {list.map((p) => (
                        <ProductCard key={p.id} product={p} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
