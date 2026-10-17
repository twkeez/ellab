// The storefront catalog. Every item is print-on-demand, so a POD service
// (Printful, Printify, Gelato…) prints and ships each order — no inventory.
// Prices live here and only here: the checkout route re-prices every cart
// line from this file, so the browser can never set its own price.

export const STORE = {
  name: "Sprig & Stem",
  tagline: "Botanical prints on everyday things",
  currency: "usd",
  // Printed to order, so shipping times include production time.
  shippingNote: "Printed to order · ships in 3–7 business days",
  freeShippingOver: 7500, // cents
  flatShipping: 595, // cents
};

export type Kind = "mug" | "tote" | "tee" | "print" | "stickers" | "journal";

export type Variant = { id: string; label: string; price: number }; // price in cents

export type Product = {
  slug: string;
  name: string;
  kind: Kind;
  blurb: string;
  details: string[];
  // Colors for the product illustration: base material + leaf ink.
  base: string;
  ink: string;
  variantLabel?: string;
  variants: Variant[];
};

export const PRODUCTS: Product[] = [
  {
    slug: "fern-mug",
    name: "Fiddlehead Mug",
    kind: "mug",
    blurb: "A curling fern frond wrapped around an 11 oz ceramic mug. Morning coffee, but leafier.",
    details: ["11 oz white ceramic", "Dishwasher and microwave safe", "Printed on both sides"],
    base: "#F6F3EC",
    ink: "#3E6B48",
    variants: [{ id: "11oz", label: "11 oz", price: 1800 }],
  },
  {
    slug: "monstera-tote",
    name: "Monstera Tote",
    kind: "tote",
    blurb: "One big monstera leaf on a sturdy cotton tote. Holds groceries, books, or a small plant.",
    details: ["100% cotton canvas", "15\" × 16\" with 20\" handles", "Holds up to 20 lbs"],
    base: "#EDE4D3",
    ink: "#2F5D46",
    variants: [{ id: "one-size", label: "One size", price: 2400 }],
  },
  {
    slug: "ginkgo-tee",
    name: "Ginkgo Tee",
    kind: "tee",
    blurb: "A scatter of ginkgo leaves across a soft, relaxed-fit unisex tee.",
    details: ["Unisex fit", "100% combed cotton", "Machine wash cold, tumble dry low"],
    base: "#E7E1D6",
    ink: "#C08A2B",
    variantLabel: "Size",
    variants: [
      { id: "s", label: "S", price: 2800 },
      { id: "m", label: "M", price: 2800 },
      { id: "l", label: "L", price: 2800 },
      { id: "xl", label: "XL", price: 2800 },
      { id: "2xl", label: "2XL", price: 3200 },
    ],
  },
  {
    slug: "pressed-leaves-print",
    name: "Pressed Leaves Print",
    kind: "print",
    blurb: "A herbarium-style study of three leaves on matte archival paper. Frame not included.",
    details: ["Matte archival paper", "Ships rolled in a tube", "Frame not included"],
    base: "#FBF8F1",
    ink: "#4F6F3A",
    variantLabel: "Size",
    variants: [
      { id: "8x10", label: "8 × 10 in", price: 2200 },
      { id: "12x16", label: "12 × 16 in", price: 3200 },
      { id: "18x24", label: "18 × 24 in", price: 4600 },
    ],
  },
  {
    slug: "sprout-stickers",
    name: "Sprout Sticker Sheet",
    kind: "stickers",
    blurb: "Six little sprouts, leaves and seedlings for laptops, water bottles and notebooks.",
    details: ["Kiss-cut vinyl", "Water resistant", "Sheet is 4\" × 6\""],
    base: "#FFFFFF",
    ink: "#5B8C4A",
    variants: [{ id: "sheet", label: "One sheet", price: 600 }],
  },
  {
    slug: "olive-branch-journal",
    name: "Olive Branch Journal",
    kind: "journal",
    blurb: "A hardcover journal with an olive branch on the cover and lined pages inside.",
    details: ["Hardcover, 5.5\" × 8.5\"", "Lined pages", "Lays flat when open"],
    base: "#5E6B4E",
    ink: "#EDE6D3",
    variants: [{ id: "lined", label: "Lined", price: 2200 }],
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getVariant(slug: string, variantId: string): { product: Product; variant: Variant } | undefined {
  const product = getProduct(slug);
  const variant = product?.variants.find((v) => v.id === variantId);
  return product && variant ? { product, variant } : undefined;
}

export function fromPrice(p: Product): number {
  return Math.min(...p.variants.map((v) => v.price));
}

export function money(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: STORE.currency.toUpperCase() }).format(cents / 100);
}

export function shippingFor(subtotal: number): number {
  return subtotal === 0 || subtotal >= STORE.freeShippingOver ? 0 : STORE.flatShipping;
}

// What the browser stores and sends: references only, never prices.
export type CartLine = { slug: string; variant: string; qty: number };

export const MAX_QTY = 10;
