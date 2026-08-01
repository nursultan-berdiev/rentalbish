import { HOW_TO } from "../content";

/** «Как оформить аренду» — 6 шагов. */
export default function HowTo() {
  return (
    <section id="how" className="section container">
      <div className="section-head">
        <span className="eyebrow">Просто и удобно</span>
        <h2 className="title">Как оформить аренду</h2>
      </div>
      <div className="how-grid">
        {HOW_TO.map((text, i) => (
          <article key={text} className="card how-card">
            <div className="how-card__num">{i + 1}</div>
            <div className="how-card__text">{text}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
