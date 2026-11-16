import { compact, daysAgo, fmtShortDay, money, parseDay } from '@/lib/format';

function niceTicks(lo: number, hi: number, n: number) {
  const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out: number[] = [];
  for (let v = a; v <= b + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

export function AreaChart({ points, h = 220, w = 640 }: { points: { t: string; v: number }[]; h?: number; w?: number }) {
  if (!points.length) return null;
  let pts = points;
  if (pts.length === 1) pts = [{ t: daysAgo(30), v: pts[0].v }, pts[0]];
  const pl = 54, pr = 14, pt = 12, pb = 26;
  const vs = pts.map(p => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi === lo) { hi = hi * 1.1 + 1; lo = Math.max(0, lo * 0.9); }
  const padv = (hi - lo) * 0.12; lo = Math.max(0, lo - padv); hi = hi + padv;
  const ticks = niceTicks(lo, hi, 4); lo = ticks[0]; hi = ticks[ticks.length - 1];
  const t0 = parseDay(pts[0].t).getTime(), t1 = parseDay(pts[pts.length - 1].t).getTime();
  const X = (t: string) => pl + (w - pl - pr) * ((parseDay(t).getTime() - t0) / ((t1 - t0) || 1));
  const Y = (v: number) => pt + (h - pt - pb) * (1 - (v - lo) / ((hi - lo) || 1));
  const line = pts.map((p, i) => (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
  const area = `${line} L${X(pts[pts.length - 1].t).toFixed(1)} ${h - pb} L${X(pts[0].t).toFixed(1)} ${h - pb} Z`;
  const xi = [0, Math.floor((pts.length - 1) / 2), pts.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const last = pts[pts.length - 1];
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Value over time, latest ${money(last.v)}`}>
        {ticks.map(v => (
          <g key={v}>
            <line className="grid" x1={pl} x2={w - pr} y1={Y(v)} y2={Y(v)} />
            <text className="axis" x={pl - 8} y={Y(v) + 4} textAnchor="end">{compact(v)}</text>
          </g>
        ))}
        <path className="area" d={area} />
        <path className="line" d={line} />
        {xi.map((i, k) => (
          <text key={i} className="axis" x={X(pts[i].t)} y={h - 6} textAnchor={k === 0 ? 'start' : k === xi.length - 1 ? 'end' : 'middle'}>{fmtShortDay(pts[i].t)}</text>
        ))}
        <circle className="end" cx={X(last.t)} cy={Y(last.v)} r={5} />
      </svg>
    </div>
  );
}
