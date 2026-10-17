import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS, getProduct } from "@/lib/shop";
import ProductArt from "@/components/shop/ProductArt";
import AddToCart from "@/components/shop/AddToCart";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = getProduct((await params).slug);
  return product ? { title: product.name, description: product.blurb } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = getProduct((await params).slug);
  if (!product) notFound();

  return (
    <>
      <Link href="/shop" className="sh-back">← All products</Link>
      <article className="sh-product">
        <div className="sh-art sh-art-lg"><ProductArt product={product} /></div>
        <div className="sh-info">
          <h1>{product.name}</h1>
          <p className="sh-blurb">{product.blurb}</p>
          <AddToCart product={product} />
          <ul className="sh-details">
            {product.details.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </div>
      </article>
    </>
  );
}
