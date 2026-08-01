import { useWaLink } from "../site/SiteContext";

/** Тёмно-зелёный призыв к действию. */
export default function CtaBanner() {
  const waLink = useWaLink();
  return (
    <section className="cta">
      <div className="cta__inner">
        <h2 className="cta__title">Готовите мероприятие в Бишкеке?</h2>
        <p className="cta__text">
          Напишите в Rental_bish — поможем подобрать посуду, шатры, столы, стулья и декор под ваш
          праздник.
        </p>
        <div className="cta__actions">
          <a
            className="btn btn--gold btn--lg"
            href={waLink("Здравствуйте! Готовлю мероприятие в Бишкеке, нужна аренда.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            Написать в WhatsApp
          </a>
          <a className="btn btn--ghost-light btn--lg" href="#catalog">
            Смотреть каталог
          </a>
        </div>
      </div>
    </section>
  );
}
