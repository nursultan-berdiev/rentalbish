/**
 * Правая выезжающая панель ИИ-ассистента. Держит список чатов, активный чат и
 * ленту сообщений. История — на сервере; последний открытый чат помним в
 * localStorage. После ответа с дашборд-инструментом просим «Обзор» обновиться.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { apiError, apiStatus } from "../../api/client";
import {
  aiChat,
  deleteConversation,
  getConversation,
  listConversations,
  type AiConversation,
} from "../../api/domain";
import { css } from "../../design/css";
import { I_CLOSE, I_PLUS, I_SPARK, I_TRASH, Svg } from "../../design/icons";
import { HButton } from "../../design/ui";
import { emit } from "../../lib/events";
import Composer from "./Composer";
import Markdown from "./Markdown";

const LAST_KEY = "rb_ai_last";
// Инструменты, после которых состав дашборда изменился (актуально для api-пути).
const DASHBOARD_TOOLS = ["analytics_add_widget", "analytics_remove_widget"];
const CHIPS = ["Что просрочено?", "Что сейчас на руках?", "Какие блоки на дашборде?"];

type Msg = { role: "user" | "assistant"; content: string };

function lastId(): number | null {
  try {
    const v = localStorage.getItem(LAST_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
function rememberId(id: number | null) {
  try {
    if (id) localStorage.setItem(LAST_KEY, String(id));
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* приватный режим — просто не помним */
  }
}

