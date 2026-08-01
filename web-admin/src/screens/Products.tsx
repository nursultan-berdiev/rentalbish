/**
 * Товары и комплекты: список, карточка (все поля + состав комплекта),
 * фото (в т.ч. съёмка на камеру телефона) и мастер Excel-импорта.
 */
import { useEffect, useRef, useState } from "react";
import { API_ORIGIN, apiError, downloadFile } from "../api/client";
import {
  commitImport,
  createCategory,
  createProduct,
  deleteProductPhoto,
  listCategories,
  listProducts,
  previewImport,
  setPrimaryPhoto,
  updateProduct,
  uploadProductPhoto,
  type Category,
  type ImportResult,
  type Product,
  type SetComponent,
} from "../api/domain";
import { css, mix, money, num } from "../design/css";
import { I_ALERT, I_CLOSE, I_EXCEL, I_PLUS, Svg } from "../design/icons";
import { MONO, PANEL, Page, PrimaryAction, SearchInput, THEAD, TROW, Toolbar } from "../design/table";
import {
  FieldLabel,
  HButton,
  ModalError,
  ModalShell,
  btnGhost,
  btnPrimary,
  chipStyle,
  inputNumStyle,
  inputStyle,
  selectStyle,
} from "../design/ui";
import { matchText } from "../lib/search";

const I_CAMERA: [string, Record<string, unknown>][] = [
  ["path", { d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" }],
  ["circle", { cx: 12, cy: 13, r: 3 }],
];
const I_UPLOAD: [string, Record<string, unknown>][] = [
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
  ["polyline", { points: "17 8 12 3 7 8" }],
  ["line", { x1: 12, y1: 3, x2: 12, y2: 15 }],
];
const I_STAR: [string, Record<string, unknown>][] = [
  ["path", { d: "m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6L3.2 9.4l6.1-.9z" }],
];
const I_TRASH: [string, Record<string, unknown>][] = [
  ["path", { d: "M3 6h18" }],
  ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
  ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }],
];

const GRID = "56px 2fr 1.2fr .9fr .9fr .9fr 86px";

interface Draft {
  id?: number;
  name: string;
  category_id: number | null;
  sku: string;
  type: "item" | "set";
  unit: string;
  description: string;
  daily_price: string;
  deposit_price: string;
  show_on_site: boolean;
  components: SetComponent[];
}

const emptyDraft = (): Draft => ({
  name: "",
  category_id: null,
  sku: "",
  type: "item",
  unit: "шт",
  description: "",
  daily_price: "0",
  deposit_price: "0",
  show_on_site: false,
  components: [],
});

const toDraft = (p: Product): Draft => ({
  id: p.id,
  name: p.name,
  category_id: p.category_id,
  sku: p.sku ?? "",
  type: p.type,
  unit: p.unit,
  description: p.description,
  daily_price: String(p.daily_price),
  deposit_price: String(p.deposit_price),
  show_on_site: p.show_on_site,
  components: p.components.map((c) => ({ component_id: c.component_id, quantity: c.quantity })),
});

