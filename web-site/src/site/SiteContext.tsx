/**
 * Настройки сайта с сервера: режим обслуживания (заглушка «Скоро открытие») и
 * контактный номер WhatsApp. Тянутся один раз при старте; провайдер оборачивает
 * всё приложение, чтобы номер был доступен любой wa.me-ссылке (useWaLink).
 *
 * Фейл-открытие: если запрос упал — считаем сайт рабочим и берём фолбэк-номер,
 * чтобы сбой настроек не ронял витрину.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { fetchSiteStatus } from "../api";
import { WA_PHONE_FALLBACK, buildWaLink } from "../lib/whatsapp";

type Status = "loading" | "up" | "down";

interface SiteValue {
  status: Status;
  waPhone: string;
}

const Ctx = createContext<SiteValue>({ status: "loading", waPhone: WA_PHONE_FALLBACK });

export function SiteProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [waPhone, setWaPhone] = useState(WA_PHONE_FALLBACK);

  useEffect(() => {
    let alive = true;
    fetchSiteStatus()
      .then((s) => {
        if (!alive) return;
        setStatus(s.maintenance ? "down" : "up");
        if (s.whatsapp_phone) setWaPhone(s.whatsapp_phone);
      })
      .catch(() => {
        if (alive) setStatus("up"); // фейл-открытие: не роняем сайт из-за сбоя настроек
      });
    return () => {
      alive = false;
    };
  }, []);

  return <Ctx.Provider value={{ status, waPhone }}>{children}</Ctx.Provider>;
}

export function useSite(): SiteValue {
  return useContext(Ctx);
}

/** Хук-фабрика wa.me-ссылок с актуальным номером из настроек сайта. */
export function useWaLink() {
  const { waPhone } = useSite();
  return useCallback((text: string) => buildWaLink(waPhone, text), [waPhone]);
}
