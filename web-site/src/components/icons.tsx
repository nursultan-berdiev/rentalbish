/** Небольшой набор inline-SVG иконок витрины (без внешних зависимостей). */
import type { CSSProperties } from "react";

type Path = [string, Record<string, unknown>];

export function Svg({
  paths,
  size = 20,
  sw = 1.7,
  style,
}: {
  paths: Path[];
  size?: number;
  sw?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths.map(([tag, attrs], i) =>
        tag === "circle" ? <circle key={i} {...attrs} /> : <path key={i} {...attrs} />
      )}
    </svg>
  );
}

export const I_CART: Path[] = [
  ["circle", { cx: 9, cy: 21, r: 1 }],
  ["circle", { cx: 20, cy: 21, r: 1 }],
  ["path", { d: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" }],
];

export const I_CLOSE: Path[] = [["path", { d: "M18 6 6 18M6 6l12 12" }]];

export const I_CHEVRON: Path[] = [["path", { d: "m6 9 6 6 6-6" }]];

export const I_CHECK: Path[] = [["path", { d: "M20 6 9 17l-5-5" }]];

export const I_ARROW_LEFT: Path[] = [["path", { d: "M19 12H5M12 19l-7-7 7-7" }]];
