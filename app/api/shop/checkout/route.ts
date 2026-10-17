// Turns a cart into a Stripe Checkout session and returns its URL. The cart
// only names products — every price is looked up again from lib/shop.ts here.
// Stripe collects payment and the shipping address; the order then gets sent
// to the print-on-demand service for fulfilment. Needs STRIPE_SECRET_KEY.

import { getVariant, shippingFor, MAX_QTY, STORE, type CartLine } from "@/lib/shop";

export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return Response.json({ error: "Checkout isn't switched on yet — STRIPE_SECRET_KEY is not set." }, { status: 503 });
  }

  let lines: CartLine[];
  try {
    const body = await request.json();
    lines = Array.isArray(body?.lines) ? body.lines : [];
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const form = new URLSearchParams();
  let subtotal = 0;
  let i = 0;
  for (const line of lines) {
    const hit = getVariant(String(line?.slug), String(line?.variant));
    const qty = Math.floor(Number(line?.qty));
    if (!hit) {
      return Response.json({ error: "Your cart has an item we no longer sell. Remove it and try again." }, { status: 400 });
    }
    if (!(qty >= 1 && qty <= MAX_QTY)) {
      return Response.json({ error: `Quantities must be between 1 and ${MAX_QTY}.` }, { status: 400 });
    }
    const { product, variant } = hit;
    const name = product.variants.length > 1 ? `${product.name} — ${variant.label}` : product.name;
    form.set(`line_items[${i}][price_data][currency]`, STORE.currency);
    form.set(`line_items[${i}][price_data][unit_amount]`, String(variant.price));
    form.set(`line_items[${i}][price_data][product_data][name]`, name);
    form.set(`line_items[${i}][price_data][product_data][metadata][slug]`, product.slug);
    form.set(`line_items[${i}][price_data][product_data][metadata][variant]`, variant.id);
    form.set(`line_items[${i}][quantity]`, String(qty));
    subtotal += variant.price * qty;
    i++;
  }
  if (i === 0) return Response.json({ error: "Your cart is empty." }, { status: 400 });

  const shipping = shippingFor(subtotal);
  const origin = new URL(request.url).origin;
  form.set("mode", "payment");
  form.set("success_url", `${origin}/shop/success?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${origin}/shop/cart`);
  form.set("shipping_address_collection[allowed_countries][0]", "US");
  form.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  form.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(shipping));
  form.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", STORE.currency);
  form.set("shipping_options[0][shipping_rate_data][display_name]", shipping === 0 ? "Free shipping" : "Standard shipping");

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok || !data?.url) throw new Error(data?.error?.message ?? `stripe ${res.status}`);
    return Response.json({ url: data.url });
  } catch (err) {
    console.error("checkout failed", err);
    return Response.json({ error: "Checkout is unavailable right now. Please try again." }, { status: 502 });
  }
}
