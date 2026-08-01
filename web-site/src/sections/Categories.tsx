import { CATEGORIES } from "../content";

/** Витрина категорий — 5 фото-плиток. Ведут в каталог. */
export default function Categories() {
  return (
    <section className="section container">
      <div className="section-head">
        <span className="eyebrow">Всё в одном месте</span>
        <h2 className="title">Всё для красивого мероприятия</h2>
      </div>
      <div className="cat-grid">
        {CATEGORIES.map((c) => (
          <a key={c.title} className="card cat-card" href="#catalog">
            <img className="tile-img zoom" src={c.img} alt={c.title} loading="lazy" decoding="async" />
            <div className="tile-shade" />
            <div className="tile-cap">
              <div className="tile-cap__title">{c.title}</div>
              <div className="tile-cap__sub">{c.subtitle}</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
