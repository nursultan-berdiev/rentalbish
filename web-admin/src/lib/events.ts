/**
 * Маленькая типизированная шина событий на CustomEvent.
 *
 * Нужна, чтобы глобальная ИИ-панель могла попросить экран «Обзор» перечитать
 * дашборд после того, как ассистент добавил/убрал блок. Прямого колбэка между
 * ними нет — они в разных ветках дерева.
 */

type Events = {
  "rb:dashboard-changed": void;
};

export function emit<K extends keyof Events>(name: K): void {
  window.dispatchEvent(new CustomEvent(name));
}

export function on<K extends keyof Events>(name: K, handler: () => void): () => void {
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
}
