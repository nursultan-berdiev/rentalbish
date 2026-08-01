/** Категории товаров: список, создание, переименование. */
import { useEffect, useState } from "react";
import { apiError } from "../api/client";
import {
  createCategory,
  listCategories,
  listProducts,
  renameCategory,
  type Category,
  type Product,
} from "../api/domain";
import { css, mix } from "../design/css";
import { Icon } from "../design/icons";
import { EMPTY_ICON, MONO, PANEL, Page, PrimaryAction, THEAD, TROW, Toolbar } from "../design/table";
import {
  FieldLabel,
  HButton,
  ModalError,
  ModalShell,
  btnGhost,
  btnPrimary,
  inputStyle,
} from "../design/ui";

const GRID = "70px 2fr 1fr 90px";

export default function Categories({
  toast,
}: {
  isDesktop: boolean;
  toast: (k: "success" | "error", t: string) => void;
}) {
  const [rows, setRows] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  const reload = () => listCategories().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    reload();
    listProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  const countOf = (id: number) => products.filter((p) => p.category_id === id).length;

  return (
    <Page>
      <Toolbar
        actions={<PrimaryAction onClick={() => setEditing("new")}>Новая категория</PrimaryAction>}
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
          <div style={css("padding:9px 14px")}>ID</div>
          <div style={css("padding:9px 14px")}>Название</div>
          <div style={css("padding:9px 14px;text-align:right")}>Товаров</div>
          <div style={css("padding:9px 14px")} />
        </div>

        {rows.length === 0 ? (
          <div style={css("padding:50px 20px;text-align:center;color:var(--text-3)")}>
            <div style={css(EMPTY_ICON)}>
              <Icon name="categories" size={24} />
            </div>
            <div style={css("font-size:13.5px;font-weight:500;color:var(--text-2)")}>
              Категорий нет
            </div>
            <div style={css("font-size:12px;margin-top:3px")}>
              Категории также создаются автоматически при Excel-импорте
            </div>
          </div>
        ) : (
          rows.map((c) => (
            <div
              key={c.id}
              style={mix(TROW, {
                gridTemplateColumns: GRID,
              })}
            >
              <div style={css("padding:10px 14px;" + MONO + ";font-size:12.5px;color:var(--text-3)")}>
                {c.id}
              </div>
              <div style={css("padding:10px 14px;font-weight:600;font-size:13px")}>{c.name}</div>
              <div
                style={css(
                  "padding:10px 14px;text-align:right;" + MONO + ";font-size:12.5px;color:var(--text-2)"
                )}
              >
                {countOf(c.id)}
              </div>
              <div style={css("padding:7px 12px;display:flex;justify-content:flex-end")}>
                <HButton
                  onClick={() => setEditing(c)}
                  s="width:26px;height:26px;border:1px solid var(--border);background:var(--surface);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:12px"
                  hover="border-color:var(--accent);color:var(--accent)"
                >
                  ✎
                </HButton>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <CategoryForm
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            await reload();
            toast("success", msg);
          }}
        />
      )}
    </Page>
  );
}

function CategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!name.trim()) return setError("Укажите название");
    try {
      if (category) {
        await renameCategory(category.id, name.trim());
        onSaved(`Категория переименована в «${name}»`);
      } else {
        await createCategory(name.trim());
        onSaved(`Категория «${name}» создана`);
      }
    } catch (e) {
      setError(apiError(e));
    }
  }

  return (
    <ModalShell
      title={category ? "Переименовать категорию" : "Новая категория"}
      icon={<Icon name="categories" size={16} />}
      onClose={onClose}
      width={420}
      footer={
        <>
          <HButton onClick={onClose} s={btnGhost} hover="background:var(--hover)">
            Отмена
          </HButton>
          <HButton onClick={save} s={btnPrimary} hover="background:var(--accent-hover)">
            {category ? "Сохранить" : "Создать"}
          </HButton>
        </>
      }
    >
      <div style={css("padding:18px;display:flex;flex-direction:column;gap:14px")}>
        <label>
          <FieldLabel>Название</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Тарелки"
            style={css(inputStyle)}
          />
        </label>
        <ModalError text={error} />
      </div>
    </ModalShell>
  );
}
