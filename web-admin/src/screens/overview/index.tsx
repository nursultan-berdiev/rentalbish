/**
 * Обзор — аналитический дашборд.
 *
 * Экран ничего не знает о том, какие на нём блоки: сервер отдаёт список виджетов
 * со спецификациями и данными, а WidgetRenderer их рисует. Поэтому блок, который
 * ИИ-ассистент добавил внизу этой же страницы, появляется здесь сам.
 *
 * Сверху — «задачи дня» (просрочки, на руках, заявки, нули на складе). Это состояние
 * «сейчас», а не аналитика за период, поэтому оно не зависит от выбранного диапазона.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiError } from "../../api/client";
import {
  getDashboard,
  listLocations,
  type Dashboard,
  type DashboardNow,
  type Location,
} from "../../api/domain";
import { MONO, css, iso, lastDays, todayISO } from "../../design/css";
import { I_SLIDERS, Svg } from "../../design/icons";
import { PANEL, Page } from "../../design/table";
import { HButton, SkeletonRows, chipStyle, selectStyle } from "../../design/ui";
import { on } from "../../lib/events";
import Customize from "./Customize";
import Overdue from "./Overdue";
import WidgetRenderer from "./WidgetRenderer";


type PeriodKey = "7" | "30" | "90" | "month";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7", label: "7 дней" },
  { key: "30", label: "30 дней" },
  { key: "90", label: "90 дней" },
  { key: "month", label: "Этот месяц" },
];

function rangeOf(key: PeriodKey): { date_from: string; date_to: string } {
  if (key === "month") {
    const now = new Date();
    return { date_from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), date_to: todayISO() };
  }
  return lastDays(Number(key));
}

export default function Overview({ isDesktop, isAdmin }: { isDesktop: boolean; isAdmin: boolean }) {
  const [period, setPeriod] = useState<PeriodKey>("30");
  const [locationId, setLocationId] = useState<number | "">("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [board, setBoard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [tuning, setTuning] = useState(false);

  useEffect(() => {
    listLocations()
      .then(setLocations)
      .catch(() => setLocations([]));
  }, []);

  const load = useCallback(() => {
    const { date_from, date_to } = rangeOf(period);
    setError("");
    getDashboard({ date_from, date_to, location_id: locationId || undefined })
      .then(setBoard)
      .catch((e) => setError(apiError(e, "Не удалось загрузить аналитику")));
  }, [period, locationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Глобальная ИИ-панель может добавить/убрать блок дашборда — тогда просит
  // перечитать его этим событием (прямого колбэка между ними нет).
  useEffect(() => on("rb:dashboard-changed", load), [load]);

  return (
    // Page даёт разделу те же отступы, что и остальным экранам; wide — потому что
    // дашборду нужна вся ширина, в отличие от списков с их лимитом в 1180px.
    <Page size="wide">
      <div style={css("display:flex;flex-direction:column;gap:14px")}>
        <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:8px")}>
          {PERIODS.map((p) => (
            <HButton
              key={p.key}
              onClick={() => setPeriod(p.key)}
              s={chipStyle(period === p.key)}
              hover="border-color:var(--accent)"
            >
              {p.label}
            </HButton>
          ))}

          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}
            style={{ ...css(selectStyle), width: "auto", height: 30, marginLeft: 4 }}
          >
            <option value="">Все точки</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          {isAdmin && (
            <HButton
              onClick={() => setTuning(true)}
              s="margin-left:auto;display:flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text-2);border-radius:16px;font-size:12px;cursor:pointer"
              hover="border-color:var(--accent);color:var(--accent)"
            >
              <Svg paths={I_SLIDERS} size={13} sw={1.7} />
              Настроить
            </HButton>
          )}
        </div>

        {error && (
          <div
            style={css(
              "padding:12px 14px;border:1px solid var(--danger-border);background:var(--danger-tint);color:var(--danger);border-radius:8px;font-size:12.5px"
            )}
          >
            {error}
          </div>
        )}

        {!board && !error && <SkeletonRows rows={5} />}

        {board && (
          <>
            <Today now={board.now} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isDesktop ? "repeat(3, minmax(0, 1fr))" : "1fr",
                gap: 14,
              }}
            >
              {board.widgets.map((w) => (
                <section
                  key={w.id}
                  style={{
                    ...css(
                      PANEL + ";min-width:0"
                    ),
                    gridColumn: isDesktop ? `span ${Math.min(w.span, 3)}` : undefined,
                  }}
                >
                  <div
                    style={css(
                      "padding:12px 16px;border-bottom:1px solid var(--border-2);font-size:13.5px;font-weight:600"
                    )}
                  >
                    {w.title}
                    {!w.is_builtin && (
                      <span
                        style={css(
                          "margin-left:8px;font-size:10px;font-weight:600;color:var(--violet);background:var(--violet-tint);padding:2px 7px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em"
                        )}
                      >
                        от ИИ
                      </span>
                    )}
                  </div>
                  <div style={css("padding:14px 16px")}>
                    <WidgetRenderer widget={w} />
                  </div>
                </section>
              ))}
            </div>

            {/* ИИ-ассистент переехал в глобальную панель (кнопка справа внизу). */}
            <Overdue />
          </>
        )}
      </div>

      {tuning && <Customize onClose={() => setTuning(false)} onChanged={load} />}
    </Page>
  );
}

/** Задачи дня: то, ради чего этот экран открывают утром. */
function Today({ now }: { now: DashboardNow }) {
  const nav = useNavigate();
  const tiles: { label: string; value: number; tone: string; alert?: boolean; to?: string }[] = [
    {
      label: "Просрочки",
      value: now.overdue,
      tone: "var(--danger)",
      alert: now.overdue > 0,
      to: "/bookings",
    },
    { label: "Активные брони", value: now.active_bookings, tone: "var(--accent)", to: "/bookings" },
    { label: "На руках, шт", value: now.on_hands_qty, tone: "var(--violet)" },
    {
      label: "Новые заявки",
      value: now.new_orders,
      tone: "var(--accent)",
      alert: now.new_orders > 0,
      to: "/requests",
    },
    {
      label: "Нулевые остатки",
      value: now.zero_stock,
      tone: "var(--amber)",
      alert: now.zero_stock > 0,
      to: "/stock",
    },
  ];

  return (
    <div style={css("display:flex;flex-wrap:wrap;gap:10px")}>
      {tiles.map((t) => (
        <HButton
          key={t.label}
          onClick={() => t.to && nav(t.to)}
          s={`flex:1;min-width:140px;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:11px 14px;cursor:${t.to ? "pointer" : "default"}`}
          hover={t.to ? "border-color:var(--accent)" : ""}
        >
          <div style={css("font-size:11.5px;color:var(--text-3)")}>{t.label}</div>
          <div
            style={{
              ...css(
                MONO + ";font-size:20px;font-weight:600;margin-top:3px"
              ),
              color: t.alert ? t.tone : "var(--text)",
            }}
          >
            {t.value}
          </div>
        </HButton>
      ))}
    </div>
  );
}
