import { api } from "./client";

// --- Точки ---
export interface Location {
  id: number;
  name: string;
  address: string;
  comment: string;
  is_active: boolean;
}
export const listLocations = () => api.get<Location[]>("/locations").then((r) => r.data);
export const createLocation = (body: Partial<Location>) =>
  api.post<Location>("/locations", body).then((r) => r.data);

// --- Категории ---
export interface Category {
  id: number;
  name: string;
}
export const listCategories = () => api.get<Category[]>("/categories").then((r) => r.data);
export const createCategory = (name: string) =>
  api.post<Category>("/categories", { name }).then((r) => r.data);

// --- Товары ---
export type ProductType = "item" | "set";
export interface ProductPhoto {
  id: number;
  file_path: string;
  is_primary: boolean;
}
export interface SetComponent {
  id?: number;
  component_id: number;
  quantity: number;
}
export interface Product {
  id: number;
  name: string;
  category_id: number | null;
  sku: string | null;
  type: ProductType;
  unit: string;
  description: string;
  deposit_price: number;
  daily_price: number;
  show_on_site: boolean;
  photos: ProductPhoto[];
  components: SetComponent[];
}
export const listProducts = (q?: string) =>
  api.get<Product[]>("/products", { params: { q } }).then((r) => r.data);
export const createProduct = (body: Partial<Product> & { components?: SetComponent[] }) =>
  api.post<Product>("/products", body).then((r) => r.data);
