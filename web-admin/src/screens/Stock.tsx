/** Остатки: чипы точек, поиск, таблица (десктоп) / карточки (мобайл), завоз и списание. */
import { useEffect, useMemo, useState } from "react";
import { apiError } from "../api/client";
import {
  createSupply,
  createWriteOff,
  listLocations,
  listProducts,
  listStock,
  type Location,
  type Product,
  type StockRow,
} from "../api/domain";
import { MONO, css, mix, money, num } from "../design/css";
import { I_ALERT, I_BOX, I_MINUS, I_PLUS, Svg } from "../design/icons";
import {
  FieldLabel,
  HButton,
  HDiv,
  ModalError,
  ModalShell,
  btnDanger,
  btnGhost,
  btnPrimary,
  chipStyle,
  inputNumStyle,
  inputStyle,
  selectStyle,
} from "../design/ui";
import { EMPTY_ICON, PANEL, Page, PrimaryAction, SearchInput, Toolbar } from "../design/table";
import { matchText } from "../lib/search";


const GRID = "display:grid;grid-template-columns:2fr 1.3fr .8fr 1fr .8fr 1fr 88px;gap:0";

type ModalState =
  | null
  | { type: "zavoz"; product: number; point: number; qty: string; comment: string; error: string }
  | {
      type: "spisanie";
      product: number;
      point: number;
      qty: string;
      reason: string;
      confirm: boolean;
      error: string;
    };

