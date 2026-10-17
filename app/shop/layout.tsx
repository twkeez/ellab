import type { Metadata } from "next";
import Link from "next/link";
import { STORE, money } from "@/lib/shop";
import { CartProvider, CartLink } from "@/components/shop/Cart";
import "./shop.css";

export const metadata: Metadata = {
  title: { default: STORE.name, template: `%s · ${STORE.name}` },
  description: STORE.tagline,
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="shop">
        <header className="sh-top">
          <Link href="/shop" className="sh-logo">{STORE.name}</Link>
          <CartLink />
        </header>
        <div className="sh-ribbon">
          Free shipping on orders over {money(STORE.freeShippingOver)} · {STORE.shippingNote}
        </div>
        <main className="sh-main">{children}</main>
        <footer className="sh-foot">
          <p><b>{STORE.name}</b> — {STORE.tagline.toLowerCase()}.</p>
          <p>Every piece is printed when you order it, so nothing sits in a warehouse. US shipping only for now.</p>
        </footer>
      </div>
    </CartProvider>
  );
}
