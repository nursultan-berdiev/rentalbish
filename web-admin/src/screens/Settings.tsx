/**
 * Настройки: тема оформления и масштаб интерфейса. Разметка 1:1 из макета.
 * Обе настройки сохраняются в localStorage и применяются сразу (см. design/prefs).
 */
import { useEffect, useState } from "react";

import { apiError } from "../api/client";
import { getSiteStatus, updateSiteSettings } from "../api/domain";
import { useAuth } from "../auth/AuthContext";
import { MONO, css, mix } from "../design/css";
import { ICONS, I_CHECK, Svg } from "../design/icons";
import { SCALES, usePrefs } from "../design/prefs";
import { FieldLabel, HButton, btnPrimary, inputStyle, tabStyle } from "../design/ui";
import { Page } from "../design/table";

type Toast = (kind: "success" | "error", text: string) => void;

export default function Settings({ toast }: { toast: Toast }) {
  const { theme, scale, setTheme, setScale } = usePrefs();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <Page size="form">
      {/* ---- Витрина сайта (только админ) ---- */}
      {isAdmin && <SiteCard toast={toast} />}

      {/* ---- Тема ---- */}
      <section
        style={css(
          "background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:16px"
        )}
      >
        <div style={css("font-size:14px;font-weight:600;margin-bottom:3px")}>Тема оформления</div>
        <div style={css("font-size:12.5px;color:var(--text-3);margin-bottom:16px")}>
          Настройка сохраняется в этом браузере
        </div>

        <div style={css("display:flex;gap:14px;flex-wrap:wrap")}>
          {/* Светлая */}
          <button
            onClick={() => setTheme("light")}
            style={mix(
              "flex:1;min-width:220px;text-align:left;background:var(--surface);border-radius:12px;padding:12px;cursor:pointer",
              { border: `2px solid ${theme === "light" ? "var(--accent)" : "var(--border)"}` }
            )}
          >
            <div
              style={css(
                "height:104px;border-radius:9px;overflow:hidden;border:1px solid #E7E9EC;display:flex;background:#F6F7F9"
              )}
            >
              <div
                style={css(
                  "width:40px;background:#fff;border-right:1px solid #ECEEF1;padding:9px 7px;display:flex;flex-direction:column;gap:6px"
                )}
              >
                <div style={css("width:18px;height:18px;border-radius:5px;background:#3E63DD")} />
                <div style={css("height:5px;background:#E4E7EC;border-radius:3px")} />
                <div style={css("height:5px;width:72%;background:#E4E7EC;border-radius:3px")} />
                <div style={css("height:5px;width:58%;background:#E4E7EC;border-radius:3px")} />
              </div>
              <div style={css("flex:1;padding:10px;display:flex;flex-direction:column;gap:7px")}>
                <div style={css("height:7px;width:46%;background:#CFD4DB;border-radius:3px")} />
                <div
                  style={css("height:24px;background:#fff;border:1px solid #EAEDF0;border-radius:6px")}
                />
                <div
                  style={css("height:24px;background:#fff;border:1px solid #EAEDF0;border-radius:6px")}
                />
              </div>
            </div>
            <div style={css("display:flex;align-items:center;gap:8px;margin-top:12px")}>
              <span style={{ display: "flex", color: "var(--amber-dot)" }}>
                <Svg paths={ICONS.sun} size={16} />
              </span>
              <span style={css("font-size:13.5px;font-weight:600;flex:1")}>Светлая</span>
              {theme === "light" && <Checked />}
            </div>
          </button>

          {/* Тёмная */}
          <button
            onClick={() => setTheme("dark")}
            style={mix(
              "flex:1;min-width:220px;text-align:left;background:var(--surface);border-radius:12px;padding:12px;cursor:pointer",
              { border: `2px solid ${theme === "dark" ? "var(--accent)" : "var(--border)"}` }
            )}
          >
            <div
              style={css(
                "height:104px;border-radius:9px;overflow:hidden;border:1px solid #2A303A;display:flex;background:#0F1116"
              )}
            >
              <div
                style={css(
                  "width:40px;background:#181B22;border-right:1px solid #23282F;padding:9px 7px;display:flex;flex-direction:column;gap:6px"
                )}
              >
                <div style={css("width:18px;height:18px;border-radius:5px;background:#6C8BFF")} />
                <div style={css("height:5px;background:#2E353F;border-radius:3px")} />
                <div style={css("height:5px;width:72%;background:#2E353F;border-radius:3px")} />
                <div style={css("height:5px;width:58%;background:#2E353F;border-radius:3px")} />
              </div>
              <div style={css("flex:1;padding:10px;display:flex;flex-direction:column;gap:7px")}>
                <div style={css("height:7px;width:46%;background:#3A424E;border-radius:3px")} />
                <div
                  style={css(
                    "height:24px;background:#181B22;border:1px solid #262C35;border-radius:6px"
                  )}
                />
                <div
                  style={css(
                    "height:24px;background:#181B22;border:1px solid #262C35;border-radius:6px"
                  )}
                />
              </div>
            </div>
            <div style={css("display:flex;align-items:center;gap:8px;margin-top:12px")}>
              <span style={{ display: "flex", color: "var(--violet-dot)" }}>
                <Svg paths={ICONS.moon} size={16} />
              </span>
              <span style={css("font-size:13.5px;font-weight:600;flex:1")}>Тёмная</span>
              {theme === "dark" && <Checked />}
            </div>
          </button>
        </div>
      </section>

      {/* ---- Масштаб ---- */}
      <section
        style={css(
          "background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px"
        )}
      >
        <div style={css("font-size:14px;font-weight:600;margin-bottom:3px")}>Масштаб интерфейса</div>
        <div style={css("font-size:12.5px;color:var(--text-3);margin-bottom:16px")}>
          Крупнее — удобнее с телефона у стеллажа; компактнее — больше данных на экране
        </div>

        <div
          style={css(
            "display:inline-flex;gap:4px;background:var(--muted-bg);padding:4px;border-radius:10px"
          )}
        >
          {SCALES.map((v) => (
            <button
              key={v}
              onClick={() => setScale(v)}
              style={tabStyle(Math.abs(scale - v) < 0.001)}
            >
              {Math.round(v * 100)}%
            </button>
          ))}
        </div>

        <div
          style={css(
            "margin-top:16px;padding:13px 16px;border:1px solid var(--border-2);border-radius:10px;background:var(--surface-2);display:flex;align-items:center;gap:14px;flex-wrap:wrap"
          )}
        >
          <span style={css("font-size:12.5px;color:var(--text-3)")}>Пример брони:</span>
          <span style={css(MONO + ";font-size:13.5px;color:var(--text-3)")}>№130</span>
          <span
            style={css(
              "display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--green);background:var(--green-tint);padding:3px 10px;border-radius:20px"
            )}
          >
            <span style={css("width:5px;height:5px;border-radius:50%;background:var(--green-dot)")} />
            Закрыта
          </span>
          <span style={css(MONO + ";font-size:13.5px;font-weight:600")}>
            К оплате 4 090 <span style={css("font-size:11px;color:var(--text-4)")}>сом</span>
          </span>
        </div>
      </section>
    </Page>
  );
}