export default function Stock({
  isDesktop,
  toast,
}: {
  isDesktop: boolean;
  toast: (kind: "success" | "error", text: string) => void;
}) {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [point, setPoint] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [booted, setBooted] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const reload = () =>
    listStock()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setBooted(true));

  useEffect(() => {
    reload();
    listLocations().then(setLocations).catch(() => setLocations([]));
    listProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  const items = products.filter((p) => p.type === "item");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => point === "all" || r.location_id === point)
      .filter((r) => !q || matchText(r.product_name, q));
  }, [rows, point, query]);

  const availOf = (productId: number, locationId: number) =>
    rows.find((r) => r.product_id === productId && r.location_id === locationId)?.available ?? 0;

  const defaultPoint = () =>
    point !== "all" ? point : (locations.find((l) => l.is_active)?.id ?? locations[0]?.id ?? 0);

  const openZavoz = (productId?: number, locationId?: number) =>
    setModal({
      type: "zavoz",
      product: productId ?? items[0]?.id ?? 0,
      point: locationId ?? defaultPoint(),
      qty: "",
      comment: "",
      error: "",
    });

  const openSpis = (productId?: number, locationId?: number) =>
    setModal({
      type: "spisanie",
      product: productId ?? items[0]?.id ?? 0,
      point: locationId ?? defaultPoint(),
      qty: "",
      reason: "breakage",
      confirm: false,
      error: "",
    });

  const patch = (p: Partial<NonNullable<ModalState>>) =>
    setModal((m) => (m ? ({ ...m, ...p } as NonNullable<ModalState>) : m));

  async function submitZavoz() {
    if (!modal || modal.type !== "zavoz") return;
    const q = num(modal.qty);
    if (q <= 0) return patch({ error: "Укажите количество больше 0" });
    try {
      await createSupply({ product_id: modal.product, location_id: modal.point, quantity: q });
      const name = products.find((p) => p.id === modal.product)?.name ?? "";
      setModal(null);
      await reload();
      toast("success", `Завезено ${q} «${name}»`);
    } catch (e) {
      patch({ error: apiError(e) });
    }
  }

  function spisanieNext() {
    if (!modal || modal.type !== "spisanie") return;
    const q = num(modal.qty);
    const avail = availOf(modal.product, modal.point);
    if (q <= 0) return patch({ error: "Укажите количество больше 0" });
    if (q > avail)
      return patch({ error: `Недостаточно свободного остатка для списания: доступно ${avail}` });
    patch({ confirm: true, error: "" });
  }

  async function submitSpisanie() {
    if (!modal || modal.type !== "spisanie") return;
    const q = num(modal.qty);
    const p = products.find((x) => x.id === modal.product);
    try {
      await createWriteOff({
        product_id: modal.product,
        location_id: modal.point,
        quantity: q,
        reason: modal.reason,
      });
      const charge = modal.reason === "wear" ? 0 : q * (p?.deposit_price ?? 0);
      setModal(null);
      await reload();
      toast("success", `Списано ${q} «${p?.name ?? ""}». Удержание ${money(charge)} сом`);
    } catch (e) {
      patch({ error: apiError(e), confirm: false });
    }
  }

  const chips: { id: number | "all"; name: string }[] = [
    { id: "all", name: "Все точки" },
    ...locations.map((l) => ({ id: l.id as number | "all", name: l.name })),
  ];

  return (
    <Page>
      {/* toolbar */}
      <Toolbar
        left={
          <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
            {chips.map((c) => (
              <HButton
                key={String(c.id)}
                onClick={() => setPoint(c.id)}
                s={chipStyle(point === c.id)}
                hover="border-color:var(--border-strong)"
              >
                {c.name}
              </HButton>
            ))}
          </div>
        }
        search={
          <SearchInput value={query} onChange={setQuery} placeholder="Поиск товара…" />
        }
        actions={
          <>
            <PrimaryAction onClick={() => openZavoz()}>Завоз</PrimaryAction>
            <HButton
              onClick={() => openSpis()}
              s="height:34px;padding:0 13px;background:var(--surface);color:var(--danger);border:1px solid var(--danger-border);border-radius:8px;font-size:12.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;flex:none"
              hover="background:var(--danger-tint2)"
            >
              <Svg paths={I_ALERT} size={15} />
              Списание
            </HButton>
          </>
        }
      />

      {isDesktop ? (
        <div
          style={css(PANEL)}
        >
          <div
            style={css(
              GRID +
                ";background:var(--surface-2);border-bottom:1px solid var(--border);font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3)"
            )}
          >
            <div style={css("padding:9px 14px")}>Товар</div>
            <div style={css("padding:9px 14px")}>Точка</div>
            <div style={css("padding:9px 14px;text-align:right")}>Всего</div>
            <div style={css("padding:9px 14px;text-align:right")}>Бронь</div>
            <div style={css("padding:9px 14px;text-align:right")}>Выдано</div>
            <div style={css("padding:9px 14px;text-align:right")}>Доступно</div>
            <div style={css("padding:9px 14px")} />
          </div>

          {!booted && <StockSkeleton />}

          {booted && visible.length > 0 && (
            <>
              {visible.map((r) => {
                const level = r.available <= 0 ? "zero" : r.available <= 10 ? "crit" : "ok";
                const availColor =
                  level === "zero" ? "var(--danger)" : level === "crit" ? "var(--amber)" : "var(--text)";
                const availBg =
                  level === "zero"
                    ? "var(--danger-tint)"
                    : level === "crit"
                      ? "var(--amber-tint)"
                      : "transparent";
                const dotColor =
                  level === "zero"
                    ? "var(--danger-dot)"
                    : level === "crit"
                      ? "var(--amber-dot)"
                      : "var(--green-dot)";
                return (
                  <HDiv
                    key={`${r.product_id}-${r.location_id}`}
                    s={GRID + ";border-bottom:1px solid var(--hover);align-items:center"}
                    hover="background:var(--surface-2)"
                  >
                    <div style={css("padding:9px 14px;min-width:0")}>
                      <div
                        style={css(
                          "font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                        )}
                      >
                        {r.product_name}
                      </div>
                      <div style={css("font-size:11px;color:var(--text-4)")}>
                        {r.product_category}
                      </div>
                    </div>
                    <div
                      style={css(
                        "padding:9px 14px;font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                      )}
                    >
                      {r.location_name}
                    </div>
                    <Num v={r.total_qty} />
                    <Num v={r.reserved_qty} />
                    <Num v={r.issued_qty} />
                    <div style={css("padding:9px 14px;text-align:right")}>
                      <span
                        style={mix(
                          "display:inline-flex;align-items:center;gap:6px;" + MONO + ";font-size:13.5px;font-weight:600;padding:2px 8px;border-radius:6px",
                          { color: availColor, background: availBg }
                        )}
                      >
                        <span
                          style={mix("width:6px;height:6px;border-radius:50%", {
                            background: dotColor,
                          })}
                        />
                        {money(r.available)}
                      </span>
                    </div>
                    <div
                      style={css("padding:7px 12px;display:flex;gap:4px;justify-content:flex-end")}
                    >
                      <HButton
                        title="Завоз"
                        onClick={() => openZavoz(r.product_id, r.location_id)}
                        s="width:26px;height:26px;border:1px solid var(--border);background:var(--surface);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2)"
                        hover="border-color:var(--accent);color:var(--accent)"
                      >
                        <Svg paths={I_PLUS} size={14} sw={2} />
                      </HButton>
                      <HButton
                        title="Списание"
                        onClick={() => openSpis(r.product_id, r.location_id)}
                        s="width:26px;height:26px;border:1px solid var(--border);background:var(--surface);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--danger)"
                        hover="border-color:var(--danger-border);background:var(--danger-tint2)"
                      >
                        <Svg paths={I_MINUS} size={14} sw={2} />
                      </HButton>
                    </div>
                  </HDiv>
                );
              })}
            </>
          )}

          {booted && visible.length === 0 && <EmptyStock />}
        </div>
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:10px")}>
          {visible.map((r) => {
            const level = r.available <= 0 ? "zero" : r.available <= 10 ? "crit" : "ok";
            const availColor =
              level === "zero" ? "var(--danger)" : level === "crit" ? "var(--amber)" : "var(--text)";
            const availBg =
              level === "zero"
                ? "var(--danger-tint)"
                : level === "crit"
                  ? "var(--amber-tint)"
                  : "transparent";
            const dotColor =
              level === "zero"
                ? "var(--danger-dot)"
                : level === "crit"
                  ? "var(--amber-dot)"
                  : "var(--green-dot)";
            return (
              <div
                key={`${r.product_id}-${r.location_id}`}
                style={css(
                  "background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px"
                )}
              >
                <div
                  style={css(
                    "display:flex;justify-content:space-between;gap:10px;align-items:flex-start"
                  )}
                >
                  <div style={css("min-width:0")}>
                    <div style={css("font-weight:600;font-size:13.5px")}>{r.product_name}</div>
                    <div style={css("font-size:11.5px;color:var(--text-3);margin-top:1px")}>
                      {r.location_name}
                    </div>
                  </div>
                  <span
                    style={mix(
                      "flex:none;display:inline-flex;align-items:center;gap:6px;" + MONO + ";font-size:15px;font-weight:600;padding:3px 10px;border-radius:8px",
                      { color: availColor, background: availBg }
                    )}
                  >
                    <span
                      style={mix("width:6px;height:6px;border-radius:50%", { background: dotColor })}
                    />
                    {money(r.available)}
                  </span>
                </div>
                <div
                  style={css(
                    "display:flex;gap:16px;margin-top:10px;padding-top:10px;border-top:1px solid var(--hover);font-size:11.5px;color:var(--text-3)"
                  )}
                >
                  <div>
                    Всего <B>{money(r.total_qty)}</B>
                  </div>
                  <div>
                    Бронь <B>{money(r.reserved_qty)}</B>
                  </div>
                  <div>
                    Выдано <B>{money(r.issued_qty)}</B>
                  </div>
                  <div style={css("margin-left:auto;display:flex;gap:6px")}>
                    <HButton
                      onClick={() => openZavoz(r.product_id, r.location_id)}
                      s="width:30px;height:30px;border:1px solid var(--border);background:var(--surface);border-radius:7px;color:var(--accent);display:flex;align-items:center;justify-content:center"
                    >
                      <Svg paths={I_PLUS} size={15} sw={2} />
                    </HButton>
                    <HButton
                      onClick={() => openSpis(r.product_id, r.location_id)}
                      s="width:30px;height:30px;border:1px solid var(--danger-border);background:var(--surface);border-radius:7px;color:var(--danger);display:flex;align-items:center;justify-content:center"
                    >
                      <Svg paths={I_MINUS} size={15} sw={2} />
                    </HButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={css("margin-top:10px;font-size:11px;color:var(--text-4)")}>
        Доступно = Всего − Бронь − Выдано · валюта — сом (KGS)
      </div>

      {/* ---- Завоз ---- */}
      {modal?.type === "zavoz" && (
        <ModalShell
          title="Завоз (приход)"
          icon={<Svg paths={I_PLUS} size={16} sw={2} />}
          onClose={() => setModal(null)}
          width={440}
          footer={
            <>
              <HButton onClick={() => setModal(null)} s={btnGhost} hover="background:var(--hover)">
                Отмена
              </HButton>
              <HButton onClick={submitZavoz} s={btnPrimary} hover="background:var(--accent-hover)">
                Завезти
              </HButton>
            </>
          }
        >
          <div style={css("padding:18px;display:flex;flex-direction:column;gap:14px")}>
            <label style={css("display:block")}>
              <FieldLabel>Товар</FieldLabel>
              <select
                value={modal.product}
                onChange={(e) => patch({ product: Number(e.target.value) })}
                style={css(selectStyle)}
              >
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={css("display:block")}>
              <FieldLabel>Точка</FieldLabel>
              <select
                value={modal.point}
                onChange={(e) => patch({ point: Number(e.target.value) })}
                style={css(selectStyle)}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={css("display:block")}>
              <FieldLabel>Количество</FieldLabel>
              <input
                value={modal.qty}
                onChange={(e) => patch({ qty: e.target.value, error: "" })}
                inputMode="numeric"
                placeholder="0"
                style={css(inputNumStyle)}
              />
            </label>
            <label style={css("display:block")}>
              <FieldLabel>
                Комментарий{" "}
                <span style={css("color:var(--text-5);font-weight:400")}>— необязательно</span>
              </FieldLabel>
              <input
                value={modal.comment}
                onChange={(e) => patch({ comment: e.target.value })}
                placeholder="Напр.: поставка от 12.07"
                style={css(inputStyle)}
              />
            </label>
            <ModalError text={modal.error} />
          </div>
        </ModalShell>
      )}

      {/* ---- Списание ---- */}
      {modal?.type === "spisanie" && (
        <SpisanieModal
          modal={modal}
          items={items}
          locations={locations}
          avail={availOf(modal.product, modal.point)}
          products={products}
          onPatch={patch}
          onClose={() => setModal(null)}
          onNext={spisanieNext}
          onSubmit={submitSpisanie}
        />
      )}
    </Page>
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

function B({ children }: { children: React.ReactNode }) {
  return (
    <b
      style={css(
        MONO + ";color:var(--text-2);font-weight:600"
      )}
    >
      {children}
    </b>
  );
}

function StockSkeleton() {
  const bar =
    "height:11px;width:60%;border-radius:4px;background:linear-gradient(90deg,var(--border-2) 25%,var(--bg) 37%,var(--border-2) 63%);background-size:640px 100%;animation:shimmer 1.2s infinite";
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={css(GRID + ";border-bottom:1px solid var(--hover);align-items:center;height:44px")}
        >
          <div style={css("padding:0 14px")}>
            <div style={css(bar.replace("width:60%", "width:70%"))} />
          </div>
          <div style={css("padding:0 14px")}>
            <div style={css(bar)} />
          </div>
          {[1, 2, 3].map((k) => (
            <div key={k} style={css("padding:0 14px")}>
              <div style={css(bar + ";margin-left:auto")} />
            </div>
          ))}
          <div style={css("padding:0 14px")}>
            <div
              style={css(
                "height:14px;width:70%;margin-left:auto;border-radius:5px;background:linear-gradient(90deg,var(--border-2) 25%,var(--bg) 37%,var(--border-2) 63%);background-size:640px 100%;animation:shimmer 1.2s infinite"
              )}
            />
          </div>
          <div />
        </div>
      ))}
    </>
  );
}

function EmptyStock() {
  return (
    <div style={css("padding:50px 20px;text-align:center;color:var(--text-3)")}>
      <div
        style={css(EMPTY_ICON)}
      >
        <Svg paths={I_BOX} size={24} sw={1.6} />
      </div>
      <div style={css("font-size:13.5px;font-weight:500;color:var(--text-2)")}>Ничего не найдено</div>
      <div style={css("font-size:12px;margin-top:3px")}>Измените точку или поисковый запрос</div>
    </div>
  );
}

const REASONS: Record<string, string> = { breakage: "Бой", loss: "Утеря", wear: "Износ" };

function SpisanieModal({
  modal,
  items,
  locations,
  products,
  avail,
  onPatch,
  onClose,
  onNext,
  onSubmit,
}: {
  modal: Extract<NonNullable<ModalState>, { type: "spisanie" }>;
  items: Product[];
  locations: Location[];
  products: Product[];
  avail: number;
  onPatch: (p: Partial<NonNullable<ModalState>>) => void;
  onClose: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const p = products.find((x) => x.id === modal.product);
  const q = num(modal.qty);
  const charge = modal.reason === "wear" ? 0 : q * (p?.deposit_price ?? 0);
  const pointName = locations.find((l) => l.id === modal.point)?.name ?? "";

  return (
    <ModalShell
      title="Списание со склада"
      tone="danger"
      icon={<Svg paths={I_ALERT} size={16} />}
      onClose={onClose}
      width={460}
      footer={
        modal.confirm ? (
          <>
            <HButton
              onClick={() => onPatch({ confirm: false })}
              s={btnGhost}
              hover="background:var(--hover)"
            >
              Назад
            </HButton>
            <HButton onClick={onSubmit} s={btnDanger} hover="background:var(--danger-solid-hover)">
              Списать
            </HButton>
          </>
        ) : (
          <>
            <HButton onClick={onClose} s={btnGhost} hover="background:var(--hover)">
              Отмена
            </HButton>
            <HButton onClick={onNext} s={btnDanger} hover="background:var(--danger-solid-hover)">
              Продолжить
            </HButton>
          </>
        )
      }
    >
      {!modal.confirm ? (
        <div style={css("padding:18px;display:flex;flex-direction:column;gap:14px")}>
          <label style={css("display:block")}>
            <FieldLabel>Товар</FieldLabel>
            <select
              value={modal.product}
              onChange={(e) => onPatch({ product: Number(e.target.value), error: "" })}
              style={css(selectStyle)}
            >
              {items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <div style={css("display:flex;gap:12px")}>
            <label style={css("flex:1")}>
              <FieldLabel>Точка</FieldLabel>
              <select
                value={modal.point}
                onChange={(e) => onPatch({ point: Number(e.target.value), error: "" })}
                style={css(selectStyle)}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={css("width:120px")}>
              <FieldLabel>Кол-во</FieldLabel>
              <input
                value={modal.qty}
                onChange={(e) => onPatch({ qty: e.target.value, error: "" })}
                inputMode="numeric"
                placeholder="0"
                style={css(inputNumStyle)}
              />
            </label>
          </div>
          <label style={css("display:block")}>
            <FieldLabel>Причина</FieldLabel>
            <select
              value={modal.reason}
              onChange={(e) => onPatch({ reason: e.target.value })}
              style={css(selectStyle)}
            >
              <option value="breakage">Бой</option>
              <option value="loss">Утеря</option>
              <option value="wear">Износ</option>
            </select>
          </label>
          <div
            style={css(
              "display:flex;justify-content:space-between;font-size:12px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:8px;padding:10px 12px"
            )}
          >
            <span style={css("color:var(--text-2)")}>Свободно на точке</span>
            <span style={css(MONO + ";font-weight:600")}>
              {money(avail)}
            </span>
          </div>
          <ModalError text={modal.error} />
        </div>
      ) : (
        <div style={css("padding:18px")}>
          <div
            style={css(
              "background:var(--danger-tint2);border:1px solid var(--danger-border);border-radius:10px;padding:14px 15px"
            )}
          >
            <div style={css("display:flex;gap:9px;align-items:flex-start")}>
              <span style={css("color:var(--danger);display:flex;flex:none;margin-top:1px")}>
                <Svg paths={I_ALERT} size={18} sw={1.9} />
              </span>
              <div>
                <div style={css("font-size:13px;font-weight:600;margin-bottom:6px")}>
                  Подтвердите списание
                </div>
                <div style={css("font-size:12.5px;color:var(--text-2);line-height:1.6")}>
                  Списать <b>{money(q)}</b> × «{p?.name}» с точки «{pointName}».
                  <br />
                  Причина: {REASONS[modal.reason]}. Удержание:{" "}
                  <b style={css(MONO)}>{money(charge)} сом</b>.
                  <br />
                  Действие необратимо — остаток уменьшится.
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <ModalError text={modal.error} />
          </div>
        </div>
      )}
    </ModalShell>
  );
}
