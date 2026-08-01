/**
 * Модалка детального просмотра товара.
 *
 * Открывается из любой карточки через useProductModal().open(id); рендерится один
 * раз в корне приложения. Desktop — две колонки (галерея слева), мобильный —
 * bottom-sheet (стили в styles.css). Данные тянем по id из /catalog/public/{id}.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { fetchProduct, photoUrl, type CatalogDetail } from "../api";
import { useCart } from "../cart/CartContext";
import { buildOrderText } from "../lib/whatsapp";
import { useWaLink } from "../site/SiteContext";
import { I_CLOSE, Svg } from "../components/icons";

interface ModalValue {
  open: (id: number) => void;
}

const Ctx = createContext<ModalValue | null>(null);

export function ProductModalProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = useCallback((id: number) => setOpenId(id), []);
  const close = useCallback(() => setOpenId(null), []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {openId !== null && <ProductModal id={openId} onClose={close} />}
    </Ctx.Provider>
  );
}

export function useProductModal(): ModalValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProductModal вне ProductModalProvider");
  return v;
}

function ProductModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { add } = useCart();
  const waLink = useWaLink();
  const [detail, setDetail] = useState<CatalogDetail | null>(null);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setDetail(null);
    setActive(0);
    setFailed(false);
    fetchProduct(id).then(setDetail).catch(() => setFailed(true));
  }, [id]);

  // Esc закрывает; фон под модалкой не скроллится.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const waText = detail
    ? buildOrderText({
        name: "",
        phone: "",
        lines: [{ name: detail.name, quantity: 1 }],
        comment: `Интересует «${detail.name}» — от ${detail.daily_price} сом/сутки`,
      })
    : "";

  return (
    <div className="pm-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pm" onClick={(e) => e.stopPropagation()}>
        <button className="pm__close" type="button" onClick={onClose} aria-label="Закрыть">
          <Svg paths={I_CLOSE} size={16} />
        </button>

        {!detail && !failed && <div className="pm__loading">Загрузка…</div>}
        {failed && <div className="pm__loading">Не удалось загрузить товар.</div>}

        {detail && (
          <>
            <div className="pm__gallery">
              <div className="pm__main">
                <img src={photoUrl(detail.photos[active] ?? detail.photos[0])} alt={detail.name} />
              </div>
              {detail.photos.length > 1 && (
                <div className="pm__thumbs">
                  {detail.photos.map((ph, i) => (
                    <button
                      key={ph}
                      type="button"
                      className={i === active ? "pm__thumb pm__thumb--active" : "pm__thumb"}
                      onClick={() => setActive(i)}
                      aria-label={`Фото ${i + 1}`}
                    >
                      <img src={photoUrl(ph)} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pm__info">
              {detail.is_new && <span className="badge-new pm__badge">Новинка</span>}
              <h2 className="pm__title">{detail.name}</h2>
              <div className="pm__price">
                от {detail.daily_price} сом <span className="pm__price-unit">/ сутки</span>
              </div>
              {detail.subtitle && <div className="pm__subtitle">{detail.subtitle}</div>}
              {detail.description && <p className="pm__desc">{detail.description}</p>}

              <div className="pm__specs">
                {detail.attributes.map((a) => (
                  <div className="pm__spec" key={a.label}>
                    <span className="pm__spec-k">{a.label}</span>
                    <span className="pm__spec-v">{a.value}</span>
                  </div>
                ))}
                <div className="pm__spec">
                  <span className="pm__spec-k">В наличии</span>
                  <span className="pm__spec-v">{detail.available} шт.</span>
                </div>
              </div>

              <div className="pm__actions">
                <button
                  type="button"
                  className="btn btn--olive pm__btn"
                  disabled={detail.available <= 0}
                  onClick={() => {
                    add(detail.id);
                    onClose();
                  }}
                >
                  Добавить в заявку
                </button>
                <a
                  className="btn btn--bordeaux pm__btn"
                  href={waLink(waText)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Написать в WhatsApp
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
