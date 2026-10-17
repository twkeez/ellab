import Link from "next/link";
import { PRODUCTS, STORE, fromPrice, money } from "@/lib/shop";
import ProductArt from "@/components/shop/ProductArt";

export default function ShopPage() {
  return (
    <>
      <section className="sh-hero">
        <h1>{STORE.tagline}.</h1>
        <p>Leaves, ferns and branches printed on mugs, totes, tees and paper — one order at a time.</p>
      </section>

      <section className="sh-grid">
        {PRODUCTS.map((p) => (
          <Link key={p.slug} href={`/shop/${p.slug}`} className="sh-card">
            <div className="sh-art"><ProductArt product={p} /></div>
            <div className="sh-card-meta">
              <b>{p.name}</b>
              <span>{p.variants.length > 1 ? `from ${money(fromPrice(p))}` : money(fromPrice(p))}</span>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
