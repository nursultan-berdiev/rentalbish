/** Отчёты: остатки, на руках/просрочки, движение за период, активность сотрудников. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiError, downloadFile } from "../api/client";
import {
  listStock,
  reportMovement,
  reportOnHands,
  reportStaffActivity,
  type MovementReport,
  type OnHandsRow,
  type StaffActivityRow,
  type StockRow,
} from "../api/domain";
import { useAuth } from "../auth/AuthContext";
import { css, lastDays, mix, money, todayISO } from "../design/css";
import { I_EXCEL, Svg } from "../design/icons";
import { MONO, PANEL, Page, StatTile, THEAD, TROW } from "../design/table";
import { HButton, OverdueBadge, chipStyle, inputStyle, tabStyle } from "../design/ui";


type Tab = "stock" | "on_hands" | "movement" | "staff";

export default function Reports({ isDesktop }: { isDesktop: boolean }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<Tab>("stock");

  const tabs: { key: Tab; label: string }[] = [
    { key: "stock", label: "Остатки" },
    { key: "on_hands", label: "На руках и просрочки" },
    { key: "movement", label: "Движение за период" },
    ...(isAdmin ? [{ key: "staff" as Tab, label: "Активность сотрудников" }] : []),
  ];

  return (
    <Page size="wide">
      <div
        style={css(
          "display:inline-flex;gap:4px;flex-wrap:wrap;background:var(--border-2);padding:3px;border-radius:9px;margin-bottom:14px"
        )}
      >
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={tabStyle(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stock" && <StockReport />}
      {tab === "on_hands" && <OnHandsReport />}
      {tab === "movement" && <MovementBlock isDesktop={isDesktop} />}
      {tab === "staff" && <StaffReport />}
    </Page>
  );
}

function ExcelButton({ path, filename }: { path: string; filename: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function download() {
    setBusy(true);
    setErr("");
    try {
      await downloadFile(path, filename);
    } catch (e) {
      setErr(apiError(e, "Не удалось выгрузить файл"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={css("display:inline-flex;align-items:center;gap:10px")}>
      <HButton
        onClick={download}
        s="height:34px;padding:0 13px;border:1px solid var(--border-strong);border-radius:8px;font-size:12.5px;color:var(--text-2);display:inline-flex;align-items:center;gap:7px;background:var(--surface);cursor:pointer"
        hover="border-color:var(--accent);color:var(--accent)"
      >
        <Svg paths={I_EXCEL} size={15} sw={1.7} />
        {busy ? "Готовим файл…" : "Выгрузить в Excel"}
      </HButton>
      {err && <span style={css("font-size:12px;color:var(--danger)")}>{err}</span>}
    </span>
  );
}

/** Инлайн-ошибка отчёта. Раньше блок при сбое молча пустел — было не понять, сломалось или данных нет. */
function BlockError({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div
      style={css(
        "margin-bottom:12px;padding:10px 13px;border:1px solid var(--danger-border);background:var(--danger-tint);color:var(--danger);border-radius:8px;font-size:12.5px"
      )}
    >
      {text}
    </div>
  );
}

