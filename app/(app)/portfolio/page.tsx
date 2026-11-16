'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAuth } from '@/components/Providers';
import { AreaChart } from '@/components/AreaChart';
import { GradeBadge, Thumb } from '@/components/ItemBits';
import { IconCamera } from '@/components/Icons';
import { useMyItems } from '@/lib/useData';
import { daysAgo, fmtDay, metaLine, money, pct, qty } from '@/lib/format';
import { groupHistory, portfolioSeries, valueAsOf } from '@/lib/portfolio';
import type { Item } from '@/lib/types';

export default function PortfolioPage() {
  const { user } = useAuth();
  const { items: all, history, loading } = useMyItems(user?.id, true);
  const [range, setRange] = useState<'1m' | '3m' | '1y' | 'all'>('all');
  const items = useMemo(() => all.filter(i => i.status === 'owned'), [all]);
  const sold = useMemo(() => all.filter(i => i.status === 'sold'), [all]);
  const hist = useMemo(() => groupHistory(history), [history]);

  const total = items.reduce((s, i) => s + (Number(i.value) || 0) * qty(i), 0);
  const withCost = items.filter(i => i.purchase_price !== null);
  const cost = withCost.reduce((s, i) => s + Number(i.purchase_price) * qty(i), 0);
  const gain = withCost.reduce((s, i) => s + (Number(i.value) || 0) * qty(i), 0) - cost;
  const realized = sold.reduce((s, i) => s + ((Number(i.sold_price) || 0) - (Number(i.purchase_price) || 0)) * qty(i), 0);
  const pieces = items.reduce((s, i) => s + qty(i), 0);
  const series = portfolioSeries(items, hist, { '1m': 30, '3m': 90, '1y': 365, all: 0 }[range]);
  const change = series.length ? series[series.length - 1].v - series[0].v : 0;

  const byCat: Record<string, number> = {};
  items.forEach(i => { byCat[i.category] = (byCat[i.category] || 0) + (Number(i.value) || 0) * qty(i); });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] || 1;
  const movers = items.map(i => {
    const h = hist.get(i.id); const then = valueAsOf(h, daysAgo(30)) ?? h?.[0]?.v;
    if (!then || i.value === null) return null;
    return { i, d: (Number(i.value) - then) * qty(i), p: (Number(i.value) - then) / then };
  }).filter(m => m && Math.abs(m.d) > 0.004).sort((a, b) => Math.abs(b!.d) - Math.abs(a!.d)).slice(0, 5) as { i: Item; d: number; p: number }[];
  const top = items.slice().sort((a, b) => (Number(b.value) || 0) * qty(b) - (Number(a.value) || 0) * qty(a)).slice(0, 5);
  const recent = items.slice(0, 5);
  const stale = items.filter(i => !i.value_updated_at || Date.now() - Date.parse(i.value_updated_at) > 30 * 864e5).length;

  const Row = ({ i, right }: { i: Item; right: React.ReactNode }) => (
    <Link className="list-row" href={`/items/${i.id}`} style={{ textDecoration: 'none' }}>
      <Thumb path={i.photo_front} />
      <span><span className="name">{i.name}</span><br /><span className="meta">{metaLine(i) || i.category}</span></span>
      <span className="right">{right}</span>
    </Link>
  );

  if (loading) return <div className="working"><span className="spinner" />Loading your portfolio</div>;

  return (
    <>
      <div className="page-head">
        <div><h1>Portfolio</h1><p>What your collection is worth today and how it has moved.</p></div>
        <div className="actions"><Link className="btn primary" href="/scan"><IconCamera />Scan an item</Link></div>
      </div>
      {!items.length && (
        <div className="banner"><p><b>Your vault is empty.</b> Scan your first piece, add one by hand, or import a CSV in Settings.</p>
          <div className="actions"><Link className="btn primary sm" href="/scan">Scan</Link><Link className="btn sm" href="/items/new">Add manually</Link></div></div>
      )}
      <section className="tiles" aria-label="Summary">
        <div className="tile"><span className="label">Collection value</span><span className="big">{money(total, total >= 100)}</span>
          <span className="sub">{change === 0 ? 'No change' : <span style={{ color: `var(${change > 0 ? '--good' : '--bad'})` }}>{change > 0 ? '+' : ''}{money(change)}</span>} in range</span></div>
        <div className="tile"><span className="label">Cost basis</span><span className="big">{money(cost, cost >= 100)}</span><span className="sub">{withCost.length} of {items.length} items have a price paid</span></div>
        <div className="tile"><span className="label">Unrealized gain</span><span className="big" style={{ color: `var(${gain >= 0 ? '--good' : '--bad'})` }}>{gain >= 0 ? '+' : ''}{money(gain, Math.abs(gain) >= 100)}</span>
          <span className="sub">{cost ? pct(gain / cost) + ' on cost' : 'Add prices paid to track'}{sold.length ? ` · ${realized >= 0 ? '+' : ''}${money(realized)} realized` : ''}</span></div>
        <div className="tile"><span className="label">Pieces</span><span className="big">{pieces}</span><span className="sub">{items.length} entries · {cats.length} categor{cats.length === 1 ? 'y' : 'ies'}{stale ? ` · ${stale} due for repricing` : ''}</span></div>
      </section>
      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head"><h2>Value over time</h2>
            <div className="seg" role="group" aria-label="Range">
              {(['1m', '3m', '1y', 'all'] as const).map(r => <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>{r === 'all' ? 'All' : r.toUpperCase()}</button>)}
            </div></div>
          <AreaChart points={series} />
          <p className="small muted" style={{ margin: '10px 0 0' }}>Values come from Claude estimates cross-checked with eBay asking prices, or prices you set. Items reprice every 30 days.</p>
        </section>
        <section className="panel"><div className="panel-head"><h2>By category</h2></div>
          <div className="bars">
            {cats.length ? cats.map(([c, v]) => (
              <div className="bar-row" key={c}><span>{c}</span><span className="num">{money(v, v >= 100)} <span className="muted">{total ? Math.round(v / total * 100) : 0}%</span></span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(2, v / maxCat * 100).toFixed(1)}%` }} /></div></div>
            )) : <p className="muted">No items yet.</p>}
          </div>
        </section>
      </div>
      <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        <section className="panel"><div className="panel-head"><h2>Most valuable</h2><Link className="btn ghost sm" href="/collection">See all</Link></div>
          <div className="list">{top.map(i => <Row key={i.id} i={i} right={<><span className="num">{money((Number(i.value) || 0) * qty(i))}</span><br /><GradeBadge i={i} /></>} />)}</div></section>
        <section className="panel"><div className="panel-head"><h2>Movers, last 30 days</h2></div>
          <div className="list">{movers.length ? movers.map(m => <Row key={m.i.id} i={m.i} right={<><span className="num">{m.d > 0 ? '+' : ''}{money(m.d)}</span><br /><span className={`chip ${m.d > 0 ? 'good' : 'bad'}`}>{pct(m.p)}</span></>} />) : <p className="muted">No value changes yet. Movement shows up after items reprice.</p>}</div></section>
        <section className="panel"><div className="panel-head"><h2>Recently added</h2></div>
          <div className="list">{recent.map(i => <Row key={i.id} i={i} right={<span className="small muted">{fmtDay(i.created_at)}</span>} />)}</div></section>
      </div>
    </>
  );
}
