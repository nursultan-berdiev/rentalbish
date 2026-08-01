/**
 * Оболочка панели: сайдбар (десктоп), выдвижное меню (мобайл), шапка, тосты.
 * Разметка и стили 1:1 из макета «Rentalbish Admin».
 */
import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type Location as RouterLocation,
} from "react-router-dom";
import { listOverdue, listWebOrders } from "./api/domain";
import { useAuth } from "./auth/AuthContext";
import { MONO, css, mix } from "./design/css";
import { I_CLOSE, I_LOGO, Icon, Svg } from "./design/icons";
import { PrefsProvider } from "./design/prefs";
import { HButton, Toast } from "./design/ui";
import AiAssistant from "./components/ai/AiAssistant";
import GlobalSearch from "./components/GlobalSearch";
import LoginPage from "./pages/LoginPage";
import Audit from "./screens/Audit";
import Categories from "./screens/Categories";
import Clients, { ClientDetail } from "./screens/Clients";
import Overview from "./screens/overview";
import Points from "./screens/Points";
import Products from "./screens/Products";
import Reports from "./screens/Reports";
import Requests from "./screens/Requests";
import Settings from "./screens/Settings";
import Staff from "./screens/Staff";
import Stock from "./screens/Stock";
import { BookingCreate, BookingDetail, BookingsList } from "./screens/Bookings";

const I_LOGOUT: [string, Record<string, unknown>][] = [
  ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }],
  ["polyline", { points: "16 17 21 12 16 7" }],
  ["line", { x1: 21, y1: 12, x2: 9, y2: 12 }],
];
const I_MENU: [string, Record<string, unknown>][] = [
  ["path", { d: "M4 6h16" }],
  ["path", { d: "M4 12h16" }],
  ["path", { d: "M4 18h16" }],
];
const I_BELL: [string, Record<string, unknown>][] = [
  ["path", { d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" }],
  ["path", { d: "M10.3 21a1.94 1.94 0 0 0 3.4 0" }],
];
const I_LOCK: [string, Record<string, unknown>][] = [
  ["rect", { x: 3, y: 11, width: 18, height: 11, rx: 2 }],
  ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }],
];

interface NavItem {
  key: string;
  path: string;
  label: string;
  admin?: boolean;
}

const NAV_MAIN: NavItem[] = [
  { key: "overview", path: "/", label: "Обзор" },
  { key: "stock", path: "/stock", label: "Остатки" },
  { key: "bookings", path: "/bookings", label: "Брони" },
  { key: "products", path: "/products", label: "Товары" },
  { key: "customers", path: "/customers", label: "Клиенты" },
  { key: "requests", path: "/requests", label: "Заявки" },
  { key: "reports", path: "/reports", label: "Отчёты" },
  { key: "settings", path: "/settings", label: "Настройки" },
];

const NAV_ADMIN: NavItem[] = [
  { key: "points", path: "/points", label: "Точки", admin: true },
  { key: "staff", path: "/staff", label: "Сотрудники", admin: true },
  { key: "audit", path: "/audit", label: "Аудит", admin: true },
  { key: "categories", path: "/categories", label: "Категории", admin: true },
];

const TITLES: Record<string, string> = {
  overview: "Обзор",
  stock: "Остатки",
  bookings: "Брони",
  products: "Товары",
  customers: "Клиенты",
  requests: "Заявки",
  reports: "Отчёты",
  points: "Точки",
  staff: "Сотрудники",
  audit: "Журнал аудита",
  categories: "Категории",
  settings: "Настройки",
};

const SUBTITLES: Record<string, string> = {
  overview: "Аналитика, задачи дня и ИИ-ассистент",
  stock: "Остатки по товарам и точкам",
  bookings: "Все брони и статусы",
  products: "Товары, комплекты, фото и Excel-импорт",
  customers: "Клиенты, история броней и долги",
  requests: "Заявки с сайта и конвертация в бронь",
  reports: "Остатки, просрочки, движение и активность",
  points: "Склады, по которым ведётся остаток",
  staff: "Учётные записи и роли",
  audit: "Кто, что и когда сделал",
  categories: "Справочник категорий товаров",
  settings: "Тема и масштаб интерфейса",
};

