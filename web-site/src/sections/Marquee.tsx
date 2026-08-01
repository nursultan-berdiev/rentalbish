import { MARQUEE_ITEMS } from "../content";

/** Бегущая строка типов тоя. Группа дублируется — для бесшовной прокрутки. */
export default function Marquee() {
  return (
    <section className="marquee" aria-hidden="true">
      <div className="marquee__track">
        {[0, 1].map((g) => (
          <div className="marquee__group" key={g}>
            {MARQUEE_ITEMS.map((t) => (
              <span className="marquee__item" key={`${g}-${t}`}>
                {t}
                <span className="marquee__dot" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
