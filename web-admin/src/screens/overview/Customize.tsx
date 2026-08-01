/**
 * Настройка дашборда для админа: показать/скрыть блок, переставить, удалить добавленный.
 * Создавать блоки отсюда нельзя — это делает ИИ-ассистент; здесь только раскладка.
 */
import { useEffect, useState } from "react";

import { apiError } from "../../api/client";
import {
  deleteDashboardWidget,
  listDashboardWidgets,
  patchDashboardWidget,
  type WidgetRow,
} from "../../api/domain";
import { css, mix } from "../../design/css";
import { I_SLIDERS, Svg } from "../../design/icons";
import { HButton, ModalError, ModalShell, btnGhost } from "../../design/ui";


export default function Customize({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<WidgetRow[]>([]);
  const [error, setError] = useState("");

  const load = () =>
    listDashboardWidgets()
      .then(setRows)
      .catch((e) => setError(apiError(e, "Не удалось загрузить список блоков")));

  useEffect(() => {
    load();
  }, []);

  async function act(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      setError(apiError(e, "Не удалось изменить блок"));
    }
  }

  // Перестановка — обменом позиций с соседом: без drag-n-drop, зато предсказуемо.
  async function move(index: number, dir: -1 | 1) {
    const a = rows[index];
    const b = rows[index + dir];
    if (!a || !b) return;
    await act(async () => {
      await patchDashboardWidget(a.id, { position: b.position });
      await patchDashboardWidget(b.id, { position: a.position });
    });
  }

  return (
    <ModalShell
      title="Настройка дашборда"
      icon={<Svg paths={I_SLIDERS} size={15} sw={1.7} />}
      onClose={onClose}
      width={560}
      footer={
        <HButton onClick={onClose} s={btnGhost} hover="border-color:var(--accent)">
          Готово
        </HButton>
      }
    >
      {error && <ModalError text={error} />}
      <div style={css("font-size:12px;color:var(--text-3);margin-bottom:10px;line-height:1.5")}>
        Встроенные блоки можно скрыть и переставить, но не удалить. Новые блоки добавляет
        ИИ-ассистент внизу экрана — попросите его словами.
      </div>

      <div style={css("display:flex;flex-direction:column;gap:6px")}>
        {rows.map((w, i) => (
          <div
            key={w.id}
            style={css(
              "display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2)"
            )}
          >
            <label
              title={w.is_visible ? "Показан на дашборде — снимите, чтобы скрыть" : "Скрыт — отметьте, чтобы показать"}
              style={css(
                "display:flex;align-items:center;gap:6px;cursor:pointer;flex:none;min-width:78px"
              )}
            >
              <input
                type="checkbox"
                checked={w.is_visible}
                onChange={(e) =>
                  act(() => patchDashboardWidget(w.id, { is_visible: e.target.checked }))
                }
                style={css("width:15px;height:15px;accent-color:var(--accent);cursor:pointer")}
              />
              <span
                style={mix("font-size:11.5px;font-weight:500", {
                  color: w.is_visible ? "var(--text-2)" : "var(--text-4)",
                })}
              >
                {w.is_visible ? "Показан" : "Скрыт"}
              </span>
            </label>
            <div style={css("flex:1;min-width:0")}>
              <div style={css("font-size:13px;font-weight:500")}>{w.title}</div>
              <div style={css("font-size:11px;color:var(--text-4);margin-top:1px")}>
                {w.chart}
                {w.is_builtin ? " · встроенный" : " · добавлен ИИ"}
              </div>
            </div>

            <HButton
              onClick={() => move(i, -1)}
              s={`${btnGhost};padding:3px 8px;font-size:13px;${i === 0 ? "opacity:.35" : ""}`}
              hover="border-color:var(--accent);color:var(--accent)"
            >
              ↑
            </HButton>
            <HButton
              onClick={() => move(i, 1)}
              s={`${btnGhost};padding:3px 8px;font-size:13px;${i === rows.length - 1 ? "opacity:.35" : ""}`}
              hover="border-color:var(--accent);color:var(--accent)"
            >
              ↓
            </HButton>
            {!w.is_builtin && (
              <HButton
                onClick={() => act(() => deleteDashboardWidget(w.id))}
                s="border:1px solid var(--danger-border);background:transparent;color:var(--danger);border-radius:7px;padding:3px 9px;font-size:11.5px;cursor:pointer"
                hover="background:var(--danger-tint)"
              >
                Удалить
              </HButton>
            )}
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
