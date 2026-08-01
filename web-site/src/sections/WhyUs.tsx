import { WHY_US } from "../content";

/** Блок преимуществ — 6 карточек. */
export default function WhyUs() {
  return (
    <section className="section container">
      <div className="section-head">
        <span className="eyebrow">Почему выбирают нас</span>
        <h2 className="title">Уютный сервис для вашего праздника</h2>
      </div>
      <div className="why-grid">
        {WHY_US.map((c) => (
          <article key={c.n} className="card why-card">
            <div className="why-card__num">{c.n}</div>
            <div className="why-card__title">{c.title}</div>
            <div className="why-card__text">{c.text}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
