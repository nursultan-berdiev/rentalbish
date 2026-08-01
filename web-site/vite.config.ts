import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Слушать 0.0.0.0: иначе dev-сервер недоступен из Windows-браузера (WSL2)
    // и с телефона (мобильная витрина).
    host: true,
    // Dev-стенд открывают по разным именам (localhost, IP, home-server-wsl),
    // а Vite по умолчанию пускает только известные ему хосты.
    allowedHosts: true,
    // Страница открыта через Caddy на :80, а не напрямую на :5174 — сообщаем
    // HMR-клиенту правильный порт, иначе live-reload не подключится.
    hmr: { clientPort: 80 },
  },
});
