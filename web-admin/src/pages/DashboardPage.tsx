import { useAuth } from "../auth/AuthContext";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <header className="topbar">
        <strong>Rentalbish — панель сотрудника</strong>
        <span>
          {user?.full_name || user?.login} ({user?.role}){" "}
          <button onClick={logout}>Выйти</button>
        </span>
      </header>
      <main className="content">
        <h2>Добро пожаловать</h2>
        <p>
          Каркас панели готов. Разделы (склад по точкам, товары/комплекты, брони, выдачи/возвраты,
          бой, клиенты, заявки, ИИ-чат) добавляются на Этапах 1–4.
        </p>
        <ul>
          <li>Склад и остатки по точкам — Этап 1</li>
          <li>Загрузка товаров (Excel + камера) — Этап 2</li>
          <li>Заявки с сайта + Telegram — Этап 3</li>
          <li>ИИ-ассистент (Claude/MCP) — Этап 4</li>
        </ul>
      </main>
    </div>
  );
}
