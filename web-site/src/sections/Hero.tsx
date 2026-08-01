import { HERO_IMG } from "../content";
import { useWaLink } from "../site/SiteContext";

/** Первый экран: крупное фото, заголовок и две CTA. */
export default function Hero() {
  const waLink = useWaLink();
  return (
    <section className="hero">
      <div className="hero__frame reveal reveal--slow">
        <img
          className="hero__img zoom"
          src={HERO_IMG}
          alt="Свадебная сервировка стола"
          decoding="async"
        />
      </div>
      <div className="hero__text reveal">
        <div className="hero__eyebrow">Бишкек · аренда для мероприятий</div>
        <h1 className="hero__title">
          Аренда столов, стульев, шатров,
          <br />посуды и элементов декора для стола
        </h1>
        <p className="hero__lead">
          Rental_bish поможет собрать красивую сервировку и оформление для кыз узатуу, свадеб, тушоо
          той, юбилеев и семейных праздников — без покупки лишней посуды.
        </p>
        <div className="hero__cta">
          <a className="btn btn--gold btn--lg" href="#catalog">
            Смотреть каталог
          </a>
          <a
            className="btn btn--ghost btn--lg"
            href={waLink("Здравствуйте! Хочу арендовать для мероприятия.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            Написать в WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
