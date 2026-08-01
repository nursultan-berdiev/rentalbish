/** Журнал аудита: кто, что сделал, над чем и когда. Только администратор. */
import { useEffect, useState } from "react";
import { listAudit, listUsers, type AuditEntry, type User } from "../api/domain";
import { css, mix } from "../design/css";
import { Icon } from "../design/icons";
import { EMPTY_ICON, MONO, PANEL, Page, THEAD, TROW, Toolbar } from "../design/table";
import { HButton, chipStyle } from "../design/ui";

const GRID = "150px 1.1fr 1.2fr 1fr 2fr";

const ACTIONS: Record<string, { label: string; color: string; bg: string }> = {
  create: { label: "Создание брони", color: "var(--accent-strong)", bg: "var(--accent-tint)" },
  confirm: { label: "Подтверждение", color: "var(--accent-strong)", bg: "var(--accent-tint)" },
  issue: { label: "Выдача", color: "var(--amber)", bg: "var(--amber-tint)" },
  return: { label: "Возврат", color: "var(--violet)", bg: "var(--violet-tint)" },
  cancel: { label: "Отмена", color: "var(--muted-fg)", bg: "var(--muted-bg2)" },
  supply: { label: "Завоз", color: "var(--green)", bg: "var(--green-tint)" },
  write_off: { label: "Списание", color: "var(--danger)", bg: "var(--danger-tint)" },
};

const ENTITIES: Record<string, string> = { booking: "Бронь", product: "Товар" };

function fmt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Audit() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [action, setAction] = useState<"all" | string>("all");

  useEffect(() => {
    listAudit({ limit: 200 }).then(setRows).catch(() => setRows([]));
    listUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const login = (id: number | null) => users.find((u) => u.id === id)?.login ?? "—";
  const visible = rows.filter((r) => action === "all" || r.action === action);

  const chips = ["all", ...Object.keys(ACTIONS)];

  return (
    <Page size="wide">
      <Toolbar
        left={
          <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
            {chips.map((k) => (
              <HButton
                key={k}
                onClick={() => setAction(k)}
                s={chipStyle(action === k)}
                hover="border-color:var(--border-strong)"
              >
                {k === "all" ? "Все операции" : ACTIONS[k].label}
              </HButton>
            ))}
          </div>
        }
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
          <div style={css("padding:9px 14px")}>Когда</div>
          <div style={css("padding:9px 14px")}>Сотрудник</div>
          <div style={css("padding:9px 14px")}>Операция</div>
          <div style={css("padding:9px 14px")}>Объект</div>
          <div style={css("padding:9px 14px")}>Детали</div>
        </div>

        {visible.length === 0 ? (
          <div style={css("padding:50px 20px;text-align:center;color:var(--text-3)")}>
            <div style={css(EMPTY_ICON)}>
              <Icon name="audit" size={24} />
            </div>
            <div style={css("font-size:13.5px;font-weight:500;color:var(--text-2)")}>
              Записей нет
            </div>
            <div style={css("font-size:12px;margin-top:3px")}>
              Здесь фиксируются выдачи, возвраты, бой, завозы и брони
            </div>
          </div>
        ) : (
          visible.map((r) => {
            const a = ACTIONS[r.action] ?? {
              label: r.action,
              color: "var(--text-2)",
              bg: "var(--muted-bg)",
            };
            return (
              <div
                key={r.id}
                style={mix(TROW, {
                  gridTemplateColumns: GRID,
                })}
              >
                <div
                  style={css("padding:9px 14px;" + MONO + ";font-size:12px;color:var(--text-3)")}
                >
                  {fmt(r.created_at)}
                </div>
                <div style={css("padding:9px 14px;font-size:12.5px;font-weight:500;" + MONO)}>
                  {login(r.user_id)}
                </div>
                <div style={css("padding:9px 14px")}>
                  <span
                    style={mix(
                      "display:inline-flex;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:20px",
                      { color: a.color, background: a.bg }
                    )}
                  >
                    {a.label}
                  </span>
                </div>
                <div style={css("padding:9px 14px;font-size:12.5px;color:var(--text-2)")}>
                  {ENTITIES[r.entity] ?? r.entity}
                  {r.entity_id ? ` №${r.entity_id}` : ""}
                </div>
                <div
                  style={css(
                    "padding:9px 14px;font-size:11.5px;color:var(--text-3);" +
                      MONO +
                      ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                  )}
                  title={r.new_value ?? ""}
                >
                  {r.new_value ?? "—"}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Page>
  );
}
