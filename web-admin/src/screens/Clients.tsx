/** Клиенты: список, карточка с историей броней, что на руках и общий долг. */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiError } from "../api/client";
import {
  createClient,
  getClientSummary,
  listClients,
  updateClient,
  type Client,
  type ClientSummary,
} from "../api/domain";
import { css, dm, mix, money } from "../design/css";
import { I_BACK, I_USER, Svg } from "../design/icons";
import { MONO, PANEL, Page, PrimaryAction, SearchInput, StatTile, THEAD, TROW, Toolbar } from "../design/table";
import {
  FieldLabel,
  HButton,
  LoadError,
  Loading,
  ModalError,
  ModalShell,
  StatusBadge,
  btnGhost,
  btnPrimary,
  inputStyle,
  selectStyle,
  type BookingStatusKey,
} from "../design/ui";
import { matchPhone, matchText } from "../lib/search";


const SOURCES: Record<string, string> = {
  site: "Сайт",
  call: "Звонок",
  messenger: "Мессенджер",
  other: "Другое",
};

const GRID = "70px 2fr 1.4fr 1fr 90px";

export default function Clients({
  toast,
}: {
  isDesktop: boolean;
  toast: (k: "success" | "error", t: string) => void;
}) {
  const nav = useNavigate();
  const [rows, setRows] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Client | "new" | null>(null);

  const reload = () => listClients().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    reload();
  }, []);

  const visible = rows.filter((c) => {
    const q = query.trim().toLowerCase();
    return !q || matchText(c.name, q) || matchPhone(c.phone, q);
  });

  return (
    <Page>
      <Toolbar
        search={
          <SearchInput value={query} onChange={setQuery} placeholder="Имя или телефон…" />
        }
        actions={<PrimaryAction onClick={() => setEditing("new")}>Новый клиент</PrimaryAction>}
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
          <div style={css("padding:9px 14px")}>ID</div>
          <div style={css("padding:9px 14px")}>Имя</div>
          <div style={css("padding:9px 14px")}>Телефон</div>
          <div style={css("padding:9px 14px")}>Источник</div>
          <div style={css("padding:9px 14px")} />
        </div>

        {visible.length === 0 ? (
          <div style={css("padding:50px 20px;text-align:center;color:var(--text-3)")}>
            <div style={css("font-size:13.5px;font-weight:500;color:var(--text-2)")}>
              Клиентов не найдено
            </div>
            <div style={css("font-size:12px;margin-top:3px")}>
              Клиент создаётся при брони или заявке с сайта
            </div>
          </div>
        ) : (
          visible.map((c) => (
            <div
              key={c.id}
              style={mix(TROW, {
                gridTemplateColumns: GRID,
              })}
            >
              <div style={css("padding:10px 14px;" + MONO + ";font-size:12.5px;color:var(--text-3)")}>
                {c.id}
              </div>
              <HButton
                onClick={() => nav(`/customers/${c.id}`)}
                s="padding:10px 14px;border:none;background:transparent;text-align:left;cursor:pointer;font-weight:600;font-size:13px;color:var(--text)"
                hover="color:var(--accent)"
              >
                {c.name}
              </HButton>
              <div style={css("padding:10px 14px;" + MONO + ";font-size:12.5px;color:var(--text-2)")}>
                {c.phone}
              </div>
              <div style={css("padding:10px 14px;font-size:12px;color:var(--text-2)")}>
                {SOURCES[c.source] ?? c.source}
              </div>
              <div style={css("padding:7px 12px;display:flex;justify-content:flex-end")}>
                <HButton
                  onClick={() => setEditing(c)}
                  s="width:26px;height:26px;border:1px solid var(--border);background:var(--surface);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:12px"
                  hover="border-color:var(--accent);color:var(--accent)"
                >
                  ✎
                </HButton>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <ClientForm
          client={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            await reload();
            toast("success", msg);
          }}
        />
      )}
    </Page>
  );
}

function ClientForm({
  client,
  onClose,
  onSaved,
}: {
  client: Client | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [source, setSource] = useState(client?.source ?? "call");
  const [comment, setComment] = useState(client?.comment ?? "");
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!name.trim() || !phone.trim()) return setError("Укажите имя и телефон");
    try {
      if (client) {
        await updateClient(client.id, { name, phone, source, comment });
        onSaved(`Клиент «${name}» сохранён`);
      } else {
        await createClient({ name, phone, source, comment });
        onSaved(`Клиент «${name}» создан`);
      }
    } catch (e) {
      setError(apiError(e));
    }
  }

  return (
    <ModalShell
      title={client ? `Клиент «${client.name}»` : "Новый клиент"}
      icon={<Svg paths={I_USER} size={16} />}
      onClose={onClose}
      width={460}
      footer={
        <>
          <HButton onClick={onClose} s={btnGhost} hover="background:var(--hover)">
            Отмена
          </HButton>
          <HButton onClick={save} s={btnPrimary} hover="background:var(--accent-hover)">
            {client ? "Сохранить" : "Создать"}
          </HButton>
        </>
      }
    >
      <div style={css("padding:18px;display:flex;flex-direction:column;gap:14px")}>
        <label>
          <FieldLabel>Имя</FieldLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} style={css(inputStyle)} />
        </label>
        <label>
          <FieldLabel>Телефон</FieldLabel>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="+996 555 000 000"
            style={css(inputStyle + ";" + MONO)}
          />
        </label>
        <label>
          <FieldLabel>Источник</FieldLabel>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            style={css(selectStyle)}
          >
            {Object.entries(SOURCES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <FieldLabel>Комментарий</FieldLabel>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={css(inputStyle)}
          />
        </label>
        <ModalError text={error} />
      </div>
    </ModalShell>
  );
}

