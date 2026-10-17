import type { Metadata } from "next";
import Link from "next/link";
import { STORE } from "@/lib/shop";
import ClearCart from "@/components/shop/ClearCart";

export const metadata: Metadata = { title: "Thank you" };

export default function SuccessPage() {
  return (
    <section className="sh-hero">
      <ClearCart />
      <h1>Thank you — your order is in.</h1>
      <p>Your pieces are printed to order and ship in 3–7 business days.</p>
      <p><Link href="/shop">← Back to {STORE.name}</Link></p>
    </section>
  );
}
