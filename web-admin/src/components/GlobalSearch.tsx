/**
 * Сквозной поиск в шапке: товары, клиенты и брони одним запросом.
 * Запрос уходит с задержкой (debounce), результаты — выпадающим списком.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { globalSearch, type SearchResults } from "../api/domain";
import { MONO, css, money } from "../design/css";
import { I_SEARCH, Svg } from "../design/icons";
import { HButton, StatusBadge, type BookingStatusKey } from "../design/ui";


const EMPTY: SearchResults = { query: "", products: [], clients: [], bookings: [] };

export default function GlobalSearch() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounce: не дёргаем API на каждую букву.
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setRes(EMPTY);
      return;
    }
    const t = setTimeout(() => {
      globalSearch(term)
        .then((r) => {
          setRes(r);
          setOpen(true);
        })
        .catch(() => setRes(EMPTY));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Клик вне — закрыть.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const total = res.products.length + res.clients.length + res.bookings.length;

  function go(path: string) {
    setOpen(false);
    setQ("");
    nav(path);
  }

  return (
    <div ref={boxRef} style={css("position:relative;width:240px")}>
      <span
        style={css(
          "position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text-4);display:flex"
        )}
      >
        <Svg paths={I_SEARCH} size={15} />
      </span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.trim() && setOpen(true)}
        placeholder="Поиск по системе…"
        style={css(
          "width:100%;height:34px;padding:0 10px 0 30px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);font-size:12.5px;outline:none"
        )}
      />

      {open && q.trim() && (
        <div
          style={css(
            "position:absolute;top:40px;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 34px rgba(0,0,0,.16);z-index:40;overflow:hidden;animation:pop .12s ease;max-height:420px;overflow-y:auto;width:340px"
          )}
        >
          {total === 0 ? (
            <div style={css("padding:18px;text-align:center;color:var(--text-4);font-size:12.5px")}>
              Ничего не найдено
            </div>
          ) : (
            <>
              {res.products.length > 0 && (
                <Group title="Товары">
                  {res.products.map((p) => (
                    <Item key={p.id} onClick={() => go("/products")}>
                      <span style={css("font-size:13px;font-weight:500")}>{p.name}</span>
                      <span style={css("font-size:11.5px;color:var(--text-4);" + MONO)}>
                        {money(p.daily_price)} сом/сут
                      </span>
                    </Item>
                  ))}
                </Group>
              )}

              {res.clients.length > 0 && (
                <Group title="Клиенты">
                  {res.clients.map((c) => (
                    <Item key={c.id} onClick={() => go(`/customers/${c.id}`)}>
                      <span style={css("font-size:13px;font-weight:500")}>{c.name}</span>
                      <span style={css("font-size:11.5px;color:var(--text-4);" + MONO)}>
                        {c.phone}
                      </span>
                    </Item>
                  ))}
                </Group>
              )}

              {res.bookings.length > 0 && (
                <Group title="Брони">
                  {res.bookings.map((b) => {
                    return (
                      <Item key={b.id} onClick={() => go(`/bookings/${b.id}`)}>
                        <span style={css("font-size:13px;font-weight:500")}>
                          <span style={css(MONO + ";color:var(--text-3);margin-right:6px")}>
                            №{b.id}
                          </span>
                          {b.client_name}
                        </span>
                        <StatusBadge status={b.status as BookingStatusKey} size="sm" dot={false} />
                      </Item>
                    );
                  })}
                </Group>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={css(
          "padding:7px 12px;background:var(--surface-2);border-bottom:1px solid var(--border-2);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-4)"
        )}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Item({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <HButton
      onClick={onClick}
      s="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border:none;border-bottom:1px solid var(--border-2);background:transparent;cursor:pointer;text-align:left"
      hover="background:var(--accent-tint2)"
    >
      {children}
    </HButton>
  );
}
