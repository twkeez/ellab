// Progress ring shared by the goals page and the hub spotlight.
export default function Ring({ pct, size = 72 }: { pct: number; size?: number }) {
  const cx = size / 2;
  const r = cx - 6;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <circle className="ring-track" cx={cx} cy={cx} r={r} />
      <circle
        className="ring-fill"
        cx={cx}
        cy={cx}
        r={r}
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ strokeDasharray: c, strokeDashoffset: c * (1 - pct) }}
      />
      <text className="ring-num" x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="central">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}
