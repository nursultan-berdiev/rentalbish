import { CONTACTS, SCHEDULE } from "../content";
import { useWaLink } from "../site/SiteContext";

/** Контакты: график работы, карточка контактов и карта. */
export default function Contacts() {
  const waLink = useWaLink();
  return (
    <section id="contacts" className="contacts">
      <div className="duo">
        <div className="sched-card">
          <span className="eyebrow">График работы</span>
          {SCHEDULE.map((r) => (
            <div className="sched-row" key={r.label}>
              <span className="sched-row__label">{r.label}</span>
              <span className="sched-row__value">{r.value}</span>
            </div>
          ))}
        </div>

        <div className="contact-card">
          <span className="eyebrow">Контакты</span>
          <div className="contact-card__phone">{CONTACTS.phone}</div>
          <div className="contact-card__addr">{CONTACTS.address}</div>
          <div className="contact-card__note">{CONTACTS.note}</div>
          <div className="contact-card__links">
            <a
              className="chip-line"
              href={waLink("Здравствуйте! Вопрос по аренде.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
            <span className="chip-line">Telegram</span>
            <span className="chip-line">Instagram</span>
          </div>
        </div>
      </div>

      <div className="map-frame">
        <iframe title="Карта: склад-шоурум Rental_bish" src={CONTACTS.mapSrc} loading="lazy" />
      </div>
    </section>
  );
}