// ---------------- Карточка клиента ----------------
export function ClientDetail({ isDesktop }: { isDesktop: boolean }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [s, setS] = useState<ClientSummary | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    getClientSummary(Number(id))
      .then(setS)
      .catch((e) => setError(apiError(e, "Не удалось загрузить карточку клиента")));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <LoadError text={error} onRetry={load} />;
  if (!s) return <Loading />;

  const onHandsQty = s.on_hands.reduce((a, x) => a + x.qty, 0);

  return (
    <Page size="detail">
      <HButton
        onClick={() => nav("/customers")}
        s="display:inline-flex;align-items:center;gap:6px;border:none;background:transparent;color:var(--text-2);font-size:12.5px;cursor:pointer;padding:4px 0;margin-bottom:12px"
        hover="color:var(--accent)"
      >
        <Svg paths={I_BACK} size={15} />
        Все клиенты
      </HButton>

      <div style={css("display:flex;align-items:center;gap:12px;margin-bottom:16px")}>
        <div
          style={css(
            "width:44px;height:44px;border-radius:50%;background:var(--accent-tint);color:var(--accent-strong);display:flex;align-items:center;justify-content:center;flex:none"
          )}
        >
          <Svg paths={I_USER} size={20} />
        </div>
        <div>
          <h2 style={css("margin:0;font-size:20px;font-weight:600;letter-spacing:-.01em")}>
            {s.client.name}
          </h2>
          <div style={css("font-size:12.5px;color:var(--text-3);" + MONO)}>{s.client.phone}</div>
        </div>
      </div>

      {/* показатели */}
      <div style={css("display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px")}>
        <StatTile grow label="Броней" value={String(s.bookings_count)} />
        <StatTile grow
          label="На руках"
          value={String(onHandsQty)}
          color={onHandsQty > 0 ? "var(--amber)" : undefined}
        />
        <StatTile grow
          label="Долг, сом"
          value={money(s.debt)}
          color={s.debt > 0 ? "var(--danger)" : "var(--green)"}
        />
      </div>

      <div
        style={{
          ...css("display:grid;gap:16px;align-items:start"),
          gridTemplateColumns: isDesktop ? "1.6fr 1fr" : "1fr",
        }}
      >
        {/* история броней */}
        <div
          style={css(PANEL)}
        >
          <div
            style={css(
              "padding:12px 16px;border-bottom:1px solid var(--border-2);font-size:13px;font-weight:600"
            )}
          >
            История броней
          </div>
          {s.bookings.length === 0 ? (
            <div style={css("padding:30px;text-align:center;color:var(--text-4);font-size:12.5px")}>
              Броней ещё не было
            </div>
          ) : (
            s.bookings.map((b) => {
              return (
                <HButton
                  key={b.id}
                  onClick={() => nav(`/bookings/${b.id}`)}
                  s="width:100%;display:flex;align-items:center;gap:12px;padding:11px 16px;border:none;border-bottom:1px solid var(--hover);background:transparent;cursor:pointer;text-align:left"
                  hover="background:var(--surface-2)"
                >
                  <span style={css(MONO + ";font-size:12px;color:var(--text-3);flex:none")}>
                    №{b.id}
                  </span>
                  <span style={css(MONO + ";font-size:12px;color:var(--text-2);flex:1")}>
                    {dm(b.start_date)} – {dm(b.expected_return_date)}
                  </span>
                  <span style={css(MONO + ";font-size:12.5px;font-weight:600")}>
                    {money(b.rental_total)}
                  </span>
                  <StatusBadge status={b.status as BookingStatusKey} size="sm" />
                </HButton>
              );
            })
          )}
        </div>

        {/* на руках */}
        <div
          style={css(
            "background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px"
          )}
        >
          <div style={css("font-size:13px;font-weight:600;margin-bottom:12px")}>Сейчас на руках</div>
          {s.on_hands.length === 0 ? (
            <div style={css("font-size:12.5px;color:var(--text-4)")}>Ничего не числится</div>
          ) : (
            <div style={css("display:flex;flex-direction:column;gap:8px")}>
              {s.on_hands.map((x, i) => (
                <div
                  key={i}
                  style={css("display:flex;justify-content:space-between;gap:10px;font-size:12.5px")}
                >
                  <span style={css("color:var(--text-2)")}>{x.product_name}</span>
                  <span style={css(MONO + ";font-weight:600")}>{x.qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

