// Stand-in product imagery, drawn in SVG so the store works with no photo
// assets. Swap for the mockups your print-on-demand service generates.

import type { Product } from "@/lib/shop";

const OUTLINE = "rgba(40,36,30,0.28)";

function Leaf({ x, y, r = 0, s = 1, ink, vein }: { x: number; y: number; r?: number; s?: number; ink: string; vein: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0,-30 C19,-17 19,17 0,30 C-19,17 -19,-17 0,-30 Z" fill={ink} />
      <path d="M0,-24 L0,26" stroke={vein} strokeWidth={1.6} strokeLinecap="round" />
    </g>
  );
}

export default function ProductArt({ product, className }: { product: Product; className?: string }) {
  const { kind, base, ink } = product;
  const leaf = (x: number, y: number, r?: number, s?: number) => <Leaf x={x} y={y} r={r} s={s} ink={ink} vein={base} />;

  let body: React.ReactNode;
  switch (kind) {
    case "mug":
      body = (
        <>
          <path d="M140 82 h12 a20 20 0 0 1 0 40 h-12" fill="none" stroke={base} strokeWidth={11} />
          <path d="M140 82 h12 a20 20 0 0 1 0 40 h-12" fill="none" stroke={OUTLINE} strokeWidth={1} />
          <rect x={46} y={60} width={96} height={104} rx={8} fill={base} stroke={OUTLINE} />
          <path d="M70 150 C 80 120, 100 100, 104 76" fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
          {leaf(84, 128, -50, 0.42)}
          {leaf(96, 106, 40, 0.4)}
          {leaf(102, 86, -30, 0.36)}
          <circle cx={106} cy={74} r={5} fill="none" stroke={ink} strokeWidth={2.4} />
        </>
      );
      break;
    case "tote":
      body = (
        <>
          <path d="M72 76 C 72 36, 128 36, 128 76" fill="none" stroke={base} strokeWidth={7} />
          <path d="M72 76 C 72 36, 128 36, 128 76" fill="none" stroke={OUTLINE} strokeWidth={1} />
          <rect x={48} y={74} width={104} height={110} rx={3} fill={base} stroke={OUTLINE} />
          <g transform="translate(100 130) rotate(-12)">
            <path d="M0,-40 C34,-34 40,8 0,40 C-40,8 -34,-34 0,-40 Z" fill={ink} />
            <path d="M0,-34 L0,46" stroke={base} strokeWidth={2} />
            {[-22, -8, 6, 20].map((y) => (
              <g key={y}>
                <path d={`M0 ${y} L22 ${y - 10}`} stroke={base} strokeWidth={5} />
                <path d={`M0 ${y} L-22 ${y - 10}`} stroke={base} strokeWidth={5} />
              </g>
            ))}
          </g>
        </>
      );
      break;
    case "tee":
      body = (
        <>
          <path
            d="M74 40 L52 50 L28 82 L50 96 L60 84 L60 172 L140 172 L140 84 L150 96 L172 82 L148 50 L126 40 C 120 54, 80 54, 74 40 Z"
            fill={base}
            stroke={OUTLINE}
            strokeLinejoin="round"
          />
          {leaf(86, 96, -30, 0.34)}
          {leaf(110, 88, 25, 0.3)}
          {leaf(100, 116, 60, 0.32)}
          {leaf(118, 124, -10, 0.26)}
          {leaf(82, 130, 15, 0.26)}
        </>
      );
      break;
    case "print":
      body = (
        <>
          <rect x={50} y={26} width={100} height={148} fill={base} stroke={OUTLINE} />
          <rect x={60} y={36} width={80} height={128} fill="none" stroke={ink} strokeOpacity={0.35} />
          {leaf(80, 92, -14, 0.7)}
          {leaf(102, 84, 4, 0.82)}
          {leaf(122, 94, 18, 0.66)}
          <path d="M80 114 L80 136 M102 108 L102 140 M122 114 L122 136" stroke={ink} strokeWidth={1.4} />
          <rect x={84} y={150} width={32} height={3} fill={ink} fillOpacity={0.5} />
        </>
      );
      break;
    case "stickers":
      body = (
        <>
          <rect x={46} y={30} width={108} height={146} rx={6} fill={base} stroke={OUTLINE} />
          {[
            [76, 62], [124, 62], [76, 104], [124, 104], [76, 146], [124, 146],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={18} fill="#F4F1EA" stroke={OUTLINE} strokeDasharray="2 2" />
              <Leaf x={x} y={y} r={i * 37 - 40} s={0.38} ink={ink} vein="#F4F1EA" />
            </g>
          ))}
        </>
      );
      break;
    case "journal":
      body = (
        <>
          <rect x={56} y={30} width={96} height={142} rx={5} fill={base} stroke={OUTLINE} />
          <rect x={56} y={30} width={10} height={142} fill="#000" fillOpacity={0.14} />
          <path d="M84 146 C 96 120, 110 92, 132 62" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" />
          {[
            [96, 126, -60], [104, 112, 40], [112, 98, -50], [120, 86, 40], [126, 74, -40],
          ].map(([x, y, r], i) => (
            <g key={i}>{leaf(x, y, r, 0.3)}</g>
          ))}
        </>
      );
      break;
  }

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={product.name}>
      {body}
    </svg>
  );
}
