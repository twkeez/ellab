"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { getVariant, MAX_QTY, type CartLine } from "@/lib/shop";

const CART_KEY = "sprig:cart";

type CartCtx = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  add: (slug: string, variant: string, qty: number) => void;
  setQty: (slug: string, variant: string, qty: number) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}

const clamp = (n: number) => Math.max(0, Math.min(MAX_QTY, Math.floor(n)));

// The cart lives in this browser only, as a tiny external store over
// localStorage. Anything the catalog no longer sells is dropped on read.
const EMPTY: CartLine[] = [];
let cache: CartLine[] | null = null;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    cache = Array.isArray(raw)
      ? raw.filter((l: CartLine) => getVariant(l.slug, l.variant) && clamp(l.qty) > 0)
      : [];
  } catch {
    cache = [];
  }
  return cache!;
}

function write(next: CartLine[]) {
  cache = next;
  try { localStorage.setItem(CART_KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  // Keep other tabs in step.
  const onStorage = (e: StorageEvent) => { if (e.key === CART_KEY) { cache = null; fn(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
}

const noopSubscribe = () => () => {};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const lines = useSyncExternalStore(subscribe, read, () => EMPTY);
  // false during server render and hydration, true once the browser cart is readable.
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const setQty = useCallback((slug: string, variant: string, qty: number) => {
    const ls = read();
    const q = clamp(qty);
    const rest = ls.filter((l) => !(l.slug === slug && l.variant === variant));
    if (q === 0) return write(rest);
    const exists = ls.some((l) => l.slug === slug && l.variant === variant);
    write(exists
      ? ls.map((l) => (l.slug === slug && l.variant === variant ? { ...l, qty: q } : l))
      : [...ls, { slug, variant, qty: q }]);
  }, []);

  const add = useCallback((slug: string, variant: string, qty: number) => {
    const ls = read();
    const cur = ls.find((l) => l.slug === slug && l.variant === variant);
    const q = clamp((cur?.qty ?? 0) + qty);
    write(cur
      ? ls.map((l) => (l === cur ? { ...l, qty: q } : l))
      : [...ls, { slug, variant, qty: q }]);
  }, []);

  const clear = useCallback(() => write([]), []);

  const value = useMemo(
    () => ({ lines, ready, count: lines.reduce((n, l) => n + l.qty, 0), add, setQty, clear }),
    [lines, ready, add, setQty, clear]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function CartLink() {
  const { count } = useCart();
  return (
    <Link href="/shop/cart" className="sh-cartlink">
      Cart{count > 0 && <span className="sh-badge">{count}</span>}
    </Link>
  );
}