export default function Products({
  isDesktop,
  toast,
}: {
  isDesktop: boolean;
  toast: (k: "success" | "error", t: string) => void;
}) {
  const [rows, setRows] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "item" | "set">("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [photosOf, setPhotosOf] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const reload = () => listProducts().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    reload();
    listCategories().then(setCats).catch(() => setCats([]));
  }, []);

  const visible = rows
    .filter((p) => type === "all" || p.type === type)
    .filter((p) => !query.trim() || matchText(p.name, query.trim()));

  const catName = (id: number | null) => cats.find((c) => c.id === id)?.name ?? "—";
  const primary = (p: Product) => p.photos.find((ph) => ph.is_primary) ?? p.photos[0];

  return (
    <Page>
      <Toolbar
        left={
          <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
            {([
              ["all", "Все"],
              ["item", "Товары"],
              ["set", "Комплекты"],
            ] as const).map(([k, label]) => (
              <HButton
                key={k}
                onClick={() => setType(k)}
                s={chipStyle(type === k)}
                hover="border-color:var(--border-strong)"
              >
                {label}
              </HButton>
            ))}
          </div>
        }
        search={<SearchInput value={query} onChange={setQuery} placeholder="Поиск товара…" />}
        actions={
          <>
            <HButton
              onClick={() => setImportOpen(true)}
              s="height:34px;padding:0 13px;background:var(--surface);color:var(--text-2);border:1px solid var(--border-strong);border-radius:8px;font-size:12.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;flex:none"
              hover="background:var(--hover)"
            >
              <Svg paths={I_EXCEL} size={15} sw={1.7} />
              Excel-импорт
            </HButton>
            <PrimaryAction onClick={() => setEditing(emptyDraft())}>Новый товар</PrimaryAction>
          </>
        }
      />

      {isDesktop ? (
        <div
          style={css(PANEL)}
        >
          <div
            style={mix(
              THEAD,
              { gridTemplateColumns: GRID }
            )}
          >
            <div style={css("padding:9px 14px")}>Фото</div>
            <div style={css("padding:9px 14px")}>Название</div>
            <div style={css("padding:9px 14px")}>Категория</div>
            <div style={css("padding:9px 14px;text-align:right")}>Сутки</div>
            <div style={css("padding:9px 14px;text-align:right")}>Залог</div>
            <div style={css("padding:9px 14px")}>На сайте</div>
            <div style={css("padding:9px 14px")} />
          </div>

          {visible.length === 0 ? (
            <div style={css("padding:50px 20px;text-align:center;color:var(--text-3)")}>
              <div style={css("font-size:13.5px;font-weight:500;color:var(--text-2)")}>
                Товаров не найдено
              </div>
              <div style={css("font-size:12px;margin-top:3px")}>
                Заведите товар вручную или загрузите Excel
              </div>
            </div>
          ) : (
            visible.map((p) => {
              const ph = primary(p);
              return (
                <div
                  key={p.id}
                  style={mix(TROW, {
                    gridTemplateColumns: GRID,
                  })}
                >
                  <div style={css("padding:7px 14px")}>
                    {ph ? (
                      <img
                        src={`${API_ORIGIN}${ph.file_path}`}
                        alt={p.name}
                        style={css(
                          "width:34px;height:34px;object-fit:cover;border-radius:7px;border:1px solid var(--border-2)"
                        )}
                      />
                    ) : (
                      <div
                        style={css(
                          "width:34px;height:34px;border-radius:7px;background:var(--hover);color:var(--text-5);display:flex;align-items:center;justify-content:center"
                        )}
                      >
                        <Svg paths={I_CAMERA} size={15} />
                      </div>
                    )}
                  </div>
                  <div style={css("padding:9px 14px;min-width:0")}>
                    <div style={css("font-weight:500;font-size:13px")}>{p.name}</div>
                    <div style={css("font-size:11px;color:var(--text-4)")}>
                      {p.type === "set" ? "комплект" : p.sku || "без артикула"}
                    </div>
                  </div>
                  <div style={css("padding:9px 14px;font-size:12px;color:var(--text-2)")}>
                    {catName(p.category_id)}
                  </div>
                  <div
                    style={css("padding:9px 14px;text-align:right;" + MONO + ";font-size:12.5px")}
                  >
                    {money(p.daily_price)}
                  </div>
                  <div
                    style={css(
                      "padding:9px 14px;text-align:right;" +
                        MONO +
                        ";font-size:12.5px;color:var(--text-2)"
                    )}
                  >
                    {money(p.deposit_price)}
                  </div>
                  <div style={css("padding:9px 14px")}>
                    {p.show_on_site ? (
                      <span
                        style={css(
                          "display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--green);background:var(--green-tint);padding:2px 8px;border-radius:20px"
                        )}
                      >
                        да
                      </span>
                    ) : (
                      <span style={css("font-size:11.5px;color:var(--text-5)")}>нет</span>
                    )}
                  </div>
                  <div
                    style={css("padding:7px 12px;display:flex;gap:4px;justify-content:flex-end")}
                  >
                    <HButton
                      title="Фото"
                      onClick={() => setPhotosOf(p)}
                      s="width:26px;height:26px;border:1px solid var(--border);background:var(--surface);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2)"
                      hover="border-color:var(--accent);color:var(--accent)"
                    >
                      <Svg paths={I_CAMERA} size={14} />
                    </HButton>
                    <HButton
                      title="Редактировать"
                      onClick={() => setEditing(toDraft(p))}
                      s="width:26px;height:26px;border:1px solid var(--border);background:var(--surface);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:12px"
                      hover="border-color:var(--accent);color:var(--accent)"
                    >
                      ✎
                    </HButton>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:10px")}>
          {visible.map((p) => {
            const ph = primary(p);
            return (
              <div
                key={p.id}
                style={css(
                  "background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;gap:12px;align-items:center"
                )}
              >
                {ph ? (
                  <img
                    src={`${API_ORIGIN}${ph.file_path}`}
                    alt={p.name}
                    style={css("width:44px;height:44px;object-fit:cover;border-radius:8px;flex:none")}
                  />
                ) : (
                  <div
                    style={css(
                      "width:44px;height:44px;border-radius:8px;background:var(--hover);color:var(--text-5);display:flex;align-items:center;justify-content:center;flex:none"
                    )}
                  >
                    <Svg paths={I_CAMERA} size={18} />
                  </div>
                )}
                <div style={css("flex:1;min-width:0")}>
                  <div style={css("font-weight:600;font-size:13.5px")}>{p.name}</div>
                  <div style={css("font-size:11.5px;color:var(--text-3)")}>
                    {money(p.daily_price)} сом/сут · залог {money(p.deposit_price)}
                  </div>
                </div>
                <div style={css("display:flex;gap:6px;flex:none")}>
                  <HButton
                    onClick={() => setPhotosOf(p)}
                    s="width:32px;height:32px;border:1px solid var(--border);background:var(--surface);border-radius:7px;color:var(--accent);display:flex;align-items:center;justify-content:center"
                  >
                    <Svg paths={I_CAMERA} size={15} />
                  </HButton>
                  <HButton
                    onClick={() => setEditing(toDraft(p))}
                    s="width:32px;height:32px;border:1px solid var(--border);background:var(--surface);border-radius:7px;color:var(--text-2);display:flex;align-items:center;justify-content:center"
                  >
                    ✎
                  </HButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ProductForm
          draft={editing}
          cats={cats}
          items={rows.filter((p) => p.type === "item")}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            await reload();
            listCategories().then(setCats);
            toast("success", msg);
          }}
        />
      )}

      {photosOf && (
        <PhotosModal
          product={photosOf}
          onClose={() => setPhotosOf(null)}
          onChanged={async (p) => {
            setPhotosOf(p);
            await reload();
          }}
          toast={toast}
        />
      )}

      {importOpen && (
        <ImportWizard
          onClose={() => setImportOpen(false)}
          onDone={async (created) => {
            setImportOpen(false);
            await reload();
            toast("success", `Импортировано товаров: ${created}`);
          }}
        />
      )}
    </Page>
  );
}

// ---------------- Карточка товара ----------------
function ProductForm({
  draft,
  cats,
  items,
  onClose,
  onSaved,
}: {
  draft: Draft;
  cats: Category[];
  items: Product[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [d, setD] = useState<Draft>(draft);
  const [newCat, setNewCat] = useState("");
  const [error, setError] = useState("");
  const isNew = !d.id;
  const patch = (p: Partial<Draft>) => setD({ ...d, ...p });

  async function save() {
    setError("");
    if (!d.name.trim()) return setError("Укажите название");
    if (d.type === "set" && d.components.some((c) => !c.component_id))
      return setError("В составе комплекта есть незаполненная позиция");
    try {
      let categoryId = d.category_id;
      if (newCat.trim()) {
        const c = await createCategory(newCat.trim());
        categoryId = c.id;
      }
      const body = {
        name: d.name,
        category_id: categoryId,
        sku: d.sku || null,
        unit: d.unit,
        description: d.description,
        daily_price: Number(d.daily_price) || 0,
        deposit_price: Number(d.deposit_price) || 0,
        show_on_site: d.show_on_site,
        components: d.type === "set" ? d.components : [],
      };
      if (isNew) {
        await createProduct({ ...body, type: d.type });
        onSaved(`Товар «${d.name}» создан`);
      } else {
        await updateProduct(d.id!, body);
        onSaved(`Товар «${d.name}» сохранён`);
      }
    } catch (e) {
      setError(apiError(e));
    }
  }

  return (
    <ModalShell
      title={isNew ? "Новый товар" : `Товар «${draft.name}»`}
      icon={<Svg paths={I_PLUS} size={16} sw={2} />}
      onClose={onClose}
      width={620}
      footer={
        <>
          <HButton onClick={onClose} s={btnGhost} hover="background:var(--hover)">
            Отмена
          </HButton>
          <HButton onClick={save} s={btnPrimary} hover="background:var(--accent-hover)">
            {isNew ? "Создать" : "Сохранить"}
          </HButton>
        </>
      }
    >
      <div style={css("padding:18px;display:flex;flex-direction:column;gap:14px")}>
        <label>
          <FieldLabel>Название</FieldLabel>
          <input
            value={d.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Тарелка белая 25 см"
            style={css(inputStyle)}
          />
        </label>

        <div style={css("display:flex;gap:12px;flex-wrap:wrap")}>
          <label style={css("flex:1;min-width:150px")}>
            <FieldLabel>Тип позиции</FieldLabel>
            <select
              value={d.type}
              disabled={!isNew}
              onChange={(e) => patch({ type: e.target.value as "item" | "set" })}
              style={mix(selectStyle, !isNew ? { opacity: 0.6, cursor: "default" } : {})}
            >
              <option value="item">Товар</option>
              <option value="set">Комплект</option>
            </select>
            {!isNew && (
              <div style={css("font-size:10.5px;color:var(--text-4);margin-top:4px")}>
                тип задаётся при создании
              </div>
            )}
          </label>
          <label style={css("flex:1;min-width:150px")}>
            <FieldLabel>Артикул (SKU)</FieldLabel>
            <input
              value={d.sku}
              onChange={(e) => patch({ sku: e.target.value })}
              placeholder="PLT-25"
              style={css(inputStyle + ";" + MONO)}
            />
          </label>
          <label style={css("width:110px")}>
            <FieldLabel>Ед. изм.</FieldLabel>
            <input
              value={d.unit}
              onChange={(e) => patch({ unit: e.target.value })}
              style={css(inputStyle)}
            />
          </label>
        </div>

        <div style={css("display:flex;gap:12px;flex-wrap:wrap")}>
          <label style={css("flex:1;min-width:150px")}>
            <FieldLabel>Суточная цена</FieldLabel>
            <input
              value={d.daily_price}
              inputMode="numeric"
              onChange={(e) => patch({ daily_price: e.target.value })}
              style={css(inputNumStyle)}
            />
          </label>
          <label style={css("flex:1;min-width:150px")}>
            <FieldLabel>Залоговая стоимость</FieldLabel>
            <input
              value={d.deposit_price}
              inputMode="numeric"
              onChange={(e) => patch({ deposit_price: e.target.value })}
              style={css(inputNumStyle)}
            />
            <div style={css("font-size:10.5px;color:var(--text-4);margin-top:4px")}>
              по ней считается удержание за бой
            </div>
          </label>
        </div>

        <div style={css("display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end")}>
          <label style={css("flex:1;min-width:150px")}>
            <FieldLabel>Категория</FieldLabel>
            <select
              value={d.category_id ?? ""}
              onChange={(e) =>
                patch({ category_id: e.target.value ? Number(e.target.value) : null })
              }
              style={css(selectStyle)}
            >
              <option value="">— без категории —</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label style={css("flex:1;min-width:150px")}>
            <FieldLabel>
              Новая категория <span style={css("color:var(--text-5);font-weight:400")}>— необяз.</span>
            </FieldLabel>
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="создать и назначить"
              style={css(inputStyle)}
            />
          </label>
        </div>

        <label>
          <FieldLabel>Описание</FieldLabel>
          <textarea
            value={d.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={2}
            style={css(
              "width:100%;padding:8px 12px;border:1px solid var(--border-strong);border-radius:8px;font-size:13px;outline:none;background:var(--surface);resize:vertical;font-family:inherit"
            )}
          />
        </label>

        <label style={css("display:flex;align-items:center;gap:9px;cursor:pointer")}>
          <input
            type="checkbox"
            checked={d.show_on_site}
            onChange={(e) => patch({ show_on_site: e.target.checked })}
            style={css("width:16px;height:16px;accent-color:var(--accent);cursor:pointer")}
          />
          <span style={css("font-size:13px")}>Показывать на сайте</span>
          <span style={css("font-size:11px;color:var(--text-4)")}>
            (в каталог попадут только товары с фото)
          </span>
        </label>

        {d.type === "set" && (
          <SetBuilder
            items={items.filter((p) => p.id !== d.id)}
            components={d.components}
            onChange={(components) => patch({ components })}
          />
        )}

        <ModalError text={error} />
      </div>
    </ModalShell>
  );
}


function SetBuilder({
  items,
  components,
  onChange,
}: {
  items: Product[];
  components: SetComponent[];
  onChange: (c: SetComponent[]) => void;
}) {
  return (
    <div
      style={css(
        "border-top:1px dashed var(--border);padding-top:12px;display:flex;flex-direction:column;gap:8px"
      )}
    >
      <div
        style={css(
          "font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3)"
        )}
      >
        Состав комплекта
      </div>
      <div style={css("font-size:11.5px;color:var(--text-4);margin-top:-4px")}>
        Доступность набора считается по самому дефицитному компоненту
      </div>

      {components.map((c, i) => (
        <div key={i} style={css("display:flex;gap:8px;align-items:center")}>
          <select
            value={c.component_id || ""}
            onChange={(e) => {
              const next = [...components];
              next[i] = { ...c, component_id: Number(e.target.value) };
              onChange(next);
            }}
            style={mix(selectStyle, { flex: 1 })}
          >
            <option value="">— компонент —</option>
            {items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            value={c.quantity}
            inputMode="numeric"
            onChange={(e) => {
              const next = [...components];
              next[i] = { ...c, quantity: num(e.target.value) };
              onChange(next);
            }}
            style={mix(inputNumStyle, { width: "80px", textAlign: "center" })}
          />
          <span style={css("font-size:11.5px;color:var(--text-4);flex:none")}>на 1 набор</span>
          <HButton
            onClick={() => onChange(components.filter((_, idx) => idx !== i))}
            s="width:28px;height:28px;border:none;background:transparent;border-radius:6px;cursor:pointer;color:var(--text-5);display:flex;align-items:center;justify-content:center;flex:none"
            hover="background:var(--danger-tint2);color:var(--danger)"
          >
            <Svg paths={I_CLOSE} size={15} />
          </HButton>
        </div>
      ))}

      <HButton
        onClick={() => onChange([...components, { component_id: 0, quantity: 1 }])}
        s="align-self:flex-start;height:30px;padding:0 11px;border:1px dashed var(--border-strong);background:transparent;border-radius:8px;font-size:12px;color:var(--accent);cursor:pointer;display:flex;align-items:center;gap:6px"
        hover="border-color:var(--accent);background:var(--accent-tint2)"
      >
        <Svg paths={I_PLUS} size={13} sw={2} />
        Добавить компонент
      </HButton>
    </div>
  );
}

// ---------------- Фото товара ----------------
function PhotosModal({
  product,
  onClose,
  onChanged,
  toast,
}: {
  product: Product;
  onClose: () => void;
  onChanged: (p: Product) => void;
  toast: (k: "success" | "error", t: string) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const p = await uploadProductPhoto(product.id, file);
      onChanged(p);
      toast("success", "Фото добавлено");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title={`Фото · ${product.name}`}
      icon={<Svg paths={I_CAMERA} size={16} />}
      onClose={onClose}
      width={560}
      footer={
        <HButton onClick={onClose} s={btnGhost} hover="background:var(--hover)">
          Готово
        </HButton>
      }
    >
      <div style={css("padding:18px;display:flex;flex-direction:column;gap:14px")}>
        <div style={css("display:flex;gap:9px;flex-wrap:wrap")}>
          {/* capture=environment открывает камеру на телефоне */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <HButton
            onClick={() => cameraRef.current?.click()}
            disabled={busy}
            s="height:36px;padding:0 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:7px"
            hover="background:var(--accent-hover)"
          >
            <Svg paths={I_CAMERA} size={15} />
            Снять на камеру
          </HButton>
          <HButton
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            s="height:36px;padding:0 14px;background:var(--surface);color:var(--text-2);border:1px solid var(--border-strong);border-radius:8px;font-size:12.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:7px"
            hover="background:var(--hover)"
          >
            <Svg paths={I_UPLOAD} size={15} />
            Загрузить файл
          </HButton>
        </div>

        {product.photos.length === 0 ? (
          <div
            style={css(
              "border:1px dashed var(--border);border-radius:9px;padding:26px;text-align:center;color:var(--text-4);font-size:12.5px"
            )}
          >
            Фото пока нет. Товар без фото не показывается на сайте.
          </div>
        ) : (
          <div
            style={css(
              "display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px"
            )}
          >
            {product.photos.map((ph) => (
              <div
                key={ph.id}
                style={mix("position:relative;border-radius:9px;overflow:hidden", {
                  border: ph.is_primary
                    ? "2px solid var(--accent)"
                    : "1px solid var(--border-2)",
                })}
              >
                <img
                  src={`${API_ORIGIN}${ph.file_path}`}
                  alt=""
                  style={css("width:100%;height:96px;object-fit:cover;display:block")}
                />
                {ph.is_primary && (
                  <span
                    style={css(
                      "position:absolute;top:5px;left:5px;background:var(--accent);color:#fff;font-size:10px;font-weight:600;padding:2px 6px;border-radius:5px"
                    )}
                  >
                    главное
                  </span>
                )}
                <div
                  style={css(
                    "position:absolute;bottom:5px;right:5px;display:flex;gap:4px"
                  )}
                >
                  {!ph.is_primary && (
                    <HButton
                      title="Сделать главным"
                      onClick={async () => onChanged(await setPrimaryPhoto(product.id, ph.id))}
                      s="width:26px;height:26px;border:none;background:rgba(255,255,255,.9);border-radius:6px;cursor:pointer;color:#8A6A00;display:flex;align-items:center;justify-content:center"
                    >
                      <Svg paths={I_STAR} size={13} />
                    </HButton>
                  )}
                  <HButton
                    title="Удалить"
                    onClick={async () => onChanged(await deleteProductPhoto(product.id, ph.id))}
                    s="width:26px;height:26px;border:none;background:rgba(255,255,255,.9);border-radius:6px;cursor:pointer;color:#B4342A;display:flex;align-items:center;justify-content:center"
                  >
                    <Svg paths={I_TRASH} size={13} />
                  </HButton>
                </div>
              </div>
            ))}
          </div>
        )}

        <ModalError text={error} />
      </div>
    </ModalShell>
  );
}

// ---------------- Мастер Excel-импорта ----------------
function ImportWizard({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (created: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onPick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setBusy(true);
    setError("");
    try {
      setPreview(await previewImport(f));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file) return;
    setBusy(true);
    try {
      const res = await commitImport(file);
      onDone(res.created ?? 0);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Excel-импорт товаров"
      icon={<Svg paths={I_EXCEL} size={16} sw={1.7} />}
      onClose={onClose}
      width={680}
      footer={
        <>
          <HButton onClick={onClose} s={btnGhost} hover="background:var(--hover)">
            Отмена
          </HButton>
          <HButton
            onClick={commit}
            disabled={!preview || !preview.parsed || busy}
            s={btnPrimary}
            hover="background:var(--accent-hover)"
          >
            {busy ? "…" : `Импортировать (${preview?.parsed ?? 0})`}
          </HButton>
        </>
      }
    >
      <div style={css("padding:18px;display:flex;flex-direction:column;gap:14px")}>
        <div style={css("display:flex;gap:9px;align-items:center;flex-wrap:wrap")}>
          <HButton
            onClick={() =>
              downloadFile("/products/import/template", "Шаблон импорта товаров.xlsx").catch((e) =>
                setError(apiError(e, "Не удалось скачать шаблон"))
              )
            }
            s="height:36px;padding:0 14px;border:1px solid var(--border-strong);border-radius:8px;font-size:12.5px;color:var(--text-2);display:inline-flex;align-items:center;gap:7px;background:var(--surface);cursor:pointer"
            hover="border-color:var(--accent);color:var(--accent)"
          >
            <Svg paths={I_EXCEL} size={15} sw={1.7} />
            Скачать шаблон
          </HButton>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <HButton
            onClick={() => fileRef.current?.click()}
            s="height:36px;padding:0 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:7px"
            hover="background:var(--accent-hover)"
          >
            <Svg paths={I_UPLOAD} size={15} />
            {file ? "Другой файл" : "Загрузить файл"}
          </HButton>
          {file && <span style={css("font-size:12px;color:var(--text-3)")}>{file.name}</span>}
        </div>

        {!preview && !busy && (
          <div
            style={css(
              "border:1px dashed var(--border);border-radius:9px;padding:22px;text-align:center;color:var(--text-4);font-size:12.5px"
            )}
          >
            Скачайте шаблон, заполните и загрузите — покажем, что распозналось, до сохранения.
          </div>
        )}

        {preview && preview.errors.length > 0 && (
          <div
            style={css(
              "background:var(--danger-tint);border:1px solid var(--danger-border);border-radius:8px;padding:10px 12px"
            )}
          >
            <div
              style={css(
                "display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--danger);margin-bottom:6px"
              )}
            >
              <Svg paths={I_ALERT} size={14} sw={2} />
              Проблемные строки: {preview.errors.length}
            </div>
            <ul style={css("margin:0;padding-left:18px;font-size:12px;color:var(--danger)")}>
              {preview.errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {preview && preview.rows && preview.rows.length > 0 && (
          <div
            style={css(
              "border:1px solid var(--border-2);border-radius:9px;overflow:hidden;max-height:280px;overflow-y:auto"
            )}
          >
            <div
              style={css(
                "display:grid;grid-template-columns:44px 2fr 1.2fr 1fr .8fr .8fr;background:var(--surface-2);border-bottom:1px solid var(--border-2);font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3);position:sticky;top:0"
              )}
            >
              <div style={css("padding:8px 10px")}>Стр.</div>
              <div style={css("padding:8px 10px")}>Название</div>
              <div style={css("padding:8px 10px")}>Категория</div>
              <div style={css("padding:8px 10px")}>SKU</div>
              <div style={css("padding:8px 10px;text-align:right")}>Сутки</div>
              <div style={css("padding:8px 10px;text-align:right")}>Залог</div>
            </div>
            {preview.rows.map((r) => (
              <div key={r.row_number}>
                <div
                  style={css(
                    "display:grid;grid-template-columns:44px 2fr 1.2fr 1fr .8fr .8fr;border-bottom:1px solid var(--border-2);align-items:center;font-size:12px" +
                      // Битую строку подсвечиваем — в импорт она не пойдёт.
                      (r.error ? ";background:var(--danger-tint)" : "")
                  )}
                >
                  <div style={css("padding:7px 10px;color:var(--text-4);" + MONO)}>
                    {r.row_number}
                  </div>
                  <div style={css("padding:7px 10px;font-weight:500")}>{r.name || "—"}</div>
                  <div style={css("padding:7px 10px;color:var(--text-2)")}>{r.category || "—"}</div>
                  <div style={css("padding:7px 10px;color:var(--text-3);" + MONO)}>
                    {r.sku || "—"}
                  </div>
                  <div style={css("padding:7px 10px;text-align:right;" + MONO)}>
                    {money(r.daily_price)}
                  </div>
                  <div
                    style={css(
                      "padding:7px 10px;text-align:right;" + MONO + ";color:var(--text-2)"
                    )}
                  >
                    {money(r.deposit_price)}
                  </div>
                </div>
                {r.error && (
                  <div
                    style={css(
                      "padding:4px 10px 6px 44px;font-size:11px;color:var(--danger);background:var(--danger-tint);border-bottom:1px solid var(--border-2)"
                    )}
                  >
                    Не будет импортирована: {r.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <ModalError text={error} />
      </div>
    </ModalShell>
  );
}
