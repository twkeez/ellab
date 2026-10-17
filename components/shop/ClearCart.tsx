"use client";

import { useEffect } from "react";
import { useCart } from "@/components/shop/Cart";

// Empties the cart once Stripe sends the shopper back after paying.
export default function ClearCart() {
  const { ready, clear } = useCart();
  useEffect(() => { if (ready) clear(); }, [ready, clear]);
  return null;
}