function screenKey(loc: RouterLocation): string {
  const p = loc.pathname;
  if (p === "/") return "overview";
  const seg = p.split("/")[1] ?? "";
  return seg || "overview";
}

export default function App() {
  return (
    <PrefsProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<Shell />} />
      </Routes>
    </PrefsProvider>
  );
}

function Shell() {
  const { user, loading, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [width, setWidth] = useState(() => window.innerWidth);
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [newOrders, setNewOrders] = useState(0);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!user) return;
    // Просрочки считает сервер (/bookings/overdue). Своя формула здесь расходилась с
    // «Обзором»: она не учитывала, что часть выданного уже могли вернуть.
    listOverdue()
      .then((bs) => setOverdueCount(bs.length))
      .catch(() => setOverdueCount(0));
    listWebOrders({ status: "new" })
      .then((o) => setNewOrders(o.length))
      .catch(() => setNewOrders(0));
  }, [user, loc.pathname]);

  function showToast(kind: "success" | "error", text: string) {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 2800);
  }

  if (loading) return <div style={css("padding:24px;color:var(--text-3)")}>Загрузка…</div>;
  // Прямую ссылку (например /bookings/123), открытую без входа, запоминаем —
  // после логина вернём на неё, а не на дашборд.
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;

  const isDesktop = width >= 860;
  const key = screenKey(loc);
  const isAdmin = user.role === "admin";

  const badgeOf = (k: string) =>
    k === "overview" ? overdueCount || null : k === "requests" ? newOrders || null : null;

  const navStyle = (active: boolean) =>
    mix(
      "display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;margin-bottom:2px;border-radius:7px;border:1px solid transparent;font:inherit;font-size:13px;cursor:pointer",
      {
        background: active ? "var(--accent-tint)" : "transparent",
        color: active ? "var(--accent-strong)" : "var(--text-2)",
        fontWeight: active ? 600 : 500,
      }
    );

  const NavButton = ({ item, locked }: { item: NavItem; locked?: boolean }) => {
    const active = key === item.key;
    const badge = badgeOf(item.key);
    return (
      <HButton
        onClick={() => {
          // Замок был декоративным: кнопка всё равно навигировала, и сотрудник
          // попадал на админ-экран (данные потом отдавали 403). Теперь не пускаем.
          if (locked) {
            setToast({ kind: "error", text: "Раздел доступен только администратору" });
            return;
          }
          nav(item.path);
          setNavOpen(false);
        }}
        s={navStyle(active)}
        hover="background:var(--hover)"
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            flex: "none",
            color: active ? "var(--accent)" : "var(--text-3)",
          }}
        >
          <Icon name={item.key} />
        </span>
        <span style={css("flex:1;text-align:left")}>{item.label}</span>
        {badge && (
          <span
            style={css(
              "flex:none;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--accent);color:#fff;font-size:10.5px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;" + MONO
            )}
          >
            {badge}
          </span>
        )}
        {locked && (
          <span style={{ display: "flex", flex: "none", color: "var(--text-5)" }}>
            <Svg paths={I_LOCK} size={12} sw={2} />
          </span>
        )}
      </HButton>
    );
  };

  const NavContent = () => (
    <>
      {NAV_MAIN.map((n) => (
        <NavButton key={n.key} item={n} />
      ))}
      <div
        style={css(
          "margin:14px 8px 6px;font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text-4)"
        )}
      >
        Администрирование
      </div>
      {NAV_ADMIN.map((n) => (
        <NavButton key={n.key} item={n} locked={!isAdmin} />
      ))}
    </>
  );

  const initials = (user.full_name || user.login)
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      style={css(
        "height:100%;min-height:100%;display:flex;position:relative;overflow:hidden;background:var(--bg);color:var(--text);font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:13px;line-height:1.45"
      )}
    >
      {/* ---------- Сайдбар (десктоп) ---------- */}
      {isDesktop && (
        <aside
          style={css(
            "width:236px;flex:none;height:100%;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column"
          )}
        >
          <div
            style={css(
              "height:56px;flex:none;display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid var(--border-2)"
            )}
          >
            <div
              style={css(
                "width:30px;height:30px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;flex:none;color:#fff"
              )}
            >
              <Svg paths={I_LOGO} size={17} sw={1.9} />
            </div>
            <div style={css("min-width:0")}>
              <div style={css("font-weight:600;font-size:14px;letter-spacing:-.01em")}>
                Rentalbish
              </div>
              <div style={css("font-size:10.5px;color:var(--text-3);margin-top:-1px")}>
                Аренда посуды
              </div>
            </div>
          </div>

          <nav style={css("flex:1;min-height:0;overflow:auto;padding:12px 12px 0")}>
            <NavContent />
          </nav>

          <div
            style={css(
              "flex:none;border-top:1px solid var(--border-2);padding:10px 12px;display:flex;align-items:center;gap:10px"
            )}
          >
            <div
              style={css(
                "width:30px;height:30px;border-radius:50%;background:var(--muted-bg);color:var(--text-2);display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;flex:none"
              )}
            >
              {initials}
            </div>
            <div style={css("flex:1;min-width:0")}>
              <div
                style={css(
                  "font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                )}
              >
                {user.full_name || user.login}
              </div>
              <div style={css("font-size:10.5px;color:var(--text-3)")}>
                {isAdmin ? "Администратор" : "Сотрудник"}
              </div>
            </div>
            <HButton
              title="Выход"
              onClick={logout}
              s="width:28px;height:28px;border:none;background:transparent;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-3)"
              hover="background:var(--hover);color:var(--text-2)"
            >
              <Svg paths={I_LOGOUT} size={16} sw={1.7} />
            </HButton>
          </div>
        </aside>
      )}

      {/* ---------- Контентная колонка ---------- */}
      <div
        style={css(
          "flex:1;min-width:0;height:100%;display:flex;flex-direction:column;overflow:hidden"
        )}
      >
        {!isDesktop ? (
          <header
            style={css(
              "height:54px;flex:none;display:flex;align-items:center;gap:10px;padding:0 12px;background:var(--surface);border-bottom:1px solid var(--border)"
            )}
          >
            <HButton
              onClick={() => setNavOpen(true)}
              s="width:34px;height:34px;border:1px solid var(--border);background:var(--surface);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-2);flex:none"
            >
              <Svg paths={I_MENU} size={18} />
            </HButton>
            <div style={css("flex:1;font-weight:600;font-size:15px")}>{TITLES[key] ?? ""}</div>
            <div
              style={css(
                "width:30px;height:30px;border-radius:50%;background:var(--muted-bg);color:var(--text-2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex:none"
              )}
            >
              {initials}
            </div>
          </header>
        ) : (
          <header
            style={css(
              "height:56px;flex:none;display:flex;align-items:center;gap:16px;padding:0 22px;background:var(--surface);border-bottom:1px solid var(--border)"
            )}
          >
            <div style={css("min-width:0")}>
              <div style={css("font-weight:600;font-size:16px;letter-spacing:-.01em")}>
                {TITLES[key] ?? ""}
              </div>
              <div style={css("font-size:11px;color:var(--text-3);margin-top:-1px")}>
                {SUBTITLES[key] ?? ""}
              </div>
            </div>
            <div style={css("flex:1")} />
            <GlobalSearch />
            <HButton
              onClick={() => nav("/")}
              s="position:relative;width:34px;height:34px;border:1px solid var(--border);background:var(--surface);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-2);flex:none"
              hover="background:var(--hover)"
            >
              <Svg paths={I_BELL} size={17} sw={1.7} />
              {overdueCount > 0 && (
                <span
                  style={css(
                    "position:absolute;top:7px;right:8px;width:7px;height:7px;border-radius:50%;background:var(--danger-dot);border:1.5px solid var(--surface)"
                  )}
                />
              )}
            </HButton>
          </header>
        )}

        <main style={css("flex:1;min-height:0;overflow:auto;position:relative")}>
          <Routes>
            <Route path="/" element={<Overview isDesktop={isDesktop} isAdmin={isAdmin} />} />
            <Route path="/stock" element={<Stock isDesktop={isDesktop} toast={showToast} />} />
            <Route
              path="/bookings"
              element={<BookingsList isDesktop={isDesktop} toast={showToast} />}
            />
            <Route
              path="/bookings/new"
              element={<BookingCreate isDesktop={isDesktop} toast={showToast} />}
            />
            <Route
              path="/bookings/:id"
              element={<BookingDetail isDesktop={isDesktop} toast={showToast} />}
            />
            <Route path="/settings" element={<Settings toast={showToast} />} />
            <Route path="/products" element={<Products isDesktop={isDesktop} toast={showToast} />} />
            <Route path="/customers" element={<Clients isDesktop={isDesktop} toast={showToast} />} />
            <Route path="/customers/:id" element={<ClientDetail isDesktop={isDesktop} />} />
            <Route path="/requests" element={<Requests isDesktop={isDesktop} toast={showToast} />} />
            <Route path="/reports" element={<Reports isDesktop={isDesktop} />} />
            {/* Админ-разделы: прямой заход по URL сотрудником уводим на дашборд
                (данные и так защищены require_admin, но экран показывать незачем). */}
            <Route
              path="/points"
              element={isAdmin ? <Points isDesktop={isDesktop} toast={showToast} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/staff"
              element={isAdmin ? <Staff isDesktop={isDesktop} toast={showToast} /> : <Navigate to="/" replace />}
            />
            <Route path="/audit" element={isAdmin ? <Audit /> : <Navigate to="/" replace />} />
            <Route
              path="/categories"
              element={isAdmin ? <Categories isDesktop={isDesktop} toast={showToast} /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* ---------- Мобильное меню ---------- */}
      {navOpen && !isDesktop && (
        <div
          onClick={() => setNavOpen(false)}
          style={css(
            "position:absolute;inset:0;background:rgba(15,18,25,.4);z-index:80;display:flex;animation:fadeIn .12s ease"
          )}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            style={css(
              "width:250px;height:100%;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;animation:slideRight .16s ease"
            )}
          >
            <div
              style={css(
                "height:54px;flex:none;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid var(--border-2)"
              )}
            >
              <div
                style={css(
                  "width:28px;height:28px;border-radius:7px;background:var(--accent);display:flex;align-items:center;justify-content:center;flex:none;color:#fff"
                )}
              >
                <Svg paths={I_LOGO} size={16} sw={1.9} />
              </div>
              <div style={css("flex:1;font-weight:600;font-size:14px")}>Rentalbish</div>
              <HButton
                onClick={() => setNavOpen(false)}
                s="width:30px;height:30px;border:none;background:transparent;border-radius:6px;cursor:pointer;color:var(--text-3);display:flex;align-items:center;justify-content:center"
              >
                <Svg paths={I_CLOSE} size={17} />
              </HButton>
            </div>
            <nav style={css("flex:1;min-height:0;overflow:auto;padding:12px 12px 0")}>
              <NavContent />
            </nav>
            <div
              style={css(
                "flex:none;border-top:1px solid var(--border-2);padding:10px 12px;display:flex;align-items:center;gap:10px"
              )}
            >
              <div
                style={css(
                  "width:30px;height:30px;border-radius:50%;background:var(--muted-bg);color:var(--text-2);display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;flex:none"
                )}
              >
                {initials}
              </div>
              <div style={css("flex:1;min-width:0")}>
                <div style={css("font-size:12.5px;font-weight:600")}>
                  {user.full_name || user.login}
                </div>
                <div style={css("font-size:10.5px;color:var(--text-3)")}>
                  {isAdmin ? "Администратор" : "Сотрудник"}
                </div>
              </div>
              <HButton
                title="Выход"
                onClick={logout}
                s="width:28px;height:28px;border:none;background:transparent;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-3)"
              >
                <Svg paths={I_LOGOUT} size={16} sw={1.7} />
              </HButton>
            </div>
          </aside>
        </div>
      )}

      {toast && <Toast kind={toast.kind} text={toast.text} />}

      {/* Глобальный ИИ-ассистент: кнопка справа внизу + выезжающая панель. */}
      <AiAssistant />
    </div>
  );
}
