import axios from "axios";

// По умолчанию API берём с того же хоста, с которого открыта страница (порт 8010).
// Хардкод localhost сломался бы при открытии витрины с телефона по IP — там
// "localhost" указывал бы на само устройство, а не на сервер.
const DEFAULT_API = `${window.location.protocol}//${window.location.hostname}:8010/api/v1`;
const BASE_URL = import.meta.env.VITE_API_URL ?? DEFAULT_API;

// Origin без /api/v1 — им префиксуются ссылки на фото из media/.
export const API_ORIGIN = BASE_URL.replace(/\/api\/v1$/, "");

export const api = axios.create({ baseURL: BASE_URL });

export interface CatalogProduct {
  id: number;
  name: string;
  daily_price: number;
  photo_url: string | null;
  available: number;
  // Категория — для чипов-фильтров; subtitle — строка под названием;
  // is_new — бейдж «Новинка». Приходят из /catalog/public.
  category: string | null;
  subtitle: string;
  is_new: boolean;
}

export interface ProductAttribute {
  label: string;
  value: string;
}

/** Полная карточка для модалки товара — /catalog/public/{id}. */
export interface CatalogDetail {
  id: number;
  name: string;
  subtitle: string;
  description: string;
  daily_price: number;
  available: number;
  category: string | null;
  is_new: boolean;
  photos: string[];
  attributes: ProductAttribute[];
}

export interface OrderItemInput {
  product_id: number;
  quantity: number;
}

export interface WebOrderInput {
  name: string;
  phone: string;
  items: OrderItemInput[];
  comment?: string;
}

/** Абсолютный URL фото из media/ бэкенда. */
export function photoUrl(path: string): string {
  return `${API_ORIGIN}${path}`;
}

export async function fetchCatalog(): Promise<CatalogProduct[]> {
  const { data } = await api.get<CatalogProduct[]>("/catalog/public");
  return data;
}

export async function fetchProduct(id: number): Promise<CatalogDetail> {
  const { data } = await api.get<CatalogDetail>(`/catalog/public/${id}`);
  return data;
}

export async function submitOrder(order: WebOrderInput): Promise<void> {
  await api.post("/weborders", order);
}

/** Статус витрины: режим обслуживания и контактный номер WhatsApp. */
export interface SiteStatus {
  maintenance: boolean;
  whatsapp_phone: string;
}

export async function fetchSiteStatus(): Promise<SiteStatus> {
  const { data } = await api.get<SiteStatus>("/site/status");
  return data;
}