function StockReport() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    listStock()
      .then((r) => {
        setRows(r);
        setErr("");
      })
      .catch((e) => setErr(apiError(e, "Не удалось загрузить остатки")));
  }, []);

  const GRID = "2fr 1.3fr .8fr 1fr .8fr 1fr";
  return (
    <>
      <div style={css("margin-bottom:12px")}>
        <ExcelButton path="/reports/stock.xlsx" filename="Остатки.xlsx" />
      </div>
      <BlockError text={err} />
      <div
        style={css(PANEL)}
      >
        <Head grid={GRID} cols={["Товар", "Точка", "Всего", "Бронь", "Выдано", "Доступно"]} rightFrom={2} />
        {rows.map((r) => (
          <div
            key={`${r.product_id}-${r.location_id}`}
            style={mix(TROW, {
              gridTemplateColumns: GRID,
            })}
          >
            <div style={css("padding:9px 14px;font-size:13px;font-weight:500")}>
              {r.product_name}
            </div>
            <div style={css("padding:9px 14px;font-size:12px;color:var(--text-2)")}>
              {r.location_name}
            </div>
            <Num v={r.total_qty} />
            <Num v={r.reserved_qty} />
            <Num v={r.issued_qty} />
            <div
              style={mix(
                "padding:9px 14px;text-align:right;" + MONO + ";font-size:13px;font-weight:600",
                { color: r.available <= 0 ? "var(--danger)" : "var(--text)" }
              )}
            >
              {money(r.available)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function OnHandsReport() {
  const nav = useNavigate();
  const [rows, setRows] = useState<OnHandsRow[]>([]);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    reportOnHands()
      .then((r) => {
        setRows(r);
        setErr("");
      })
      .catch((e) => setErr(apiError(e, "Не удалось загрузить список на руках")));
  }, []);

  const visible = rows.filter((r) => !onlyOverdue || r.overdue);
  const GRID = "70px 1.6fr 1.3fr 1.2fr 2fr";

  return (
    <>
      <div style={css("display:flex;gap:6px;margin-bottom:12px")}>
        <HButton onClick={() => setOnlyOverdue(false)} s={chipStyle(!onlyOverdue)}>
          Все ({rows.length})
        </HButton>
        <HButton onClick={() => setOnlyOverdue(true)} s={chipStyle(onlyOverdue)}>
          Только просрочки ({rows.filter((r) => r.overdue).length})
        </HButton>
      </div>
      <BlockError text={err} />

      <div
        style={css(PANEL)}
      >
        <Head grid={GRID} cols={["Бронь", "Клиент", "Телефон", "Ждём возврат", "Позиции"]} />
        {visible.length === 0 ? (
          <div style={css("padding:40px;text-align:center;color:var(--text-3);font-size:12.5px")}>
            Ничего не числится на руках
          </div>
        ) : (
          visible.map((r) => (
            <HButton
              key={r.booking_id}
              onClick={() => nav(`/bookings/${r.booking_id}`)}
              s={mix(
                "display:grid;border:none;border-bottom:1px solid var(--hover);align-items:center;background:transparent;cursor:pointer;text-align:left;width:100%",
                { gridTemplateColumns: GRID }
              )}
              hover="background:var(--surface-2)"
            >
              <div
                style={css("padding:10px 14px;" + MONO + ";font-size:12.5px;color:var(--text-3)")}
              >
                №{r.booking_id}
              </div>
              <div style={css("padding:10px 14px;font-weight:600;font-size:13px")}>
                {r.client_name}
              </div>
              <div
                style={css("padding:10px 14px;" + MONO + ";font-size:12.5px;color:var(--text-2)")}
              >
                {r.client_phone}
              </div>
              <div style={css("padding:10px 14px")}>
                {r.overdue ? (
                  <OverdueBadge text={`просрочка ${r.days_overdue} дн.`} />
                ) : (
                  <span style={css("font-size:12px;color:var(--text-2);" + MONO)}>
                    {r.expected_return_date}
                  </span>
                )}
              </div>
              <div
                style={css(
                  "padding:10px 14px;font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                )}
              >
                {r.items.map((i) => `${i.product_name} × ${i.qty}`).join(", ")}
              </div>
            </HButton>
          ))
        )}
      </div>
    </>
  );
}

function MovementBlock({ isDesktop }: { isDesktop: boolean }) {
  const [from, setFrom] = useState(
    lastDays(31).date_from
  );
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState<MovementReport | null>(null);
  const [err, setErr] = useState("");

  const load = () =>
    reportMovement(from, to)
      .then((d) => {
        setData(d);
        setErr("");
      })
      .catch((e) => {
        setData(null);
        setErr(apiError(e, "Не удалось получить движение за период"));
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        style={css(
          "display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px"
        )}
      >
        <label>
          <span
            style={css(
              "display:block;font-size:11.5px;font-weight:500;color:var(--text-2);margin-bottom:5px"
            )}
          >
            С даты
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={css(inputStyle + ";" + MONO)}
          />
        </label>
        <label>
          <span
            style={css(
              "display:block;font-size:11.5px;font-weight:500;color:var(--text-2);margin-bottom:5px"
            )}
          >
            По дату
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={css(inputStyle + ";" + MONO)}
          />
        </label>
        <HButton
          onClick={load}
          s="height:36px;padding:0 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer"
          hover="background:var(--accent-hover)"
        >
          Показать
        </HButton>
      </div>

      <BlockError text={err} />

      {data && (
        <div
          style={{
            ...css("display:grid;gap:12px"),
            gridTemplateColumns: isDesktop ? "repeat(5, 1fr)" : "repeat(2, 1fr)",
          }}
        >
          <StatTile label="Завезено" value={money(data.supplied_qty)} />
          <StatTile label="Списано, ед." value={money(data.written_off_qty)} color="var(--danger)" />
          <StatTile
            label="Удержано, сом"
            value={money(data.written_off_amount)}
            color="var(--danger)"
          />
          <StatTile label="Выдач" value={money(data.issues_count)} />
          <StatTile label="Возвратов" value={money(data.returns_count)} />
        </div>
      )}
    </>
  );
}

function StaffReport() {
  const [from, setFrom] = useState(
    lastDays(31).date_from
  );
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<StaffActivityRow[]>([]);
  const [err, setErr] = useState("");

  const load = () =>
    reportStaffActivity(from, to)
      .then((r) => {
        setRows(r);
        setErr("");
      })
      .catch((e) => setErr(apiError(e, "Не удалось загрузить активность сотрудников")));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ACTION_LABELS: Record<string, string> = {
    create: "брони",
    confirm: "подтв.",
    issue: "выдачи",
    return: "возвраты",
    cancel: "отмены",
    supply: "завозы",
    write_off: "списания",
  };
  const keys = Object.keys(ACTION_LABELS);
  const GRID = `1.4fr repeat(${keys.length}, 1fr)`;

  return (
    <>
      <div
        style={css(
          "display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px"
        )}
      >
        <label>
          <span
            style={css(
              "display:block;font-size:11.5px;font-weight:500;color:var(--text-2);margin-bottom:5px"
            )}
          >
            С даты
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={css(inputStyle + ";" + MONO)}
          />
        </label>
        <label>
          <span
            style={css(
              "display:block;font-size:11.5px;font-weight:500;color:var(--text-2);margin-bottom:5px"
            )}
          >
            По дату
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={css(inputStyle + ";" + MONO)}
          />
        </label>
        <HButton
          onClick={load}
          s="height:36px;padding:0 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer"
          hover="background:var(--accent-hover)"
        >
          Показать
        </HButton>
      </div>

      <BlockError text={err} />

      <div
        style={css(PANEL)}
      >
        <Head
          grid={GRID}
          cols={["Сотрудник", ...keys.map((k) => ACTION_LABELS[k])]}
          rightFrom={1}
        />
        {rows.length === 0 ? (
          <div style={css("padding:40px;text-align:center;color:var(--text-3);font-size:12.5px")}>
            За период операций не было
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={String(r.user_id)}
              style={mix(TROW, {
                gridTemplateColumns: GRID,
              })}
            >
              <div style={css("padding:10px 14px;font-weight:600;font-size:13px;" + MONO)}>
                {r.login}
              </div>
              {keys.map((k) => (
                <div
                  key={k}
                  style={mix(
                    "padding:10px 14px;text-align:right;" + MONO + ";font-size:12.5px",
                    { color: r.actions[k] ? "var(--text)" : "var(--text-5)" }
                  )}
                >
                  {r.actions[k] ?? 0}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function Head({
  grid,
  cols,
  rightFrom,
}: {
  grid: string;
  cols: string[];
  rightFrom?: number;
}) {
  return (
    <div
      style={mix(
        THEAD,
        { gridTemplateColumns: grid }
      )}
    >
      {cols.map((c, i) => (
        <div
          key={c}
          style={mix(
            "padding:9px 14px",
            rightFrom !== undefined && i >= rightFrom ? { textAlign: "right" } : {}
          )}
        >
          {c}
        </div>
      ))}
    </div>
  );
}

function Num({ v }: { v: number }) {
  return (
    <div
      style={css(
        "padding:9px 14px;text-align:right;" + MONO + ";font-size:12.5px;color:var(--text-2)"
      )}
    >
      {money(v)}
    </div>
  );
}

