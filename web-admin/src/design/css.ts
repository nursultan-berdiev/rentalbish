/**
 * Утилиты дизайн-слоя.
 *
 * В макете все стили заданы инлайн CSS-строками. Чтобы переносить их дословно
 * (а не переписывать вручную в camelCase и не потерять значения), парсим строку
 * в объект React.CSSProperties. Результат кэшируется — строки статические.
 */
import { useMemo, useState, type CSSProperties } from "react";

const cache = new Map<string, CSSProperties>();

function toCamel(prop: string): string {
  if (prop.startsWith("--")) return prop; // CSS-переменные оставляем как есть
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Разобрать инлайн-CSS («display:flex;gap:8px») в объект стилей React. */
export function css(text: string): CSSProperties {
  const hit = cache.get(text);
  if (hit) return hit;

  const out: Record<string, string> = {};
  for (const chunk of text.split(";")) {
    const i = chunk.indexOf(":");
    if (i < 0) continue;
    const prop = chunk.slice(0, i).trim();
    const value = chunk.slice(i + 1).trim();
    if (!prop || !value) continue;
    out[toCamel(prop)] = value;
  }
  const style = out as CSSProperties;
  cache.set(text, style);
  return style;
}

/** Склеить несколько CSS-строк/объектов в один стиль. */
export function mix(...parts: (string | CSSProperties | false | null | undefined)[]): CSSProperties {
  const out: Record<string, unknown> = {};
  for (const p of parts) {
    if (!p) continue;
    Object.assign(out, typeof p === "string" ? css(p) : p);
  }
  return out as CSSProperties;
}

/**
 * Ховер-стиль (в макете — атрибут style-hover).
 * Возвращает пропсы, которые нужно разложить в элемент.
 */
export function useHover(base: CSSProperties, hover: string | CSSProperties) {
  const [on, setOn] = useState(false);
  const hoverStyle = useMemo(() => (typeof hover === "string" ? css(hover) : hover), [hover]);
  return {
    style: on ? { ...base, ...hoverStyle } : base,
    onMouseEnter: () => setOn(true),
    onMouseLeave: () => setOn(false),
  };
}

/** Моноширинный шрифт для чисел. Живёт здесь, а не в table.tsx: он нужен и ui, и графикам. */
export const MONO = "font-family:'IBM Plex Mono',monospace";

/** Числовой формат как в макете: 1 620 (ru-RU). Деньги — не мельче копейки. */
export function money(n: number): string {
  return (n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

/** Дата в формате API (YYYY-MM-DD). */
export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Сегодня / сегодня ± N дней в формате API. Раньше это считали руками в шести местах. */
export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return iso(d);
}

/** Диапазон «последние N дней, включая сегодня» — для фильтров отчётов и дашборда. */
export function lastDays(n: number): { date_from: string; date_to: string } {
  return { date_from: todayISO(-(n - 1)), date_to: todayISO() };
}

/** Дата → «08.07». */
export function dm(s: string): string {
  const d = new Date(s);
  return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0");
}

/** Число суток аренды: округление вверх, минимум 1 (правило из ФТ). */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

export function num(v: string | number): number {
  const n = parseInt(String(v), 10);
  return isNaN(n) ? 0 : n;
}