export default function AiDrawer({ onClose }: { onClose: () => void }) {
  const [convos, setConvos] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(async () => {
    try {
      setConvos(await listConversations());
    } catch {
      /* список не критичен */
    }
  }, []);

  const openConversation = useCallback(async (id: number) => {
    try {
      const msgs = await getConversation(id);
      setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
      setActiveId(id);
      rememberId(id);
      setShowList(false);
      setError(null);
    } catch {
      setActiveId(null);
      setMessages([]);
    }
  }, []);

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setError(null);
    setShowList(false);
    rememberId(null);
  }

  // При открытии панели — грузим список и последний чат (если он ещё существует).
  useEffect(() => {
    (async () => {
      let list: AiConversation[] = [];
      try {
        list = await listConversations();
      } catch {
        /* ignore */
      }
      setConvos(list);
      const last = lastId();
      if (last && list.some((c) => c.id === last)) openConversation(last);
    })();
  }, [openConversation]);

  // Esc закрывает панель.
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Автопрокрутка ленты вниз.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [messages, busy]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    try {
      const res = await aiChat(q, activeId ?? undefined);
      setActiveId(res.conversation_id);
      rememberId(res.conversation_id);
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      // Через gateway состав used_tools не виден (ответ — только текст), поэтому
      // после любого ответа просим «Обзор» перечитать дашборд: вдруг блок добавили.
      // На api-пути хватило бы проверки used_tools, но лишний дешёвый GET не мешает.
      if (res.used_tools.some((t) => DASHBOARD_TOOLS.includes(t)) || res.used_tools.length === 0)
        emit("rb:dashboard-changed");
      refreshList();
    } catch (e) {
      setMessages((m) => m.slice(0, -1)); // снимаем неотправленный вопрос
      setInput(q); // возвращаем текст для повтора
      setError(
        apiStatus(e) === 503
          ? "ИИ-ассистент временно недоступен."
          : apiError(e, "Не удалось получить ответ.")
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeConversation(id: number) {
    // Спрашиваем подтверждение — чтобы случайный клик по корзине не стёр историю.
    if (!window.confirm("Удалить чат? Переписку нельзя будет восстановить.")) return;
    try {
      await deleteConversation(id);
      if (id === activeId) newChat();
      refreshList();
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={css(
          "position:absolute;inset:0;z-index:90;background:rgba(15,18,25,.36);animation:fadeIn .15s ease"
        )}
      />
      <aside
        role="dialog"
        aria-label="ИИ-ассистент"
        style={css(
          "position:absolute;top:0;right:0;bottom:0;z-index:91;width:min(420px,100vw);" +
            "background:var(--surface);border-left:1px solid var(--border);display:flex;" +
            "flex-direction:column;animation:slideInRight .18s ease"
        )}
      >
        {/* Шапка */}
        <div
          style={css(
            "display:flex;align-items:center;gap:8px;padding:13px 14px;border-bottom:1px solid var(--border-2)"
          )}
        >
          <span style={css("display:flex;color:var(--accent)")}>
            <Svg paths={I_SPARK} size={17} sw={1.6} />
          </span>
          <h3 style={css("margin:0;font-size:14px;font-weight:600;flex:1")}>ИИ-ассистент</h3>
          <HButton
            onClick={() => setShowList((v) => !v)}
            aria-label="История чатов"
            s="height:30px;padding:0 10px;display:flex;align-items:center;gap:6px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text-2);border-radius:8px;font-size:12px;cursor:pointer"
            hover="border-color:var(--accent);color:var(--accent)"
          >
            Чаты {convos.length > 0 && `· ${convos.length}`}
          </HButton>
          <HButton
            onClick={newChat}
            aria-label="Новый чат"
            s="width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border-strong);background:var(--surface);color:var(--text-2);border-radius:8px;cursor:pointer"
            hover="border-color:var(--accent);color:var(--accent)"
          >
            <Svg paths={I_PLUS} size={15} sw={1.8} />
          </HButton>
          <HButton
            onClick={onClose}
            aria-label="Закрыть"
            s="width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--text-3);border-radius:8px;cursor:pointer"
            hover="background:var(--hover);color:var(--text)"
          >
            <Svg paths={I_CLOSE} size={16} sw={1.8} />
          </HButton>
        </div>

        {/* Выпадающий список чатов */}
        {showList && (
          <div
            style={css(
              "max-height:40%;overflow:auto;border-bottom:1px solid var(--border-2);background:var(--surface-2)"
            )}
          >
            {convos.length === 0 && (
              <div style={css("padding:14px;color:var(--text-3);font-size:12px")}>
                Пока нет сохранённых чатов.
              </div>
            )}
            {convos.map((c) => (
              <div
                key={c.id}
                style={css(
                  "display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--border-2)" +
                    (c.id === activeId ? ";background:var(--accent-tint)" : "")
                )}
              >
                <HButton
                  onClick={() => openConversation(c.id)}
                  s="flex:1;text-align:left;border:none;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  hover="color:var(--accent)"
                >
                  {c.title || "Без названия"}
                </HButton>
                <HButton
                  onClick={() => removeConversation(c.id)}
                  aria-label="Удалить чат"
                  s="flex:none;width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--text-4);border-radius:6px;cursor:pointer"
                  hover="color:var(--danger);background:var(--hover)"
                >
                  <Svg paths={I_TRASH} size={14} sw={1.7} />
                </HButton>
              </div>
            ))}
          </div>
        )}

        {/* Лента сообщений */}
        <div
          ref={feedRef}
          style={css("flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px")}
        >
          {messages.length === 0 && !busy && (
            <div style={css("color:var(--text-3);font-size:12.5px;line-height:1.5")}>
              Спросите про остатки, просрочки и долги — посмотрю по складу.
              <div style={css("display:flex;flex-wrap:wrap;gap:6px;margin-top:12px")}>
                {CHIPS.map((c) => (
                  <HButton
                    key={c}
                    onClick={() => send(c)}
                    s="border:1px solid var(--border);background:var(--surface-2);color:var(--text-2);font-size:11.5px;padding:5px 10px;border-radius:14px;cursor:pointer"
                    hover="border-color:var(--accent);color:var(--accent)"
                  >
                    {c}
                  </HButton>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div
                key={i}
                style={css(
                  "align-self:flex-end;max-width:85%;background:var(--accent);color:#fff;padding:8px 12px;border-radius:12px 12px 3px 12px;font-size:12.5px;line-height:1.5;white-space:pre-wrap"
                )}
              >
                {m.content}
              </div>
            ) : (
              <div
                key={i}
                style={css(
                  "align-self:flex-start;max-width:92%;background:var(--surface-2);border:1px solid var(--border-2);padding:9px 12px;border-radius:12px 12px 12px 3px"
                )}
              >
                <Markdown text={m.content} />
              </div>
            )
          )}

          {busy && (
            <div
              style={css(
                "align-self:flex-start;display:flex;align-items:center;gap:8px;color:var(--text-3);font-size:12px;padding:4px 2px"
              )}
            >
              <span style={css("display:inline-flex;gap:3px")}>
                {[0, 0.2, 0.4].map((d) => (
                  <span
                    key={d}
                    style={css(
                      `width:6px;height:6px;border-radius:50%;background:var(--accent);animation:blink 1s infinite ${d}s`
                    )}
                  />
                ))}
              </span>
              Думаю…
            </div>
          )}
        </div>

        {/* Ошибка + ввод */}
        <div style={css("padding:12px 14px;border-top:1px solid var(--border-2)")}>
          {error && (
            <div
              style={css(
                "margin-bottom:8px;font-size:11.5px;color:var(--danger);background:var(--danger-tint);border:1px solid var(--danger-border);border-radius:8px;padding:7px 10px"
              )}
            >
              {error}
            </div>
          )}
          <Composer value={input} onChange={setInput} onSend={() => send()} busy={busy} />
        </div>
      </aside>
    </>
  );
}
