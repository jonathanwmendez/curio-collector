import Link from 'next/link';
import { gainOf, metaLine, money, photoUrl, qty } from '@/lib/format';
import type { Item } from '@/lib/types';
import { IconCheck, IconStar } from './Icons';

export function GradeBadge({ i }: { i: Partial<Item> }) {
  if (i.grader && (i.grader || i.grade)) return <span className="slab">{[i.grader, i.grade].filter(Boolean).join(' ')}</span>;
  if (i.sealed) return <span className="chip">Sealed</span>;
  if (i.condition) return <span className="chip">{i.condition}</span>;
  return null;
}

export function Thumb({ path, className, alt = '' }: { path?: string | null; className?: string; alt?: string }) {
  const src = photoUrl(path);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className={className} src={src} alt={alt} loading="lazy" /> : <span className={(className || '') + ' thumb-ph'} />;
}

export function ItemCard({ i, href, onClick, selectMode, selected, showValue = true }: {
  i: Item; href?: string; onClick?: () => void; selectMode?: boolean; selected?: boolean; showValue?: boolean;
}) {
  const g = gainOf(i);
  const inner = (
    <>
      <Thumb path={i.photo_front} className="img" />
      <span className="badges">
        {i.status === 'sold' ? <span className="chip">Sold</span> : <span />}
        {i.featured && !selectMode && <span className="chip ex" title="Featured on your profile"><IconStar /></span>}
      </span>
      {selectMode && <span className="sel">{selected && <IconCheck width={14} height={14} />}</span>}
      <span className="body">
        <span className="name">{i.name}</span>
        <span className="meta">{metaLine(i) || i.category}{qty(i) > 1 ? ` · ×${qty(i)}` : ''}</span>
        <span className="foot">
          {showValue ? <span className="val">{money((i.value || 0) * qty(i))}</span> : <span />}
          <GradeBadge i={i} />
        </span>
        {showValue && g !== null && <span className="small" style={{ color: `var(${g >= 0 ? '--good' : '--bad'})` }}>{g >= 0 ? '+' : ''}{money(g)} vs paid</span>}
      </span>
    </>
  );
  const cls = `card ${selected ? 'selected' : ''}`;
  if (href && !selectMode) return <Link className={cls} href={href}>{inner}</Link>;
  return <button className={cls} type="button" onClick={onClick} aria-pressed={selectMode ? !!selected : undefined}>{inner}</button>;
}

export function Avatar({ path, name, lg }: { path?: string | null; name?: string; lg?: boolean }) {
  const src = photoUrl(path);
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img className={`avatar ${lg ? 'lg' : ''}`} src={src} alt="" />;
  return <span className={`avatar ${lg ? 'lg' : ''}`} aria-hidden="true">{(name || '?').slice(0, 1).toUpperCase()}</span>;
}
