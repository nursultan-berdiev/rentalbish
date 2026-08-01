/** Брони: список, карточка (выдача/возврат/отмена/расчёт), создание. Разметка 1:1 из макета. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiError } from "../api/client";
import {
  cancelBooking,
  confirmBooking,
  createBooking,
  createClient,
  getBooking,
  issueBooking,
  listBookings,
  listClients,
  listLocations,
  listProducts,
  listStock,
  returnBooking,
  type Booking,
  type Client,
  type Location,
  type Product,
  type StockRow,
} from "../api/domain";
import { MONO, css, daysBetween, dm, mix, money, num, todayISO } from "../design/css";
import { ICONS, I_ALERT, I_BACK, I_CHECK, I_CLOCK, I_CLOSE, I_PLUS, I_USER, Svg } from "../design/icons";
import {
  FieldLabel,
  HButton,
  LoadError,
  Loading,
  ModalError,
  ModalShell,
  OverdueBadge,
  StatusBadge,
  btnDanger,
  btnGhost,
  btnPrimary,
  chipStyle,
  inputNumStyle,
  inputStyle,
  tabStyle,
  type BookingStatusKey,
} from "../design/ui";
import { EMPTY_ICON, PANEL, Page, PrimaryAction, SearchInput, Toolbar } from "../design/table";
import { isOverdue, onHandsQty } from "../domain/booking";
import { matchNumber, matchPhone, matchText } from "../lib/search";

const I_TRUCK2: [string, Record<string, unknown>][] = [
  ["path", { d: "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" }],
  ["path", { d: "M15 18H9" }],
  ["path", { d: "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" }],
  ["circle", { cx: 17, cy: 18, r: 2 }],
  ["circle", { cx: 7, cy: 18, r: 2 }],
];
const I_RETURN: [string, Record<string, unknown>][] = [
  ["path", { d: "M3 12a9 9 0 1 0 3-7.7L3 8" }],
  ["path", { d: "M3 3v5h5" }],
];
const I_BAN: [string, Record<string, unknown>][] = [
  ["circle", { cx: 12, cy: 12, r: 10 }],
  ["path", { d: "m4.9 4.9 14.2 14.2" }],
];

const LIST_GRID = "display:grid;grid-template-columns:78px 1.6fr 1.2fr 1.3fr .7fr 1fr 1.1fr;gap:0";
const ITEM_GRID = "display:grid;grid-template-columns:1.8fr .8fr .8fr .9fr .9fr";

/** Доступность позиции на точке: для комплекта — по самому дефицитному компоненту. */
function availAny(product: Product | undefined, locationId: number, stock: StockRow[]): number {
  if (!product) return 0;
  const availOf = (pid: number) =>
    stock.find((s) => s.product_id === pid && s.location_id === locationId)?.available ?? 0;
  if (product.type === "set") {
    if (!product.components.length) return 0;
    return Math.min(
      ...product.components.map((c) => Math.floor(availOf(c.component_id) / (c.quantity || 1)))
    );
  }
  return availOf(product.id);
}

type Props = {
  isDesktop: boolean;
  toast: (kind: "success" | "error", text: string) => void;
};

