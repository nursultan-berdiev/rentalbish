/** Заявки с сайта: список, отклонение и конвертация в бронь (точка + даты назначает оператор). */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiError } from "../api/client";
import {
  convertWebOrder,
  listLocations,
  listProducts,
  listWebOrders,
  updateWebOrderStatus,
  type Location,
  type Product,
  type WebOrder,
} from "../api/domain";
import { css, mix, todayISO } from "../design/css";
import { I_TRUCK, Svg } from "../design/icons";
import { MONO, PANEL, Page, SearchInput, THEAD, TROW, Toolbar } from "../design/table";
import {
  FieldLabel,
  HButton,
  ModalError,
  ModalShell,
  btnGhost,
  btnPrimary,
  chipStyle,
  inputNumStyle,
  inputStyle,
  tabStyle,
} from "../design/ui";
import { matchPhone, matchText } from "../lib/search";


const STATUS: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  new: { label: "Новая", bg: "var(--accent-tint)", fg: "var(--accent-strong)", dot: "var(--accent)" },
  in_progress: {
    label: "В обработке",
    bg: "var(--amber-tint)",
    fg: "var(--amber)",
    dot: "var(--amber-dot)",
  },
  converted: {
    label: "В брони",
    bg: "var(--green-tint)",
    fg: "var(--green)",
    dot: "var(--green-dot)",
  },
  rejected: {
    label: "Отклонена",
    bg: "var(--muted-bg2)",
    fg: "var(--muted-fg)",
    dot: "var(--muted-dot)",
  },
};

const GRID = "64px 1.6fr 1.3fr 2fr 1.1fr 150px";