export const uploadProductPhoto = (productId: number, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post<Product>(`/products/${productId}/photos`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

// --- Остатки ---
export interface StockRow {
  product_id: number;
  product_name: string;
  product_category: string;
  location_id: number;
  location_name: string;
  total_qty: number;
  reserved_qty: number;
  issued_qty: number;
  available: number;
}
export const listStock = (location_id?: number) =>
  api.get<StockRow[]>("/inventory/stock", { params: { location_id } }).then((r) => r.data);
export const createSupply = (body: {
  product_id: number;
  location_id: number;
  quantity: number;
  comment?: string;
}) => api.post("/inventory/supply", body).then((r) => r.data);
export const createWriteOff = (body: {
  product_id: number;
  location_id: number;
  quantity: number;
  reason: string;
}) => api.post("/inventory/write-off", body).then((r) => r.data);

// --- Клиенты ---
export interface Client {
  id: number;
  name: string;
  phone: string;
  extra_contacts: string;
  source: string;
  comment: string;
}
export const listClients = (q?: string) =>
  api.get<Client[]>("/clients", { params: { q } }).then((r) => r.data);
export const createClient = (body: Partial<Client>) =>
  api.post<Client>("/clients", body).then((r) => r.data);

// --- Брони ---
export type BookingStatus =
  | "new"
  | "confirmed"
  | "issued"
  | "returned"
  | "closed"
  | "cancelled";
export interface BookingItem {
  id: number;
  product_id: number;
  product_name: string;
  unit: string;
  quantity: number;
  issued_qty: number;
  /** Возвращено целыми (без боя). */
  returned_qty: number;
  /** Списано в бой/утерю. */
  broken_qty: number;
  daily_price: number;
  deposit_price: number;
  line_total: number;
}
export interface Booking {
  id: number;
  client_id: number;
  client_name: string;
  client_phone: string;
  location_id: number;
  location_name: string;
  start_date: string;
  expected_return_date: string;
  days: number;
  status: BookingStatus;
  rental_total: number;
  deposit: number | null;
  prepaid: number;
  items: BookingItem[];
  created_at: string;
}
export const listBookings = (params?: { status?: string }) =>
  api.get<Booking[]>("/bookings", { params }).then((r) => r.data);
export const listOverdue = () => api.get<Booking[]>("/bookings/overdue").then((r) => r.data);
export const getBooking = (id: number) => api.get<Booking>(`/bookings/${id}`).then((r) => r.data);
export const createBooking = (body: {
  client_id: number;
  location_id: number;
  start_date: string;
  expected_return_date: string;
  items: { product_id: number; quantity: number }[];
  deposit?: number | null;
  prepaid?: number;
  /** Черновик не резервирует остаток — резерв при подтверждении. */
  draft?: boolean;
}) => api.post<Booking>("/bookings", body).then((r) => r.data);
export const issueBooking = (id: number, items: { product_id: number; quantity: number }[]) =>
  api.post<Booking>(`/bookings/${id}/issue`, { items }).then((r) => r.data);
export const returnBooking = (
  id: number,
  items: { product_id: number; quantity: number; broken_qty: number }[]
) => api.post<Booking>(`/bookings/${id}/return`, { items }).then((r) => r.data);
export const cancelBooking = (id: number) =>
  api.post<Booking>(`/bookings/${id}/cancel`).then((r) => r.data);
export interface Settlement {
  booking_id: number;
  rental_total: number;
  prepaid: number;
  breakage_total: number;
  to_pay: number;
  on_hands: BookingItem[];
}
export const getSettlement = (id: number) =>
  api.get<Settlement>(`/bookings/${id}/settlement`).then((r) => r.data);

// --- Заявки с сайта ---
export interface WebOrder {
  id: number;
  name: string;
  phone: string;
  comment: string;
  status: string;
  booking_id: number | null;
  items: { product_id: number; quantity: number }[];
  created_at: string;
}
export const listWebOrders = (params?: { status?: string }) =>
  api.get<WebOrder[]>("/weborders", { params }).then((r) => r.data);
export const convertWebOrder = (
  id: number,
  body: { location_id: number; start_date: string; expected_return_date: string; prepaid?: number }
) => api.post<Booking>(`/weborders/${id}/convert`, body).then((r) => r.data);

// --- Отчёты ---
export const reportStock = (location_id?: number) =>
  api.get<StockRow[]>("/reports/stock", { params: { location_id } }).then((r) => r.data);
export const reportMovement = (date_from: string, date_to: string) =>
  api.get("/reports/movement", { params: { date_from, date_to } }).then((r) => r.data);

// --- ИИ-чат ---
export interface AiChatResult {
  conversation_id: number;
  reply: string;
  used_tools: string[];
}
export interface AiConversation {
  id: number;
  title: string;
  updated_at: string;
}
export interface AiMessage {
  role: "user" | "assistant";
  content: string;
  used_tools: string[];
}

export const aiChat = (message: string, conversationId?: number) =>
  api
    .post<AiChatResult>("/ai/chat", { message, conversation_id: conversationId })
    .then((r) => r.data);
export const listConversations = () =>
  api.get<AiConversation[]>("/ai/conversations").then((r) => r.data);
export const getConversation = (id: number) =>
  api.get<AiMessage[]>(`/ai/conversations/${id}`).then((r) => r.data);
export const deleteConversation = (id: number) =>
  api.delete(`/ai/conversations/${id}`).then((r) => r.data);

// ================= Дополнения под разделы панели =================

// --- Товары: правка, фото, Excel-импорт ---
export const getProduct = (id: number) => api.get<Product>(`/products/${id}`).then((r) => r.data);
export const updateProduct = (
  id: number,
  body: Partial<Product> & { components?: SetComponent[] }
) => api.patch<Product>(`/products/${id}`, body).then((r) => r.data);
export const deleteProductPhoto = (productId: number, photoId: number) =>
  api.delete<Product>(`/products/${productId}/photos/${photoId}`).then((r) => r.data);
export const setPrimaryPhoto = (productId: number, photoId: number) =>
  api.post<Product>(`/products/${productId}/photos/${photoId}/primary`).then((r) => r.data);

// --- Настройки сайта: режим обслуживания (заглушка) + номер WhatsApp ---
export interface SiteStatus {
  maintenance: boolean;
  whatsapp_phone: string;
}
export const getSiteStatus = () =>
  api.get<SiteStatus>("/site/status").then((r) => r.data);
export const updateSiteSettings = (body: {
  maintenance_mode?: boolean;
  whatsapp_phone?: string;
}) =>
  api
    .patch<{ maintenance_mode: boolean; whatsapp_phone: string }>("/site/settings", body)
    .then((r) => r.data);

export interface ImportRow {
  row_number: number;
  name: string;
  category: string;
  sku: string | null;
  unit: string;
  deposit_price: number;
  daily_price: number;
  show_on_site: boolean;
  // Причина, по которой строка не будет импортирована (null → валидна).
  error?: string | null;
}
export interface ImportResult {
  parsed: number;
  errors: string[];
  rows?: ImportRow[];
  created?: number;
}
const uploadFile = <T,>(url: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post<T>(url, form, { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data);
};
export const previewImport = (file: File) =>
  uploadFile<ImportResult>("/products/import/preview", file);
export const commitImport = (file: File) =>
  uploadFile<ImportResult>("/products/import/commit", file);

// --- Категории ---
export const renameCategory = (id: number, name: string) =>
  api.patch<Category>(`/categories/${id}`, { name }).then((r) => r.data);

// --- Точки ---
export const updateLocation = (id: number, body: Partial<Location>) =>
  api.patch<Location>(`/locations/${id}`, body).then((r) => r.data);

// --- Клиенты ---
export const getClient = (id: number) => api.get<Client>(`/clients/${id}`).then((r) => r.data);
export const updateClient = (id: number, body: Partial<Client>) =>
  api.patch<Client>(`/clients/${id}`, body).then((r) => r.data);
export interface ClientSummary {
  client: Client;
  bookings_count: number;
  debt: number;
  on_hands: { booking_id: number; product_id: number; product_name: string; qty: number }[];
  bookings: Booking[];
}
export const getClientSummary = (id: number) =>
  api.get<ClientSummary>(`/clients/${id}/summary`).then((r) => r.data);

// --- Брони: черновик и подтверждение ---
export const confirmBooking = (id: number) =>
  api.post<Booking>(`/bookings/${id}/confirm`).then((r) => r.data);

// --- Заявки ---
export const getWebOrder = (id: number) => api.get<WebOrder>(`/weborders/${id}`).then((r) => r.data);
export const updateWebOrderStatus = (id: number, status: string) =>
  api.patch<WebOrder>(`/weborders/${id}/status`, { status }).then((r) => r.data);

// --- Сотрудники ---
export interface User {
  id: number;
  login: string;
  full_name: string;
  role: "admin" | "staff";
  is_active: boolean;
}
export const listUsers = () => api.get<User[]>("/users").then((r) => r.data);
export const createUser = (body: {
  login: string;
  full_name?: string;
  role: string;
  password: string;
  is_active?: boolean;
}) => api.post<User>("/users", body).then((r) => r.data);
export const updateUser = (
  id: number,
  body: { full_name?: string; role?: string; is_active?: boolean; password?: string }
) => api.patch<User>(`/users/${id}`, body).then((r) => r.data);

// --- Аудит ---
export interface AuditEntry {
  id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}
export const listAudit = (params?: { entity?: string; action?: string; user_id?: number; limit?: number }) =>
  api.get<AuditEntry[]>("/audit", { params }).then((r) => r.data);

// --- Отчёты ---
export interface OnHandsRow {
  booking_id: number;
  client_name: string;
  client_phone: string;
  expected_return_date: string;
  overdue: boolean;
  days_overdue: number;
  items: { product_id: number; product_name: string; qty: number }[];
}
export const reportOnHands = () => api.get<OnHandsRow[]>("/reports/on-hands").then((r) => r.data);
export interface MovementReport {
  date_from: string;
  date_to: string;
  supplied_qty: number;
  written_off_qty: number;
  written_off_amount: number;
  issues_count: number;
  returns_count: number;
}
export interface StaffActivityRow {
  user_id: number | null;
  login: string;
  actions: Record<string, number>;
}
export const reportStaffActivity = (date_from: string, date_to: string) =>
  api
    .get<StaffActivityRow[]>("/reports/staff-activity", { params: { date_from, date_to } })
    .then((r) => r.data);

// --- Сквозной поиск ---
export interface SearchResults {
  query: string;
  products: { id: number; name: string; sku: string | null; type: string; daily_price: number }[];
  clients: { id: number; name: string; phone: string }[];
  bookings: {
    id: number;
    client_name: string;
    status: BookingStatus;
    start_date: string;
    expected_return_date: string;
    rental_total: number;
  }[];
}
export const globalSearch = (q: string) =>
  api.get<SearchResults>("/search", { params: { q } }).then((r) => r.data);

// --- Аналитика (настраиваемый дашборд) ---
//
// Блок — это спецификация, а не компонент: бэкенд отдаёт и описание, и данные.
// Поэтому новый блок, добавленный ИИ-ассистентом, рисуется без правок фронтенда.

export type ChartType =
  | "kpi"
  | "line"
  | "area"
  | "bar"
  | "combo"
  | "stacked_bar"
  | "hbar"
  | "donut"
  | "table";

export interface WidgetSeries {
  measure: string;
  label: string | null;
  color: string | null;
  type: "bar" | "line" | "area" | null;
  axis: "left" | "right" | null;
}

export interface WidgetData {
  dataset: string;
  dimensions: { key: string; label: string; kind: "date" | "category" }[];
  measures: { key: string; label: string; format: "int" | "money" }[];
  rows: Record<string, string | number>[];
}

export interface DashboardWidget {
  id: number;
  key: string | null;
  title: string;
  chart: ChartType;
  span: number;
  is_builtin: boolean;
  series: WidgetSeries[];
  data: WidgetData | null;
  previous?: Record<string, number>;
  error: string | null;
}

export interface DashboardNow {
  overdue: number;
  on_hands_bookings: number;
  on_hands_qty: number;
  active_bookings: number;
  new_orders: number;
  zero_stock: number;
}

export interface Dashboard {
  period: { date_from: string; date_to: string; days: number };
  now: DashboardNow;
  widgets: DashboardWidget[];
}

export const getDashboard = (params: {
  date_from?: string;
  date_to?: string;
  location_id?: number;
}) => api.get<Dashboard>("/analytics/dashboard", { params }).then((r) => r.data);

export interface WidgetRow {
  id: number;
  key: string | null;
  title: string;
  chart: ChartType;
  position: number;
  is_visible: boolean;
  is_builtin: boolean;
}

export const listDashboardWidgets = () =>
  api.get<WidgetRow[]>("/analytics/widgets").then((r) => r.data);

export const patchDashboardWidget = (
  id: number,
  body: { title?: string; position?: number; is_visible?: boolean }
) => api.patch<WidgetRow>(`/analytics/widgets/${id}`, body).then((r) => r.data);

export const deleteDashboardWidget = (id: number) =>
  api.delete(`/analytics/widgets/${id}`).then(() => undefined);
