/**
 * ИИ-ассистент: плавающая кнопка справа внизу + выезжающая панель.
 * Монтируется один раз в Shell — доступен на всех экранах.
 */
import { useState } from "react";

import { I_SPARK, Svg } from "../../design/icons";
import { HButton } from "../../design/ui";
import AiDrawer from "./AiDrawer";

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <HButton
          onClick={() => setOpen(true)}
          aria-label="Открыть ИИ-ассистента"
          s="position:fixed;right:20px;bottom:20px;z-index:50;width:52px;height:52px;border-radius:50%;border:none;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 24px -6px rgba(62,99,221,.6)"
          hover="background:var(--accent-hover)"
        >
          <Svg paths={I_SPARK} size={22} sw={1.6} />
        </HButton>
      )}
      {open && <AiDrawer onClose={() => setOpen(false)} />}
    </>
  );
}
