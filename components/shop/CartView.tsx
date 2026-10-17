"use client";

import { useState } from "react";
import Link from "next/link";
import { getVariant, money, shippingFor, MAX_QTY, STORE } from "@/lib/shop";
import { useCart } from "@/components/shop/Cart";
import ProductArt from "@/components/shop/ProductArt";

export default function CartView() {
  const { lines, ready, setQty } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = lines.flatMap((l) => {
    const hit = getVariant(l.slug, l.variant);
    return hit ? [{ ...l, ...hit }] : [];
  });
  const subtotal = rows.reduce((n, r) => n + r.variant.price * r.qty, 0);
  const shipping = shippingFor(subtotal);

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout is unavailable right now.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout is unavailable right now.");
      setBusy(false);
    }
  };

  if (!ready) return <h1 className="sh-h1">Your cart</h1>;

  if (rows.length === 0) {
    return (
      <>
        <h1 className="sh-h1">Your cart</h1>
        <p className="sh-empty">Nothing here yet. <Link href="/shop">Browse the shop →</Link></p>
      </>
    );
  }

  return (
    <>
      <h1 className="sh-h1">Your cart</h1>
      <div className="sh-cart">
        <ul className="sh-lines">
          {rows.map((r) => (
            <li key={`${r.slug}:${r.variant.id}`}>
              <Link href={`/shop/${r.slug}`} className="sh-art sh-art-sm"><ProductArt product={r.product} /></Link>
              <div className="sh-line-name">
                <Link href={`/shop/${r.slug}`}><b>{r.product.name}</b></Link>
                {r.product.variants.length > 1 && <span>{r.variant.label}</span>}
                <span>{money(r.variant.price)} each</span>
              </div>
              <select
                aria-label={`Quantity of ${r.product.name}`}
                value={r.qty}
                onChange={(e) => setQty(r.slug, r.variant.id, Number(e.target.value))}
              >
                {Array.from({ length: MAX_QTY }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <b className="sh-line-total">{money(r.variant.price * r.qty)}</b>
              <button type="button" className="sh-link" onClick={() => setQty(r.slug, r.variant.id, 0)}>Remove</button>
            </li>
          ))}
        </ul>

        <aside className="sh-summary">
          <dl>
            <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
            <div><dt>Shipping</dt><dd>{shipping === 0 ? "Free" : money(shipping)}</dd></div>
            <div className="sh-total"><dt>Total</dt><dd>{money(subtotal + shipping)}</dd></div>
          </dl>
          {shipping > 0 && (
            <p className="sh-note">Add {money(STORE.freeShippingOver - subtotal)} more for free shipping.</p>
          )}
          <button type="button" className="sh-btn sh-btn-wide" onClick={checkout} disabled={busy}>
            {busy ? "Opening checkout…" : "Check out"}
          </button>
          {error && <p className="sh-error" role="alert">{error}</p>}
          <p className="sh-note">Secure payment by Stripe. {STORE.shippingNote}.</p>
        </aside>
      </div>
    </>
  );
}
