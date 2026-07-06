import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({ baseURL: BASE_URL });

export interface CatalogProduct {
  id: number;
  name: string;
  daily_price: number;
  photo_url: string | null;
  available: number;
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

// Публичный каталог (эндпоинт реализуется в Этапе 1/3). Пока может вернуть 404 —
// вызывающий код это обрабатывает и показывает заглушку.
export async function fetchCatalog(): Promise<CatalogProduct[]> {
  const { data } = await api.get<CatalogProduct[]>("/catalog/public");
  return data;
}

export async function submitOrder(order: WebOrderInput): Promise<void> {
  await api.post("/weborders", order);
}
