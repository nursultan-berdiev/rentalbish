/** Точки (склады): список, создание, правка, активность. Только администратор. */
import { useEffect, useState } from "react";
import { apiError } from "../api/client";
import { createLocation, listLocations, updateLocation, type Location } from "../api/domain";
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

const GRID = "70px 2fr 2.4fr 110px 90px";

export default function Points({
  toast,
}: {
  isDesktop: boolean;
  toast: (k: "success" | "error", t: string) => void;
}) {
  const [rows, setRows] = useState<Location[]>([]);
  const [editing, setEditing] = useState<Location | "new" | null>(null);

  const reload = () => listLocations().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    reload();
  }, []);

  async function toggleActive(l: Location) {
    try {
      await updateLocation(l.id, { is_active: !l.is_active });
      await reload();
      toast("success", l.is_active ? `Точка «${l.name}» отключена` : `Точка «${l.name}» включена`);
    } catch (e) {
      toast("error", apiError(e));
    }
  }

  return (
    <Page>
      <Toolbar actions={<PrimaryAction onClick={() => setEditing("new")}>Новая точка</PrimaryAction>} />

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
          <div style={css("padding:9px 14px")}>Адрес</div>
          <div style={css("padding:9px 14px")}>Статус</div>
          <div style={css("padding:9px 14px")} />
        </div>

        {rows.length === 0 ? (
          <div style={css("padding:50px 20px;text-align:center;color:var(--text-3)")}>
            <div style={css(EMPTY_ICON)}>
              <Icon name="points" size={24} />
            </div>
            <div style={css("font-size:13.5px;font-weight:500;color:var(--text-2)")}>Точек нет</div>
            <div style={css("font-size:12px;margin-top:3px")}>
              Остаток и брони ведутся по каждой точке отдельно
            </div>
          </div>
        ) : (
          rows.map((l) => (
            <div
              key={l.id}
              style={mix(TROW, {
                gridTemplateColumns: GRID,
              })}
            >
              <div style={css("padding:10px 14px;" + MONO + ";font-size:12.5px;color:var(--text-3)")}>
                {l.id}
              </div>
              <div style={css("padding:10px 14px;font-weight:600;font-size:13px")}>{l.name}</div>
              <div style={css("padding:10px 14px;font-size:12px;color:var(--text-2)")}>
                {l.address || "—"}
              </div>
              <div style={css("padding:10px 14px")}>
                <HButton
                  onClick={() => toggleActive(l)}
                  s={mix(
                    "display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:20px;border:none;cursor:pointer",
                    l.is_active
                      ? { color: "var(--green)", background: "var(--green-tint)" }
                      : { color: "var(--muted-fg)", background: "var(--muted-bg2)" }
                  )}
                >
                  <span
                    style={mix("width:6px;height:6px;border-radius:50%", {
                      background: l.is_active ? "var(--green-dot)" : "var(--muted-dot)",
                    })}
                  />
                  {l.is_active ? "активна" : "отключена"}
                </HButton>
              </div>
              <div style={css("padding:7px 12px;display:flex;justify-content:flex-end")}>
                <HButton
                  onClick={() => setEditing(l)}
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
        <PointForm
          point={editing === "new" ? null : editing}
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

function PointForm({
  point,
  onClose,
  onSaved,
}: {
  point: Location | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(point?.name ?? "");
  const [address, setAddress] = useState(point?.address ?? "");
  const [comment, setComment] = useState(point?.comment ?? "");
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!name.trim()) return setError("Укажите название точки");
    try {
      if (point) {
        await updateLocation(point.id, { name, address, comment });
        onSaved(`Точка «${name}» сохранена`);
      } else {
        await createLocation({ name, address, comment });
        onSaved(`Точка «${name}» создана`);
      }
    } catch (e) {
      setError(apiError(e));
    }
  }

  return (
    <ModalShell
      title={point ? `Точка «${point.name}»` : "Новая точка"}
      icon={<Icon name="points" size={16} />}
      onClose={onClose}
      width={460}
      footer={
        <>
          <HButton onClick={onClose} s={btnGhost} hover="background:var(--hover)">
            Отмена
          </HButton>
          <HButton onClick={save} s={btnPrimary} hover="background:var(--accent-hover)">
            {point ? "Сохранить" : "Создать"}
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
            placeholder="Центральный склад"
            style={css(inputStyle)}
          />
        </label>
        <label>
          <FieldLabel>Адрес</FieldLabel>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="ул. Киевская, 95"
            style={css(inputStyle)}
          />
        </label>
        <label>
          <FieldLabel>Комментарий</FieldLabel>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={css(inputStyle)}
          />
        </label>
        <ModalError text={error} />
      </div>
    </ModalShell>
  );
}