/** Управление публичной витриной: режим обслуживания (заглушка) + номер WhatsApp. */
function SiteCard({ toast }: { toast: Toast }) {
  const [maintenance, setMaintenance] = useState(false);
  const [phone, setPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSiteStatus()
      .then((s) => {
        setMaintenance(s.maintenance);
        setPhone(s.whatsapp_phone);
        setSavedPhone(s.whatsapp_phone);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function toggleMaintenance() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await updateSiteSettings({ maintenance_mode: !maintenance });
      setMaintenance(r.maintenance_mode);
      toast(
        "success",
        r.maintenance_mode ? "Сайт переведён на обслуживание" : "Сайт снова доступен посетителям"
      );
    } catch (e) {
      toast("error", apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function savePhone() {
    const v = phone.trim();
    if (!v) {
      toast("error", "Укажите номер WhatsApp");
      return;
    }
    setBusy(true);
    try {
      const r = await updateSiteSettings({ whatsapp_phone: v });
      setSavedPhone(r.whatsapp_phone);
      setPhone(r.whatsapp_phone);
      toast("success", "Номер WhatsApp сохранён");
    } catch (e) {
      toast("error", apiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={css(
        "background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:16px"
      )}
    >
      <div style={css("font-size:14px;font-weight:600;margin-bottom:3px")}>Витрина сайта</div>
      <div style={css("font-size:12.5px;color:var(--text-3);margin-bottom:16px")}>
        Режим обслуживания скрывает витрину за заставкой «Скоро открытие». Номер WhatsApp
        используется на всём сайте и на заставке.
      </div>

      {/* Режим обслуживания */}
      <div style={css("display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px")}>
        <span style={css("font-size:13px;flex:1;min-width:160px")}>Состояние витрины</span>
        <HButton
          onClick={toggleMaintenance}
          s={mix(
            "display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;border:none;cursor:pointer",
            maintenance
              ? { color: "var(--muted-fg)", background: "var(--muted-bg2)" }
              : { color: "var(--green)", background: "var(--green-tint)" }
          )}
        >
          <span
            style={mix("width:7px;height:7px;border-radius:50%", {
              background: maintenance ? "var(--muted-dot)" : "var(--green-dot)",
            })}
          />
          {maintenance ? "На обслуживании" : "Сайт работает"}
        </HButton>
      </div>

      {/* Номер WhatsApp */}
      <label>
        <FieldLabel>Номер WhatsApp</FieldLabel>
        <div style={css("display:flex;gap:10px;align-items:center;flex-wrap:wrap")}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="996XXXXXXXXX"
            inputMode="tel"
            disabled={!loaded}
            style={mix(inputStyle, { flex: "1", minWidth: "180px" })}
          />
          <HButton
            onClick={savePhone}
            s={mix(btnPrimary, { opacity: phone.trim() && phone.trim() !== savedPhone ? 1 : 0.55 })}
            hover="background:var(--accent-hover)"
          >
            Сохранить
          </HButton>
        </div>
      </label>
    </section>
  );
}

function Checked() {
  return (
    <span
      style={css(
        "width:20px;height:20px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center"
      )}
    >
      <Svg paths={I_CHECK} size={12} sw={3} />
    </span>
  );
}