// ============================ СПИСОК ============================
export function BookingsList({ isDesktop }: Props) {
  const nav = useNavigate();
  const [rows, setRows] = useState<Booking[]>([]);
  const [status, setStatus] = useState<"all" | BookingStatusKey>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    listBookings().then(setRows).catch(() => setRows([]));
  }, []);

  const cnt = (k: BookingStatusKey) => rows.filter((b) => b.status === k).length;
  const tabs: { key: "all" | BookingStatusKey; label: string; count: number }[] = [
    { key: "all", label: "Все", count: rows.length },
    { key: "new", label: "Черновики", count: cnt("new") },
    { key: "confirmed", label: "Подтв.", count: cnt("confirmed") },
    { key: "issued", label: "Выданы", count: cnt("issued") },
    { key: "returned", label: "Возврат", count: cnt("returned") },
    { key: "closed", label: "Закрыты", count: cnt("closed") },
    { key: "cancelled", label: "Отмена", count: cnt("cancelled") },
  ];

  const visible = useMemo(() => {
    const q = query.trim();
    return rows
      .filter((b) => status === "all" || b.status === status)
      .filter(
        (b) =>
          !q ||
          matchText(b.client_name, q) ||
          matchNumber(b.id, q) ||
          matchPhone(b.client_phone, q)
      );
  }, [rows, status, query]);

  return (
    <Page>
      <Toolbar
        left={
          <div
            style={css(
              "display:flex;gap:4px;flex-wrap:wrap;background:var(--border-2);padding:3px;border-radius:9px"
            )}
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                style={tabStyle(status === t.key)}
              >
                {t.label}
                <span style={css(MONO + ";opacity:.7;margin-left:5px")}>{t.count}</span>
              </button>
            ))}
          </div>
        }
        search={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Клиент, №, телефон…"
            width={210}
          />
        }
        actions={<PrimaryAction onClick={() => nav("/bookings/new")}>Новая бронь</PrimaryAction>}
      />

      {isDesktop ? (
        <div
          style={css(PANEL)}
        >
          <div
            style={css(
              LIST_GRID +
                ";background:var(--surface-2);border-bottom:1px solid var(--border);font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3)"
            )}
          >
            <div style={css("padding:9px 14px")}>№</div>
            <div style={css("padding:9px 14px")}>Клиент</div>
            <div style={css("padding:9px 14px")}>Точка</div>
            <div style={css("padding:9px 14px")}>Период</div>
            <div style={css("padding:9px 14px;text-align:right")}>Сут.</div>
            <div style={css("padding:9px 14px;text-align:right")}>Аренда</div>
            <div style={css("padding:9px 14px")}>Статус</div>
          </div>

          {visible.length > 0 ? (
            visible.map((b) => {
              return (
                <HButton
                  key={b.id}
                  onClick={() => nav(`/bookings/${b.id}`)}
                  s={
                    LIST_GRID +
                    ";border:none;border-bottom:1px solid var(--hover);align-items:center;background:transparent;cursor:pointer;text-align:left;width:100%"
                  }
                  hover="background:var(--surface-2)"
                >
                  <div style={css("padding:10px 14px;" + MONO + ";font-size:12.5px;color:var(--text-2)")}>
                    {b.id}
                  </div>
                  <div style={css("padding:10px 14px;min-width:0")}>
                    <div
                      style={css(
                        "font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                      )}
                    >
                      {b.client_name}
                    </div>
                    <div style={css("font-size:11px;color:var(--text-4);" + MONO)}>
                      {b.client_phone}
                    </div>
                  </div>
                  <div
                    style={css(
                      "padding:10px 14px;font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                    )}
                  >
                    {b.location_name}
                  </div>
                  <div
                    style={css(
                      "padding:10px 14px;" +
                        MONO +
                        ";font-size:12px;color:var(--text-2);display:flex;align-items:center;gap:6px"
                    )}
                  >
                    {dm(b.start_date)} – {dm(b.expected_return_date)}
                    {isOverdue(b) && (
                      <span title="Просрочено" style={css("display:inline-flex;color:var(--danger)")}>
                        <Svg paths={I_CLOCK} size={13} sw={2} />
                      </span>
                    )}
                  </div>
                  <div
                    style={css(
                      "padding:10px 14px;text-align:right;" + MONO + ";font-size:12.5px;color:var(--text-2)"
                    )}
                  >
                    {b.days}
                  </div>
                  <div
                    style={css(
                      "padding:10px 14px;text-align:right;" + MONO + ";font-size:12.5px;font-weight:600"
                    )}
                  >
                    {money(b.rental_total)}
                  </div>
                  <div style={css("padding:10px 14px")}>
                    <StatusBadge status={b.status as BookingStatusKey} />
                  </div>
                </HButton>
              );
            })
          ) : (
            <div style={css("padding:50px 20px;text-align:center;color:var(--text-3)")}>
              <div
                style={css(EMPTY_ICON)}
              >
                <Svg paths={ICONS.bookings} size={24} sw={1.6} />
              </div>
              <div style={css("font-size:13.5px;font-weight:500;color:var(--text-2)")}>
                Броней не найдено
              </div>
              <div style={css("font-size:12px;margin-top:3px")}>
                Измените фильтры или создайте новую бронь
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:10px")}>
          {visible.map((b) => {
            return (
              <HButton
                key={b.id}
                onClick={() => nav(`/bookings/${b.id}`)}
                s="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;text-align:left;cursor:pointer;width:100%"
              >
                <div
                  style={css(
                    "display:flex;justify-content:space-between;gap:10px;align-items:flex-start"
                  )}
                >
                  <div style={css("min-width:0")}>
                    <div style={css("font-weight:600;font-size:14px")}>{b.client_name}</div>
                    <div style={css("font-size:11.5px;color:var(--text-4);" + MONO)}>
                      №{b.id} · {b.client_phone}
                    </div>
                  </div>
                  <StatusBadge status={b.status as BookingStatusKey} size="sm" />
                </div>
                <div
                  style={css(
                    "display:flex;gap:16px;margin-top:10px;padding-top:10px;border-top:1px solid var(--hover);font-size:11.5px;color:var(--text-3);align-items:center"
                  )}
                >
                  <span style={css(MONO)}>
                    {dm(b.start_date)} – {dm(b.expected_return_date)}
                  </span>
                  <span>{b.days} сут.</span>
                  <span style={css("margin-left:auto;" + MONO + ";font-weight:600;color:var(--text)")}>
                    {money(b.rental_total)} сом
                  </span>
                </div>
              </HButton>
            );
          })}
        </div>
      )}
    </Page>
  );
}

// ============================ КАРТОЧКА ============================
type ModalState =
  | null
  | { type: "issue"; rows: { product_id: number; qty: string }[]; error: string }
  | {
      type: "return";
      rows: { product_id: number; whole: string; broken: string }[];
      error: string;
    }
  | { type: "cancel" };

export function BookingDetail({ isDesktop, toast }: Props) {
  const { id } = useParams();
  const nav = useNavigate();
  const bookingId = Number(id);
  const [b, setB] = useState<Booking | null>(null);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

  const reload = () => getBooking(bookingId).then(setB);
  const load = useCallback(() => {
    setLoadError("");
    getBooking(bookingId)
      .then(setB)
      .catch((e) => setLoadError(apiError(e, "Не удалось загрузить бронь")));
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) return <LoadError text={loadError} onRetry={load} />;
  if (!b) return <Loading />;

  const overdue = isOverdue(b);
  const udrzh = b.items.reduce((a, it) => a + it.broken_qty * it.deposit_price, 0);
  const brokenTotal = b.items.reduce((a, it) => a + it.broken_qty, 0);
  const toPay = b.rental_total + udrzh - b.prepaid;

  // Черновик остаток не занимал — сначала «Подтвердить», только потом выдача.
  const isDraft = b.status === "new";
  const canConfirm = isDraft;
  const canIssue =
    ["confirmed", "issued"].includes(b.status) &&
    b.items.some((it) => it.quantity - it.issued_qty > 0);
  const canReturn = b.items.some((it) => onHandsQty(it) > 0);
  const canCancel = b.status !== "closed" && b.status !== "cancelled";

  const openIssue = () =>
    setModal({
      type: "issue",
      rows: b.items
        .filter((it) => it.quantity - it.issued_qty > 0)
        .map((it) => ({ product_id: it.product_id, qty: String(it.quantity - it.issued_qty) })),
      error: "",
    });

  const openReturn = () =>
    setModal({
      type: "return",
      rows: b.items
        .filter((it) => onHandsQty(it) > 0)
        .map((it) => ({ product_id: it.product_id, whole: "", broken: "" })),
      error: "",
    });

  const patch = (p: Partial<NonNullable<ModalState>>) =>
    setModal((m) => (m ? ({ ...m, ...p } as NonNullable<ModalState>) : m));

  async function submitIssue() {
    if (!modal || modal.type !== "issue" || !b) return;
    const items = modal.rows
      .map((r) => ({ product_id: r.product_id, quantity: num(r.qty) }))
      .filter((r) => r.quantity > 0);
    if (!items.length) return patch({ error: "Укажите количество хотя бы по одной позиции" });
    try {
      await issueBooking(b.id, items);
      setModal(null);
      await reload();
      toast("success", `Выдача по броне №${b.id} проведена`);
    } catch (e) {
      patch({ error: apiError(e) });
    }
  }

  async function submitReturn() {
    if (!modal || modal.type !== "return" || !b) return;
    const items = modal.rows
      .map((r) => ({
        product_id: r.product_id,
        quantity: num(r.whole),
        broken_qty: num(r.broken),
      }))
      .filter((r) => r.quantity > 0 || r.broken_qty > 0);
    if (!items.length) return patch({ error: "Укажите хотя бы одну позицию к приёму" });
    try {
      const updated = await returnBooking(b.id, items);
      setModal(null);
      await reload();
      toast(
        "success",
        updated.status === "closed"
          ? `Бронь №${b.id} закрыта`
          : `Возврат по броне №${b.id} принят`
      );
    } catch (e) {
      patch({ error: apiError(e) });
    }
  }

  async function submitConfirm() {
    if (!b) return;
    try {
      await confirmBooking(b.id);
      await reload();
      toast("success", `Бронь №${b.id} подтверждена, остаток зарезервирован`);
    } catch (e) {
      toast("error", apiError(e));
    }
  }

  async function submitCancel() {
    if (!b) return;
    try {
      await cancelBooking(b.id);
      setModal(null);
      await reload();
      toast("success", `Бронь №${b.id} отменена, резерв снят`);
    } catch (e) {
      setModal(null);
      toast("error", apiError(e));
    }
  }

  return (
    <Page size="detail">
      <HButton
        onClick={() => nav("/bookings")}
        s="display:inline-flex;align-items:center;gap:6px;border:none;background:transparent;color:var(--text-2);font-size:12.5px;cursor:pointer;padding:4px 0;margin-bottom:12px"
        hover="color:var(--accent)"
      >
        <Svg paths={I_BACK} size={15} />
        Все брони
      </HButton>

      <div
        style={css("display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;margin-bottom:16px")}
      >
        <div style={css("flex:1;min-width:200px")}>
          <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
            <h2 style={css("margin:0;font-size:20px;font-weight:600;letter-spacing:-.01em")}>
              Бронь №{b.id}
            </h2>
            <StatusBadge status={b.status as BookingStatusKey} />
            {overdue && <OverdueBadge />}
          </div>
          <div
            style={css(
              "display:flex;flex-wrap:wrap;gap:18px;margin-top:10px;font-size:12.5px;color:var(--text-2)"
            )}
          >
            <div>
              <span style={css("color:var(--text-4)")}>Клиент</span> ·{" "}
              <b style={css("font-weight:600;color:var(--text)")}>{b.client_name}</b>
            </div>
            <div style={css(MONO)}>{b.client_phone}</div>
            <div>
              <span style={css("color:var(--text-4)")}>Точка</span> · {b.location_name}
            </div>
            <div style={css(MONO)}>
              <span style={css("color:var(--text-4);font-family:'IBM Plex Sans'")}>Период</span> ·{" "}
              {dm(b.start_date)} – {dm(b.expected_return_date)} ({b.days} сут.)
            </div>
          </div>
        </div>

        <div style={css("display:flex;gap:8px;flex-wrap:wrap")}>
          {canConfirm && (
            <HButton
              onClick={submitConfirm}
              s="height:36px;padding:0 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px"
              hover="background:var(--accent-hover)"
            >
              <Svg paths={I_CHECK} size={15} sw={2} />
              Подтвердить бронь
            </HButton>
          )}
          {canIssue && (
            <HButton
              onClick={openIssue}
              s="height:36px;padding:0 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px"
              hover="background:var(--accent-hover)"
            >
              <Svg paths={I_TRUCK2} size={15} sw={1.7} />
              Выдать
            </HButton>
          )}
          {canReturn && (
            <HButton
              onClick={openReturn}
              s="height:36px;padding:0 14px;background:var(--surface);color:var(--text);border:1px solid var(--border-strong);border-radius:8px;font-size:12.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px"
              hover="background:var(--hover)"
            >
              <Svg paths={I_RETURN} size={15} />
              Принять возврат
            </HButton>
          )}
          {canCancel && (
            <HButton
              title="Отменить бронь"
              onClick={() => setModal({ type: "cancel" })}
              s="height:36px;width:36px;background:var(--surface);color:var(--muted-fg);border:1px solid var(--danger-border);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center"
              hover="background:var(--danger-tint2);color:var(--danger)"
            >
              <Svg paths={I_BAN} size={15} />
            </HButton>
          )}
        </div>
      </div>

      {isDraft && (
        <div
          style={css(
            "margin-bottom:14px;background:var(--surface-2);border:1px dashed var(--border-strong);border-radius:9px;padding:11px 14px;font-size:12.5px;color:var(--text-2);display:flex;align-items:center;gap:8px"
          )}
        >
          <span style={css("display:flex;color:var(--text-3)")}>
            <Svg paths={I_ALERT} size={15} />
          </span>
          Черновик: остаток ещё не зарезервирован. Подтвердите бронь — тогда позиции будут заняты
          за клиентом.
        </div>
      )}

      <div
        style={{
          ...css("display:grid;gap:16px;align-items:start"),
          gridTemplateColumns: isDesktop ? "1.7fr 1fr" : "1fr",
        }}
      >
        {/* позиции */}
        <div
          style={css(PANEL)}
        >
          <div
            style={css(
              "padding:12px 16px;border-bottom:1px solid var(--border-2);font-size:13px;font-weight:600"
            )}
          >
            Позиции
          </div>
          <div
            style={css(
              ITEM_GRID +
                ";background:var(--surface-2);border-bottom:1px solid var(--border);font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3)"
            )}
          >
            <div style={css("padding:8px 14px")}>Товар</div>
            <div style={css("padding:8px 10px;text-align:right")}>Заказ</div>
            <div style={css("padding:8px 10px;text-align:right")}>Выдано</div>
            <div style={css("padding:8px 10px;text-align:right")}>Возвр.</div>
            <div style={css("padding:8px 12px;text-align:right")}>На руках</div>
          </div>
          {b.items.map((it) => {
            const oh = onHandsQty(it);
            return (
              <div
                key={it.id}
                style={css(ITEM_GRID + ";border-bottom:1px solid var(--hover);align-items:center")}
              >
                <div style={css("padding:10px 14px;min-width:0")}>
                  <div style={css("font-weight:500;font-size:13px")}>{it.product_name}</div>
                  <div style={css("font-size:11px;color:var(--text-4);" + MONO)}>
                    {money(it.daily_price)} сом/сут
                  </div>
                </div>
                <Cell v={String(it.quantity)} />
                <Cell v={String(it.issued_qty)} />
                <Cell
                  v={it.broken_qty > 0 ? `${it.returned_qty}+${it.broken_qty}✕` : String(it.returned_qty)}
                />
                <div
                  style={mix(
                    "padding:10px 12px;text-align:right;" + MONO + ";font-size:13px;font-weight:600",
                    { color: oh > 0 ? "var(--text)" : "var(--text-5)" }
                  )}
                >
                  {oh}
                </div>
              </div>
            );
          })}
          {brokenTotal > 0 && (
            <div
              style={css(
                "padding:9px 16px;font-size:11.5px;color:var(--danger);background:var(--danger-tint2);display:flex;align-items:center;gap:6px"
              )}
            >
              <Svg paths={I_ALERT} size={13} sw={2} />
              Списано за бой / утерю: {brokenTotal} ед. · удержание {money(udrzh)} сом
            </div>
          )}
        </div>

        {/* расчёт */}
        <div
          style={css(
            "background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px"
          )}
        >
          <div style={css("font-size:13px;font-weight:600;margin-bottom:12px")}>Расчёт</div>
          <div style={css("display:flex;flex-direction:column;gap:9px;font-size:12.5px")}>
            <Row label="Аренда" value={money(b.rental_total)} />
            <div style={css("display:flex;justify-content:space-between")}>
              <span style={css("color:var(--text-2)")}>Удержание за бой</span>
              <span
                style={mix(MONO, { color: udrzh > 0 ? "var(--danger)" : "var(--text-2)" })}
              >
                {udrzh > 0 ? "+" : ""}
                {money(udrzh)}
              </span>
            </div>
            <Row label="Предоплата" value={`−${money(b.prepaid)}`} />
            <div style={css("height:1px;background:var(--border-2);margin:3px 0")} />
            <div style={css("display:flex;justify-content:space-between;align-items:baseline")}>
              <span style={css("font-weight:600")}>К оплате</span>
              <span style={css(MONO + ";font-size:20px;font-weight:600;color:var(--text)")}>
                {money(toPay)}
              </span>
            </div>
            <div style={css("text-align:right;font-size:10.5px;color:var(--text-4);margin-top:-4px")}>
              сом
            </div>
          </div>
          {b.deposit != null && b.deposit > 0 && (
            <div
              style={css(
                "margin-top:12px;padding-top:12px;border-top:1px solid var(--border-2);font-size:11.5px;color:var(--text-3)"
              )}
            >
              Залог: <b style={css(MONO + ";color:var(--text-2)")}>{money(b.deposit)}</b> сом
            </div>
          )}
        </div>
      </div>

      {/* ---- Выдача ---- */}
      {modal?.type === "issue" && (
        <ModalShell
          title={`Выдача · Бронь №${b.id}`}
          icon={<Svg paths={I_TRUCK2} size={16} sw={1.7} />}
          onClose={() => setModal(null)}
          width={520}
          footer={
            <>
              <HButton onClick={() => setModal(null)} s={btnGhost} hover="background:var(--hover)">
                Отмена
              </HButton>
              <HButton onClick={submitIssue} s={btnPrimary} hover="background:var(--accent-hover)">
                Выдать
              </HButton>
            </>
          }
        >
          <div style={css("padding:18px;display:flex;flex-direction:column;gap:12px")}>
            <div style={css("font-size:12.5px;color:var(--text-3)")}>
              Укажите количество по каждой позиции. Выдача может быть частичной.
            </div>
            {modal.rows.map((r, i) => {
              const it = b.items.find((x) => x.product_id === r.product_id)!;
              const rem = it.quantity - it.issued_qty;
              const over = num(r.qty) > rem;
              return (
                <div
                  key={r.product_id}
                  style={css(
                    "display:flex;align-items:center;gap:10px;border:1px solid var(--border-2);border-radius:9px;padding:10px 12px"
                  )}
                >
                  <div style={css("flex:1;min-width:0")}>
                    <div style={css("font-size:13px;font-weight:500")}>{it.product_name}</div>
                    <div style={css("font-size:11px;color:var(--text-4)")}>
                      осталось к выдаче {rem}
                    </div>
                  </div>
                  <input
                    value={r.qty}
                    inputMode="numeric"
                    onChange={(e) => {
                      const rows = modal.rows.map((x, idx) =>
                        idx === i ? { ...x, qty: e.target.value } : x
                      );
                      patch({ rows, error: "" });
                    }}
                    style={mix(inputNumStyle, {
                      width: "80px",
                      textAlign: "center",
                      borderColor: over ? "var(--danger-dot)" : "var(--border-strong)",
                    })}
                  />
                </div>
              );
            })}
            <ModalError text={modal.error} />
          </div>
        </ModalShell>
      )}

      {/* ---- Возврат с боем ---- */}
      {modal?.type === "return" && (
        <ModalShell
          title={`Приём возврата · Бронь №${b.id}`}
          icon={<Svg paths={I_RETURN} size={16} />}
          onClose={() => setModal(null)}
          width={620}
          footer={
            <>
              <HButton onClick={() => setModal(null)} s={btnGhost} hover="background:var(--hover)">
                Отмена
              </HButton>
              <HButton onClick={submitReturn} s={btnPrimary} hover="background:var(--accent-hover)">
                Принять возврат
              </HButton>
            </>
          }
        >
          <div style={css("padding:18px")}>
            <div style={css("font-size:12.5px;color:var(--text-3);margin-bottom:12px")}>
              По каждой позиции укажите, сколько вернулось целыми и сколько разбито / утеряно.
              Возврат может быть частичным.
            </div>
            <div
              style={css(
                "display:grid;grid-template-columns:1.6fr .7fr .8fr .8fr 1fr;background:var(--surface-2);border:1px solid var(--border-2);border-radius:8px 8px 0 0;font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3)"
              )}
            >
              <div style={css("padding:8px 12px")}>Товар</div>
              <div style={css("padding:8px 8px;text-align:right")}>На руках</div>
              <div style={css("padding:8px 8px;text-align:center")}>Целых</div>
              <div style={css("padding:8px 8px;text-align:center")}>Бой</div>
              <div style={css("padding:8px 12px;text-align:right")}>Удержание</div>
            </div>
            <div style={css("border:1px solid var(--border-2);border-top:none;border-radius:0 0 8px 8px")}>
              {modal.rows.map((r, i) => {
                const it = b.items.find((x) => x.product_id === r.product_id)!;
                const oh = onHandsQty(it);
                const w = num(r.whole);
                const br = num(r.broken);
                const over = w + br > oh;
                const lineU = br * it.deposit_price;
                return (
                  <div
                    key={r.product_id}
                    style={css(
                      "display:grid;grid-template-columns:1.6fr .7fr .8fr .8fr 1fr;align-items:center;border-bottom:1px solid var(--border-2)"
                    )}
                  >
                    <div style={css("padding:10px 12px;min-width:0")}>
                      <div style={css("font-size:13px;font-weight:500")}>{it.product_name}</div>
                      <div style={css("font-size:11px;color:var(--text-4)")}>
                        залог {money(it.deposit_price)}
                      </div>
                    </div>
                    <div
                      style={css(
                        "padding:10px 8px;text-align:right;" + MONO + ";font-size:12.5px;color:var(--text-2)"
                      )}
                    >
                      {oh}
                    </div>
                    <div style={css("padding:8px")}>
                      <input
                        value={r.whole}
                        inputMode="numeric"
                        placeholder="0"
                        onChange={(e) => {
                          const rows = modal.rows.map((x, idx) =>
                            idx === i ? { ...x, whole: e.target.value } : x
                          );
                          patch({ rows, error: "" });
                        }}
                        style={mix(inputNumStyle, {
                          height: "32px",
                          textAlign: "center",
                          borderColor: over ? "var(--danger-dot)" : "var(--border-strong)",
                        })}
                      />
                    </div>
                    <div style={css("padding:8px")}>
                      <input
                        value={r.broken}
                        inputMode="numeric"
                        placeholder="0"
                        onChange={(e) => {
                          const rows = modal.rows.map((x, idx) =>
                            idx === i ? { ...x, broken: e.target.value } : x
                          );
                          patch({ rows, error: "" });
                        }}
                        style={mix(inputNumStyle, {
                          height: "32px",
                          textAlign: "center",
                          color: br > 0 ? "var(--danger)" : "var(--text)",
                          borderColor: over
                            ? "var(--danger-dot)"
                            : br > 0
                              ? "var(--danger-border)"
                              : "var(--border-strong)",
                        })}
                      />
                    </div>
                    <div
                      style={mix(
                        "padding:10px 12px;text-align:right;" + MONO + ";font-size:12.5px;font-weight:600",
                        { color: lineU > 0 ? "var(--danger)" : "var(--text-5)" }
                      )}
                    >
                      {lineU > 0 ? money(lineU) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={css(
                "display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:11px 13px;border-radius:8px;background:var(--surface-2);border:1px solid var(--border-2)"
              )}
            >
              <span style={css("font-size:12.5px;color:var(--text-2)")}>Удержание за бой</span>
              <span style={mix(MONO + ";font-size:15px;font-weight:600", {
                color:
                  modal.rows.reduce((a, r) => {
                    const it = b.items.find((x) => x.product_id === r.product_id)!;
                    return a + num(r.broken) * it.deposit_price;
                  }, 0) > 0
                    ? "var(--danger)"
                    : "var(--text)",
              })}>
                {money(
                  modal.rows.reduce((a, r) => {
                    const it = b.items.find((x) => x.product_id === r.product_id)!;
                    return a + num(r.broken) * it.deposit_price;
                  }, 0)
                )}{" "}
                сом
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              <ModalError text={modal.error} />
            </div>
          </div>
        </ModalShell>
      )}

      {/* ---- Отмена ---- */}
      {modal?.type === "cancel" && (
        <ModalShell
          title="Отменить бронь"
          tone="danger"
          icon={<Svg paths={I_BAN} size={16} />}
          onClose={() => setModal(null)}
          width={440}
          footer={
            <>
              <HButton onClick={() => setModal(null)} s={btnGhost} hover="background:var(--hover)">
                Не отменять
              </HButton>
              <HButton onClick={submitCancel} s={btnDanger} hover="background:var(--danger-solid-hover)">
                Отменить бронь
              </HButton>
            </>
          }
        >
          <div style={css("padding:18px")}>
            <div
              style={css(
                "background:var(--danger-tint2);border:1px solid var(--danger-border);border-radius:10px;padding:14px 15px;font-size:12.5px;color:var(--text-2);line-height:1.6"
              )}
            >
              Бронь <b>№{b.id}</b> будет отменена, а зарезервированный остаток вернётся на склад.
              Действие необратимо.
            </div>
          </div>
        </ModalShell>
      )}
    </Page>
  );
}

function Cell({ v }: { v: string }) {
  return (
    <div style={css("padding:10px;text-align:right;" + MONO + ";font-size:12.5px;color:var(--text-2)")}>
      {v}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={css("display:flex;justify-content:space-between")}>
      <span style={css("color:var(--text-2)")}>{label}</span>
      <span style={css(MONO)}>{value}</span>
    </div>
  );
}

// ============================ СОЗДАНИЕ ============================
interface Line {
  product_id: number;
  qty: string;
}

export function BookingCreate({ isDesktop, toast }: Props) {
  const nav = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);

  const today = todayISO();
  const tomorrow = todayISO(1);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [point, setPoint] = useState<number>(0);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(tomorrow);
  const [lines, setLines] = useState<Line[]>([]);
  const [prepay, setPrepay] = useState("");
  const [deposit, setDeposit] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    listClients().then(setClients).catch(() => setClients([]));
    listProducts().then(setProducts).catch(() => setProducts([]));
    listStock().then(setStock).catch(() => setStock([]));
    listLocations()
      .then((ls) => {
        setLocations(ls);
        const active = ls.find((l) => l.is_active) ?? ls[0];
        if (active) setPoint(active.id);
      })
      .catch(() => setLocations([]));
  }, []);

  const dateError = new Date(end) < new Date(start);
  const days = dateError ? 0 : daysBetween(start, end);
  const prod = (id: number) => products.find((p) => p.id === id);

  const custFiltered = clients
    .filter((c) => {
      const q = customerQuery.trim();
      if (!q) return false;
      return matchText(c.name, q) || matchPhone(c.phone, q);
    })
    .slice(0, 5);

  const rentTotal = lines.reduce(
    (a, l) => a + num(l.qty) * (prod(l.product_id)?.daily_price ?? 0) * days,
    0
  );
  const toPay = rentTotal - num(prepay);

  function addLine(id: number) {
    if (!id || lines.some((l) => l.product_id === id)) return;
    setLines([...lines, { product_id: id, qty: "1" }]);
  }

  async function submit(asDraft = false) {
    setErr("");
    if (!customerId && !creatingNew) return setErr("Выберите клиента или создайте нового");
    if (creatingNew && (!customerName.trim() || !customerPhone.trim()))
      return setErr("Укажите имя и телефон нового клиента");
    if (!lines.length) return setErr("Добавьте хотя бы одну позицию");
    if (dateError) return setErr("Дата возврата не может быть раньше даты начала");
    // Черновик остаток не занимает — доступность проверим при подтверждении.
    for (const l of asDraft ? [] : lines) {
      const avail = availAny(prod(l.product_id), point, stock);
      const q = num(l.qty);
      if (q > avail)
        return setErr(
          `Недостаточно остатка «${prod(l.product_id)?.name}» на точке: нужно ${q}, доступно ${avail}`
        );
    }
    try {
      let clientId = customerId;
      if (creatingNew) {
        const c = await createClient({ name: customerName, phone: customerPhone, source: "call" });
        clientId = c.id;
      }
      const booking = await createBooking({
        client_id: clientId!,
        location_id: point,
        start_date: start,
        expected_return_date: end,
        items: lines.map((l) => ({ product_id: l.product_id, quantity: num(l.qty) })),
        prepaid: num(prepay),
        deposit: num(deposit) || null,
        draft: asDraft,
      });
      toast(
        "success",
        asDraft
          ? `Черновик №${booking.id} сохранён — остаток не занят`
          : `Бронь №${booking.id} создана и подтверждена`
      );
      nav(`/bookings/${booking.id}`);
    } catch (e) {
      setErr(apiError(e));
    }
  }

  return (
    <Page>
      <HButton
        onClick={() => nav("/bookings")}
        s="display:inline-flex;align-items:center;gap:6px;border:none;background:transparent;color:var(--text-2);font-size:12.5px;cursor:pointer;padding:4px 0;margin-bottom:10px"
        hover="color:var(--accent)"
      >
        <Svg paths={I_BACK} size={15} />
        Все брони
      </HButton>
      <h2 style={css("margin:0 0 14px;font-size:20px;font-weight:600;letter-spacing:-.01em")}>
        Новая бронь
      </h2>

      <div
        style={{
          ...css("display:grid;gap:16px;align-items:start;max-width:1020px"),
          gridTemplateColumns: isDesktop ? "1.6fr 1fr" : "1fr",
        }}
      >
        <div style={css("display:flex;flex-direction:column;gap:14px")}>
          {/* Клиент */}
          <div
            style={css(
              "background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:15px 16px"
            )}
          >
            <Eyebrow>Клиент</Eyebrow>
            {customerId ? (
              <div
                style={css(
                  "display:flex;align-items:center;gap:10px;background:var(--accent-tint2);border:1px solid var(--accent-border);border-radius:8px;padding:9px 12px"
                )}
              >
                <div
                  style={css(
                    "width:30px;height:30px;border-radius:50%;background:var(--accent-border);color:var(--accent-strong);display:flex;align-items:center;justify-content:center;flex:none"
                  )}
                >
                  <Svg paths={I_USER} size={15} />
                </div>
                <div style={css("flex:1;min-width:0")}>
                  <div style={css("font-size:13px;font-weight:600")}>{customerName}</div>
                  <div style={css("font-size:11.5px;color:var(--text-3);" + MONO)}>
                    {customerPhone}
                  </div>
                </div>
                <HButton
                  onClick={() => {
                    setCustomerId(null);
                    setCustomerName("");
                    setCustomerPhone("");
                    setCustomerQuery("");
                    setCreatingNew(false);
                  }}
                  s="width:28px;height:28px;border:none;background:transparent;border-radius:6px;cursor:pointer;color:var(--text-3);display:flex;align-items:center;justify-content:center;flex:none"
                  hover="background:var(--accent-border)"
                >
                  <Svg paths={I_CLOSE} size={15} />
                </HButton>
              </div>
            ) : creatingNew ? (
              <div style={css("display:flex;flex-direction:column;gap:10px")}>
                <div
                  style={css(
                    "display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--accent-strong);font-weight:500"
                  )}
                >
                  <Svg paths={I_PLUS} size={14} sw={2} />
                  Новый клиент — сохранится по телефону
                </div>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Имя"
                  style={css(inputStyle)}
                />
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Телефон, напр. +996 555 000 000"
                  inputMode="tel"
                  style={css(inputStyle + ";" + MONO)}
                />
                <HButton
                  onClick={() => {
                    setCreatingNew(false);
                    setCustomerQuery("");
                  }}
                  s="align-self:flex-start;border:none;background:transparent;color:var(--text-3);font-size:11.5px;cursor:pointer;padding:0"
                  hover="color:var(--accent)"
                >
                  ← выбрать существующего
                </HButton>
              </div>
            ) : (
              <div style={css("position:relative")}>
                <input
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value);
                    setShowDrop(true);
                  }}
                  placeholder="Поиск по имени или телефону…"
                  style={css(inputStyle)}
                />
                {showDrop && customerQuery.trim() && (
                  <div
                    style={css(
                      "position:absolute;top:41px;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:9px;box-shadow:0 10px 30px rgba(0,0,0,.13);z-index:20;overflow:hidden;animation:pop .12s ease"
                    )}
                  >
                    {custFiltered.map((c) => (
                      <HButton
                        key={c.id}
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerName(c.name);
                          setCustomerPhone(c.phone);
                          setCustomerQuery(c.name);
                          setShowDrop(false);
                        }}
                        s="width:100%;text-align:left;border:none;background:transparent;padding:9px 12px;cursor:pointer;display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid var(--border-2)"
                        hover="background:var(--accent-tint2)"
                      >
                        <span style={css("font-size:13px;font-weight:500")}>{c.name}</span>
                        <span style={css("font-size:11.5px;color:var(--text-4);" + MONO)}>
                          {c.phone}
                        </span>
                      </HButton>
                    ))}
                    <HButton
                      onClick={() => {
                        setCreatingNew(true);
                        setShowDrop(false);
                        setCustomerName(customerQuery);
                      }}
                      s="width:100%;text-align:left;border:none;background:var(--surface-2);padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;color:var(--accent-strong);font-size:12.5px;font-weight:500"
                      hover="background:var(--accent-tint)"
                    >
                      <Svg paths={I_PLUS} size={15} sw={2} />
                      Создать: «{customerQuery}»
                    </HButton>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Точка и даты */}
          <div
            style={css(
              "background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:15px 16px;display:flex;flex-direction:column;gap:14px"
            )}
          >
            <div>
              <Eyebrow>Точка выдачи</Eyebrow>
              <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
                {locations
                  .filter((l) => l.is_active)
                  .map((l) => (
                    <button key={l.id} onClick={() => setPoint(l.id)} style={chipStyle(point === l.id)}>
                      {l.name}
                    </button>
                  ))}
              </div>
            </div>
            <div style={css("display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end")}>
              <label style={css("flex:1;min-width:130px")}>
                <FieldLabel>Дата начала</FieldLabel>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  style={css(inputStyle + ";" + MONO)}
                />
              </label>
              <label style={css("flex:1;min-width:130px")}>
                <FieldLabel>Дата возврата</FieldLabel>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  style={css(inputStyle + ";" + MONO)}
                />
              </label>
              <div
                style={css(
                  "height:36px;display:flex;align-items:center;padding:0 12px;background:var(--accent-tint2);border:1px solid var(--accent-border);border-radius:8px;font-size:12.5px;color:var(--accent-strong);font-weight:500;" +
                    MONO
                )}
              >
                {dateError ? "—" : `${days} сут.`}
              </div>
            </div>
            {dateError && (
              <div
                style={css(
                  "background:var(--danger-tint);border:1px solid var(--danger-border);color:var(--danger);padding:8px 11px;border-radius:8px;font-size:12px"
                )}
              >
                Дата возврата не может быть раньше даты начала
              </div>
            )}
          </div>

          {/* Позиции */}
          <div
            style={css(
              "background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:15px 16px"
            )}
          >
            <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:10px")}>
              <div
                style={css(
                  "font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3);flex:1"
                )}
              >
                Позиции
              </div>
              <select
                value=""
                onChange={(e) => addLine(Number(e.target.value))}
                style={css(
                  "height:32px;padding:0 10px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);font-size:12.5px;color:var(--accent);font-weight:500;outline:none;cursor:pointer"
                )}
              >
                <option value="">＋ Добавить позицию</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.type === "set" ? " (комплект)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {lines.length > 0 ? (
              <div style={css("display:flex;flex-direction:column;gap:8px")}>
                {lines.map((l, i) => {
                  const p = prod(l.product_id);
                  const avail = availAny(p, point, stock);
                  const q = num(l.qty);
                  const over = q > avail;
                  const lineTotal = q * (p?.daily_price ?? 0) * days;
                  return (
                    <div
                      key={l.product_id}
                      style={mix("border-radius:9px;padding:10px 12px", {
                        border: `1px solid ${over ? "var(--danger-border)" : "var(--border-2)"}`,
                        background: over ? "var(--danger-tint2)" : "var(--surface)",
                      })}
                    >
                      <div style={css("display:flex;align-items:center;gap:10px")}>
                        <div style={css("flex:1;min-width:0")}>
                          <div style={css("font-size:13px;font-weight:500;color:var(--text)")}>
                            {p?.name}
                          </div>
                          <div
                            style={mix("font-size:11px;font-weight:600;margin-top:1px", {
                              color: over
                                ? "var(--danger)"
                                : avail <= 10
                                  ? "var(--amber)"
                                  : "var(--green)",
                            })}
                          >
                            доступно {avail} {p?.unit}
                          </div>
                        </div>
                        <div
                          style={css(
                            "display:flex;align-items:center;background:var(--surface);border:1px solid var(--border-strong);border-radius:8px;overflow:hidden;flex:none"
                          )}
                        >
                          <HButton
                            onClick={() => {
                              const next = [...lines];
                              next[i] = { ...l, qty: String(Math.max(1, num(l.qty) - 1)) };
                              setLines(next);
                            }}
                            s="width:30px;height:32px;border:none;background:var(--surface);cursor:pointer;color:var(--text-2);font-size:17px;line-height:1"
                            hover="background:var(--hover)"
                          >
                            −
                          </HButton>
                          <input
                            value={l.qty}
                            inputMode="numeric"
                            onChange={(e) => {
                              const next = [...lines];
                              next[i] = { ...l, qty: e.target.value };
                              setLines(next);
                            }}
                            style={css(
                              "width:46px;height:32px;border:none;border-left:1px solid var(--border-2);border-right:1px solid var(--border-2);text-align:center;font-size:13px;" +
                                MONO +
                                ";outline:none;background:var(--surface)"
                            )}
                          />
                          <HButton
                            onClick={() => {
                              const next = [...lines];
                              next[i] = { ...l, qty: String(num(l.qty) + 1) };
                              setLines(next);
                            }}
                            s="width:30px;height:32px;border:none;background:var(--surface);cursor:pointer;color:var(--text-2);font-size:17px;line-height:1"
                            hover="background:var(--hover)"
                          >
                            +
                          </HButton>
                        </div>
                        <div
                          style={css(
                            "width:90px;text-align:right;" + MONO + ";font-size:13px;font-weight:600;flex:none"
                          )}
                        >
                          {money(lineTotal)}
                        </div>
                        <HButton
                          onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                          s="width:28px;height:28px;border:none;background:transparent;border-radius:6px;cursor:pointer;color:var(--text-5);display:flex;align-items:center;justify-content:center;flex:none"
                          hover="background:var(--danger-tint2);color:var(--danger)"
                        >
                          <Svg paths={I_CLOSE} size={15} />
                        </HButton>
                      </div>
                      {over && (
                        <div
                          style={css(
                            "margin-top:8px;display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--danger);font-weight:500"
                          )}
                        >
                          <Svg paths={I_ALERT} size={13} sw={2} />
                          Недостаточно остатка: нужно {q}, доступно {avail}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={css(
                  "border:1px dashed var(--border);border-radius:9px;padding:22px;text-align:center;color:var(--text-4);font-size:12.5px"
                )}
              >
                Добавьте позиции — рядом сразу покажем доступность на выбранной точке
              </div>
            )}
          </div>

          {/* Оплата */}
          <div
            style={css(
              "background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:15px 16px;display:flex;gap:12px;flex-wrap:wrap"
            )}
          >
            <label style={css("flex:1;min-width:130px")}>
              <FieldLabel>Предоплата</FieldLabel>
              <input
                value={prepay}
                onChange={(e) => setPrepay(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                style={css(inputStyle + ";" + MONO)}
              />
            </label>
            <label style={css("flex:1;min-width:130px")}>
              <FieldLabel>
                Залог <span style={css("color:var(--text-5);font-weight:400")}>— необяз.</span>
              </FieldLabel>
              <input
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                style={css(inputStyle + ";" + MONO)}
              />
            </label>
          </div>
        </div>

        {/* Итог */}
        <div
          style={css(
            "background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;position:sticky;top:16px"
          )}
        >
          <div style={css("font-size:13px;font-weight:600;margin-bottom:12px")}>Итог брони</div>
          <div
            style={css(
              "display:flex;justify-content:space-between;font-size:12px;color:var(--text-2);margin-bottom:4px"
            )}
          >
            <span>Период</span>
            <span style={css(MONO + ";color:var(--text)")}>
              {start} → {end}
            </span>
          </div>
          <div
            style={css(
              "display:flex;justify-content:space-between;font-size:12px;color:var(--text-2);padding-bottom:10px;border-bottom:1px solid var(--border-2)"
            )}
          >
            <span>Срок</span>
            <span style={css(MONO + ";color:var(--text)")}>
              {dateError ? "—" : `${days} сут.`}
            </span>
          </div>

          {lines.length > 0 && (
            <div
              style={css(
                "display:flex;flex-direction:column;gap:7px;padding:10px 0;border-bottom:1px solid var(--border-2)"
              )}
            >
              {lines.map((l) => {
                const p = prod(l.product_id);
                return (
                  <div
                    key={l.product_id}
                    style={css("display:flex;justify-content:space-between;gap:10px;font-size:12px")}
                  >
                    <span
                      style={css(
                        "color:var(--text-2);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                      )}
                    >
                      {p?.name} × {l.qty}
                    </span>
                    <span style={css(MONO + ";flex:none")}>
                      {money(num(l.qty) * (p?.daily_price ?? 0) * days)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={css("display:flex;flex-direction:column;gap:8px;padding-top:12px")}>
            <div style={css("display:flex;justify-content:space-between;font-size:12.5px")}>
              <span style={css("color:var(--text-2)")}>Аренда</span>
              <span style={css(MONO)}>{money(rentTotal)}</span>
            </div>
            <div style={css("display:flex;justify-content:space-between;font-size:12.5px")}>
              <span style={css("color:var(--text-2)")}>Предоплата</span>
              <span style={css(MONO)}>−{money(num(prepay))}</span>
            </div>
            <div style={css("height:1px;background:var(--border-2);margin:2px 0")} />
            <div style={css("display:flex;justify-content:space-between;align-items:baseline")}>
              <span style={css("font-weight:600;font-size:13px")}>К оплате</span>
              <span style={css(MONO + ";font-size:20px;font-weight:600")}>{money(toPay)}</span>
            </div>
            <div style={css("text-align:right;font-size:10.5px;color:var(--text-4);margin-top:-4px")}>
              сом
            </div>
          </div>

          {err && (
            <div style={{ marginTop: 12 }}>
              <ModalError text={err} />
            </div>
          )}

          <HButton
            onClick={() => submit(false)}
            s="width:100%;height:40px;margin-top:14px;background:var(--accent);color:#fff;border:none;border-radius:9px;font-size:13.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px"
            hover="background:var(--accent-hover)"
          >
            <Svg paths={I_CHECK} size={16} sw={2} />
            Создать и подтвердить
          </HButton>

          <HButton
            onClick={() => submit(true)}
            s="width:100%;height:36px;margin-top:8px;background:var(--surface);color:var(--text-2);border:1px solid var(--border-strong);border-radius:9px;font-size:12.5px;font-weight:500;cursor:pointer"
            hover="background:var(--hover)"
          >
            Сохранить черновик
          </HButton>
          <div style={css("font-size:10.5px;color:var(--text-4);margin-top:6px;text-align:center")}>
            Черновик не занимает остаток
          </div>
        </div>
      </div>
    </Page>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={css(
        "font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3);margin-bottom:9px"
      )}
    >
      {children}
    </div>
  );
}
