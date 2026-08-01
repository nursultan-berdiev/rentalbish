/**
 * Глобальная корзина витрины: что и в каком количестве набрал гость.
 *
 * Каталог грузим один раз здесь же — и корзина, и страницы, и модалка берут
 * товары отсюда, чтобы не тянуть /catalog/public на каждом экране. Состав корзины
 * переживает перезагрузку через localStorage.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchCatalog, type CatalogProduct, type OrderItemInput } from "../api";

const STORAGE_KEY = "rb_cart";

export interface CartLine {
  product: CatalogProduct;
  qty: number;
}

interface CartValue {
  products: CatalogProduct[];
  status: "loading" | "ready" | "empty";
  items: Record<number, number>;
  /** Число позиций (разных товаров) — для счётчика в шапке. */
  count: number;
  lines: CartLine[];
  rentalTotal: number;
  itemsInput: OrderItemInput[];
  setQty: (id: number, qty: number) => void;
  add: (id: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}

const Ctx = createContext<CartValue | null>(null);

function loadItems(): Record<number, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const out: Record<number, number> = {};
    for (const [id, qty] of Object.entries(parsed)) {
      if (Number(qty) > 0) out[Number(id)] = Number(qty);
    }
    return out;
  } catch {
    return {};
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const [items, setItems] = useState<Record<number, number>>(loadItems);

  useEffect(() => {
    fetchCatalog()
      .then((data) => {
        setProducts(data);
        setStatus(data.length ? "ready" : "empty");
      })
      .catch(() => setStatus("empty"));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const setQty = useCallback((id: number, qty: number) => {
    setItems((c) => {
      const next = { ...c };
      if (qty > 0) next[id] = qty;
      else delete next[id];
      return next;
    });
  }, []);

  const add = useCallback((id: number) => setItems((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 })), []);
  const remove = useCallback((id: number) => setQty(id, 0), [setQty]);
  const clear = useCallback(() => setItems({}), []);

  const value = useMemo<CartValue>(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines: CartLine[] = Object.entries(items)
      .map(([id, qty]) => ({ product: byId.get(Number(id)), qty }))
      .filter((l): l is CartLine => Boolean(l.product));
    const rentalTotal = lines.reduce((s, l) => s + l.product.daily_price * l.qty, 0);
    const itemsInput = lines.map((l) => ({ product_id: l.product.id, quantity: l.qty }));
    return {
      products,
      status,
      items,
      count: Object.keys(items).length,
      lines,
      rentalTotal,
      itemsInput,
      setQty,
      add,
      remove,
      clear,
    };
  }, [products, status, items, setQty, add, remove, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart вне CartProvider");
  return v;
}