export default function Requests({
  toast,
}: {
  isDesktop: boolean;
  toast: (k: "success" | "error", t: string) => void;
}) {
  const [rows, setRows] = useState<WebOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [status, setStatus] = useState<"all" | string>("all");
  const [query, setQuery] = useState("");
  const [converting, setConverting] = useState<WebOrder | null>(null);

  const reload = () => listWebOrders().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    reload();
    listProducts().then(setProducts).catch(() => setProducts([]));
    listLocations().then(setLocations).catch(() => setLocations([]));
  }, []);

  const prodName = (id: number) => products.find((p) => p.id === id)?.name ?? `#${id}`;

  const visible = rows
    .filter((o) => status === "all" || o.status === status)
    .filter((o) => {
      const q = query.trim().toLowerCase();
      return !q || matchText(o.name, q) || matchPhone(o.phone, q);
    });

  const cnt = (k: string) => rows.filter((o) => o.status === k).length;
  const tabs = [
    { key: "all", label: "Все", count: rows.length },
    { key: "new", label: "Новые", count: cnt("new") },
    { key: "in_progress", label: "В работе", count: cnt("in_progress") },
    { key: "converted", label: "В брони", count: cnt("converted") },
    { key: "rejected", label: "Отклонены", count: cnt("rejected") },
  ];

  async function reject(o: WebOrder) {
    try {
      await updateWebOrderStatus(o.id, "rejected");
      await reload();
      toast("success", `Заявка №${o.id} отклонена`);
    } catch (e) {
      toast("error", apiError(e));
    }
  }

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
              <button key={t.key} onClick={() => setStatus(t.key)} style={tabStyle(status === t.key)}>
                {t.label}
                <span style={css(MONO + ";opacity:.7;margin-left:5px")}>{t.count}</span>
              </button>
            ))}
          </div>
        }
        search={<SearchInput value={query} onChange={setQuery} placeholder="Имя или телефон…" />}
      />

      <div
        style={css(PANEL)}
      >
        <div
          style={mix(
            THEAD,
            { gridTemplateColumns: GRID }
          )}
        >
          <div style={css("padding:9px 14px")}>№</div>
          <div style={css("padding:9px 14px")}>Имя</div>
          <div style={css("padding:9px 14px")}>Телефон</div>
          <div style={css("padding:9px 14px")}>Позиции</div>
          <div style={css("padding:9px 14px")}>Статус</div>
          <div style={css("padding:9px 14px")} />
        </div>

        {visible.length === 0 ? (
          <div style={css("padding:50px 20px;text-align:center;color:var(--text-3)")}>
            <div style={css("font-size:13.5px;font-weight:500;color:var(--text-2)")}>
              Заявок нет
            </div>
            <div style={css("font-size:12px;margin-top:3px")}>
              Заявки приходят с сайта-витрины и дублируются в Telegram
            </div>
          </div>
        ) : (
          visible.map((o) => {
            const st = STATUS[o.status] ?? STATUS.new;
            const isNew = o.status === "new";
            return (
              <div
                key={o.id}
                style={mix(
                  TROW,
                  { gridTemplateColumns: GRID },
                  isNew ? { background: "var(--accent-tint2)" } : {}
                )}
              >
                <div
                  style={css("padding:10px 14px;" + MONO + ";font-size:12.5px;color:var(--text-3)")}
                >
                  {o.id}
                </div>
                <div style={css("padding:10px 14px;font-weight:600;font-size:13px")}>{o.name}</div>
                <div
                  style={css("padding:10px 14px;" + MONO + ";font-size:12.5px;color:var(--text-2)")}
                >
                  {o.phone}
                </div>
                <div
                  style={css(
                    "padding:10px 14px;font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                  )}
                >
                  {o.items.map((i) => `${prodName(i.product_id)} × ${i.quantity}`).join(", ")}
                </div>
                <div style={css("padding:10px 14px")}>
                  <span
                    style={mix(
                      "display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:20px",
                      { color: st.fg, background: st.bg }
                    )}
                  >
                    <span
                      style={mix("width:6px;height:6px;border-radius:50%", { background: st.dot })}
                    />
                    {st.label}
                  </span>
                </div>
                <div style={css("padding:7px 12px;display:flex;gap:6px;justify-content:flex-end")}>
                  {o.status !== "converted" && o.status !== "rejected" && (
                    <>
                      <HButton
                        onClick={() => setConverting(o)}
                        s="height:28px;padding:0 10px;background:var(--accent);color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer"
                        hover="background:var(--accent-hover)"
                      >
                        В бронь
                      </HButton>
                      <HButton
                        title="Отклонить"
                        onClick={() => reject(o)}
                        s="width:28px;height:28px;border:1px solid var(--danger-border);background:var(--surface);border-radius:7px;cursor:pointer;color:var(--danger);display:flex;align-items:center;justify-content:center;font-size:13px"
                        hover="background:var(--danger-tint2)"
                      >
                        ✕
                      </HButton>
                    </>
                  )}
                  {o.status === "converted" && o.booking_id && (
                    <BookingLink id={o.booking_id} />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {converting && (
        <ConvertModal
          order={converting}
          locations={locations}
          prodName={prodName}
          onClose={() => setConverting(null)}
          onDone={async (bookingId) => {
            setConverting(null);
            await reload();
            toast("success", `Заявка сконвертирована в бронь №${bookingId}`);
          }}
        />
      )}
    </Page>
  );
}

function BookingLink({ id }: { id: number }) {
  const nav = useNavigate();
  return (
    <HButton
      onClick={() => nav(`/bookings/${id}`)}
      s="height:28px;padding:0 10px;background:var(--surface);color:var(--text-2);border:1px solid var(--border);border-radius:7px;font-size:12px;cursor:pointer"
      hover="border-color:var(--accent);color:var(--accent)"
    >
      Бронь №{id}
    </HButton>
  );
}

function ConvertModal({
  order,
  locations,
  prodName,
  onClose,
  onDone,
}: {
  order: WebOrder;
  locations: Location[];
  prodName: (id: number) => string;
  onClose: () => void;
  onDone: (bookingId: number) => void;
}) {
  const today = todayISO();
  const tomorrow = todayISO(1);
  const active = locations.filter((l) => l.is_active);

  const [point, setPoint] = useState<number>(active[0]?.id ?? 0);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(tomorrow);
  const [prepay, setPrepay] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!point) return setError("Выберите точку выдачи");
    try {
      const b = await convertWebOrder(order.id, {
        location_id: point,
        start_date: start,
        expected_return_date: end,
        prepaid: Number(prepay) || 0,
      });
      onDone(b.id);
    } catch (e) {
      setError(apiError(e));
    }
  }

  return (
    <ModalShell
      title={`Заявка №${order.id} → бронь`}
      icon={<Svg paths={I_TRUCK} size={16} sw={1.7} />}
      onClose={onClose}
      width={520}
      footer={
        <>
          <HButton onClick={onClose} s={btnGhost} hover="background:var(--hover)">
            Отмена
          </HButton>
          <HButton onClick={submit} s={btnPrimary} hover="background:var(--accent-hover)">
            Оформить бронь
          </HButton>
        </>
      }
    >
      <div style={css("padding:18px;display:flex;flex-direction:column;gap:14px")}>
        <div
          style={css(
            "background:var(--surface-2);border:1px solid var(--border-2);border-radius:8px;padding:11px 13px;font-size:12.5px"
          )}
        >
          <div style={css("font-weight:600;margin-bottom:4px")}>{order.name}</div>
          <div style={css("color:var(--text-2);" + MONO)}>{order.phone}</div>
          <div style={css("color:var(--text-2);margin-top:6px")}>
            {order.items.map((i) => `${prodName(i.product_id)} × ${i.quantity}`).join(", ")}
          </div>
          {order.comment && (
            <div style={css("color:var(--text-3);margin-top:6px;font-style:italic")}>
              «{order.comment}»
            </div>
          )}
        </div>

        <div>
          <FieldLabel>Точка выдачи</FieldLabel>
          <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
            {active.map((l) => (
              <button key={l.id} onClick={() => setPoint(l.id)} style={chipStyle(point === l.id)}>
                {l.name}
              </button>
            ))}
          </div>
          <div style={css("font-size:11px;color:var(--text-4);margin-top:6px")}>
            Клиент на сайте точку не выбирает — назначает оператор
          </div>
        </div>

        <div style={css("display:flex;gap:12px;flex-wrap:wrap")}>
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
          <label style={css("width:120px")}>
            <FieldLabel>Предоплата</FieldLabel>
            <input
              value={prepay}
              inputMode="numeric"
              placeholder="0"
              onChange={(e) => setPrepay(e.target.value)}
              style={css(inputNumStyle)}
            />
          </label>
        </div>

        <ModalError text={error} />
      </div>
    </ModalShell>
  );
}
