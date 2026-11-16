const P = (d: React.ReactNode) => (props: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>{d}</svg>;
const s = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const IconPortfolio = P(<path d="M4 19V10M10 19V5M16 19v-7M21 19H3" {...s} />);
export const IconGrid = P(<><rect x="3" y="4" width="7" height="7" rx="1.5" {...s} /><rect x="14" y="4" width="7" height="7" rx="1.5" {...s} /><rect x="3" y="14" width="7" height="7" rx="1.5" {...s} /><rect x="14" y="14" width="7" height="7" rx="1.5" {...s} /></>);
export const IconScan = P(<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" {...s} /><circle cx="12" cy="12" r="3.5" {...s} /></>);
export const IconHeart = P(<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" {...s} />);
export const IconFeed = P(<><rect x="4" y="4" width="16" height="16" rx="3" {...s} /><path d="M8 9h8M8 13h8M8 17h5" {...s} /></>);
export const IconUser = P(<><circle cx="12" cy="8" r="4" {...s} /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" {...s} /></>);
export const IconSettings = P(<><circle cx="12" cy="12" r="3" {...s} /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" {...s} strokeWidth={1.6} /></>);
export const IconSearch = P(<><circle cx="11" cy="11" r="6.5" {...s} /><path d="m16 16 4 4" {...s} /></>);
export const IconPlus = P(<path d="M12 5v14M5 12h14" {...s} />);
export const IconCamera = P(<><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" {...s} strokeWidth={1.8} /><circle cx="12" cy="13" r="3.5" {...s} strokeWidth={1.8} /></>);
export const IconSpark = P(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" {...s} strokeWidth={1.8} />);
export const IconClose = P(<path d="M6 6l12 12M18 6 6 18" {...s} />);
export const IconCheck = P(<path d="m5 12 5 5 9-10" {...s} strokeWidth={3} />);
export const IconStar = (props: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" {...props}><path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3Z" /></svg>;
export const BrandMark = () => (
  <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2.5" stroke="#E2B45C" strokeWidth="2" /><rect x="7.5" y="6.5" width="9" height="7" rx="1" fill="#E2B45C" /><path d="M8 17h8" stroke="#E2B45C" strokeWidth="2" strokeLinecap="round" /></svg></span>
);
