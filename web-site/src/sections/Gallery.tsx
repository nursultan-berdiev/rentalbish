import { GALLERY } from "../content";

/** Галерея «Вдохновение для стола» — 4 фото с чередованием ширины. */
export default function Gallery() {
  return (
    <section className="section container--wide container">
      <div className="section-head">
        <span className="eyebrow">Идеи сервировки</span>
        <h2 className="title">Наши работы</h2>
      </div>
      <div className="gal-grid">
        {GALLERY.map((g) => (
          <figure
            key={g.title}
            className={`card gal-item ${g.wide ? "gal-item--wide" : "gal-item--tall"}`}
          >
            <img className="tile-img zoom" src={g.img} alt={g.title} loading="lazy" decoding="async" />
            <div className="gal-shade" />
            <figcaption className="gal-item__cap">{g.title}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
