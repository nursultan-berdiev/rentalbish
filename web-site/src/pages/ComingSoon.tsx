/**
 * Заставка «Скоро открытие» — показывается вместо витрины, когда включён режим
 * обслуживания (site_settings.maintenance_mode). Стиль — как у сайта: кремовый
 * фон, серифный заголовок Playfair, lead Manrope. Плюс кликабельный номер
 * WhatsApp из настроек сайта, чтобы нетерпеливые могли написать.
 */
import { useSite, useWaLink } from "../site/SiteContext";

/** «996552080610» → «+996 552 080 610». */
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("996")) {
    return `+996 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  }
  return raw.startsWith("+") ? raw : `+${raw}`;
}

export default function ComingSoon() {
  const { waPhone } = useSite();
  const waLink = useWaLink();

  return (
    <main className="coming">
      <div className="coming__inner reveal">
        <div className="coming__eyebrow">Rental_bish · Бишкек</div>
        <h1 className="coming__title">Скоро открытие</h1>
        <p className="coming__lead">
          Мы заканчиваем последние приготовления. Совсем скоро здесь будет всё для красивой
          сервировки и оформления ваших праздников. Очень ждём встречи с вами.
        </p>
        <div className="coming__contact">
          <span className="coming__contact-label">Написать нам:</span>
          <a
            className="coming__wa"
            href={waLink("Здравствуйте! Хочу узнать про аренду для мероприятия.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            {formatPhone(waPhone)}
          </a>
        </div>
      </div>
    </main>
  );
}
