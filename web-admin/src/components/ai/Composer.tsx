/** Ввод сообщения: авторастущая textarea (Enter — отправить, Shift+Enter — перенос). */
import { useEffect, useRef } from "react";

import { css } from "../../design/css";
import { I_SEND, Svg } from "../../design/icons";
import { HButton } from "../../design/ui";

export default function Composer({
  value,
  onChange,
  onSend,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Авто-высота: сбрасываем и подгоняем под содержимое (до 6 строк).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [value]);

  return (
    <div style={css("display:flex;gap:8px;align-items:flex-end")}>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        rows={1}
        placeholder="Спросите про склад…"
        aria-label="Сообщение ассистенту"
        style={css(
          "flex:1;resize:none;max-height:132px;padding:10px 12px;border:1px solid var(--border-strong);border-radius:10px;background:var(--surface);color:var(--text);font-family:inherit;font-size:12.5px;line-height:1.45;outline:none"
        )}
      />
      <HButton
        onClick={onSend}
        disabled={busy || !value.trim()}
        aria-label="Отправить"
        s="flex:none;width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:var(--accent);color:#fff;border:none;border-radius:10px;cursor:pointer"
        hover="background:var(--accent-hover)"
      >
        <Svg paths={I_SEND} size={16} sw={1.8} />
      </HButton>
    </div>
  );
}
