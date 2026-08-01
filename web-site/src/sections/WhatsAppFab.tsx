import { useWaLink } from "../site/SiteContext";

/** Плавающая кнопка WhatsApp — всегда под рукой. */
export default function WhatsAppFab() {
  const waLink = useWaLink();
  return (
    <a
      className="fab"
      href={waLink("Здравствуйте! Хочу арендовать для мероприятия.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Написать в WhatsApp"
    >
      <span className="fab__icon" aria-hidden="true">
        ✆
      </span>
      WhatsApp
    </a>
  );
}
