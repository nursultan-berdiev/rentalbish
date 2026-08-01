/**
 * Вход. В макете этого экрана нет — собран на токенах дизайн-системы
 * (те же цвета, шрифты и кнопки, что и в панели).
 */
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { css } from "../design/css";
import { I_LOGO, Svg } from "../design/icons";
import { HButton, ModalError, inputStyle } from "../design/ui";


export default function LoginPage() {
  const [loginValue, setLoginValue] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Куда вернуться после входа: адрес, с которого guard увёл на /login (deep-link),
  // иначе — на дашборд.
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(loginValue, password);
      await refresh();
      navigate(from, { replace: true });
    } catch {
      setError("Неверный логин или пароль");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={css(
        "min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font-family:'IBM Plex Sans',system-ui,sans-serif;padding:20px"
      )}
    >
      <form
        onSubmit={onSubmit}
        style={css(
          "width:340px;max-width:100%;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px;box-shadow:0 10px 40px rgba(0,0,0,.06);display:flex;flex-direction:column;gap:14px"
        )}
      >
        <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:2px")}>
          <div
            style={css(
              "width:34px;height:34px;border-radius:9px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;flex:none"
            )}
          >
            <Svg paths={I_LOGO} size={19} sw={1.9} />
          </div>
          <div>
            <div style={css("font-weight:600;font-size:15px;letter-spacing:-.01em")}>Rentalbish</div>
            <div style={css("font-size:11px;color:var(--text-3);margin-top:-1px")}>
              Панель сотрудника
            </div>
          </div>
        </div>

        <label>
          <span
            style={css(
              "display:block;font-size:11.5px;font-weight:500;color:var(--text-2);margin-bottom:5px"
            )}
          >
            Логин
          </span>
          <input
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            autoFocus
            style={css(inputStyle)}
          />
        </label>

        <label>
          <span
            style={css(
              "display:block;font-size:11.5px;font-weight:500;color:var(--text-2);margin-bottom:5px"
            )}
          >
            Пароль
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={css(inputStyle)}
          />
        </label>

        <ModalError text={error} />

        <HButton
          type="submit"
          disabled={busy}
          s="height:40px;background:var(--accent);color:#fff;border:none;border-radius:9px;font-size:13.5px;font-weight:600;cursor:pointer;margin-top:4px"
          hover="background:var(--accent-hover)"
        >
          {busy ? "Вход…" : "Войти"}
        </HButton>
      </form>
    </div>
  );
}
