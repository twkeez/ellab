"use client";

import { useState } from "react";
import Link from "next/link";
import { money, MAX_QTY, type Product } from "@/lib/shop";
import { useCart } from "@/components/shop/Cart";

export default function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];

  return (
    <div className="sh-buy">
      <p className="sh-price">{money(variant.price)}</p>

      {product.variants.length > 1 && (
        <fieldset className="sh-variants">
          <legend>{product.variantLabel ?? "Option"}</legend>
          {product.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              className={v.id === variantId ? "on" : ""}
              aria-pressed={v.id === variantId}
              onClick={() => { setVariantId(v.id); setAdded(false); }}
            >
              {v.label}
            </button>
          ))}
        </fieldset>
      )}

      <div className="sh-row">
        <label className="sh-qty">
          <span>Qty</span>
          <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
            {Array.from({ length: MAX_QTY }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="sh-btn" onClick={() => { add(product.slug, variant.id, qty); setAdded(true); }}>
          Add to cart
        </button>
      </div>
      {added && (
        <p className="sh-note" role="status">
          Added. <Link href="/shop/cart">View cart →</Link>
        </p>
      )}
    </div>
  );
}
