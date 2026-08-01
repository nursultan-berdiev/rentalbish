/** Общая шапка витрины: навигация, иконка корзины со счётчиком, кнопка WhatsApp. */
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useCart } from "../cart/CartContext";
import { useSite, useWaLink } from "../site/SiteContext";
import { I_CART, Svg } from "./icons";

export default function Header() {
  const { count } = useCart();
  const { waPhone } = useSite();
  const waLink = useWaLink();
  const nav = useNavigate();
  const loc = useLocation();

  // Секции живут на главной: если мы не на ней — сперва туда, потом скролл.
  function toSection(hash: string) {
    if (loc.pathname === "/") {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
    } else {
      nav(`/${hash}`);
    }
  }

  return (
    <header className="header">
      <div className="header__inner">
        <Link className="brand" to="/">
          Rental_bish
        </Link>
        <nav className="navlinks" aria-label="Основная навигация">
          <Link to="/">Главная</Link>
          <Link to="/catalog">Каталог</Link>
          <button type="button" className="navlink-btn" onClick={() => toSection("#how")}>
            Как арендовать
          </button>
          <button type="button" className="navlink-btn" onClick={() => toSection("#contacts")}>
            Контакты
          </button>
        </nav>
        <div className="header__right">
          <Link to="/cart" className="cart-icon" aria-label={`Заявка: ${count} позиц.`}>
            <Svg paths={I_CART} size={20} sw={1.6} />
            {count > 0 && <span className="cart-icon__badge">{count}</span>}
          </Link>
          <a
            className="btn btn--olive btn--sm header__wa"
            href={waLink(`Здравствуйте! Пишу с сайта Rental_bish (${waPhone}).`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Написать в WhatsApp
          </a>
        </div>
      </div>
    </header>
  );
}
