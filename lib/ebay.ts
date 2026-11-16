// eBay Browse API: current fixed-price asking prices. Sold data needs the restricted Marketplace Insights API.
let cached: { token: string; exp: number } | null = null;

export const ebayConfigured = () => !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);

async function token() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope')
  });
  if (!res.ok) throw new Error(`eBay auth failed (${res.status})`);
  const j = await res.json();
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

export type AskStats = { query: string; count: number; median: number | null; low: number | null; high: number | null; sample: { title: string; price: number; url: string }[] };

const quantile = (arr: number[], q: number) => {
  if (!arr.length) return null;
  const pos = (arr.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return Math.round((arr[lo] + (arr[hi] - arr[lo]) * (pos - lo)) * 100) / 100;
};

export async function askingPrices(query: string): Promise<AskStats> {
  const q = query.replace(/\s+/g, ' ').trim().slice(0, 300);
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=50&filter=${encodeURIComponent('buyingOptions:{FIXED_PRICE},priceCurrency:USD')}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await token()}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } });
  if (!res.ok) throw new Error(`eBay search failed (${res.status})`);
  const j = await res.json();
  const rows = (j.itemSummaries || [])
    .map((s: any) => ({ title: String(s.title || ''), price: parseFloat(s.price?.value), url: String(s.itemWebUrl || '') }))
    .filter((r: any) => Number.isFinite(r.price) && r.price > 0);
  let prices = rows.map((r: any) => r.price).sort((a: number, b: number) => a - b);
  if (prices.length >= 10) { const cut = Math.floor(prices.length * 0.1); prices = prices.slice(cut, prices.length - cut); }
  return {
    query: q, count: rows.length, median: quantile(prices, 0.5), low: quantile(prices, 0.25), high: quantile(prices, 0.75),
    sample: rows.sort((a: any, b: any) => a.price - b.price).slice(0, 8)
  };
}

export function itemQuery(i: any) {
  const parts = [i.year, i.brand, i.set_name !== i.brand ? i.set_name : '', i.subject, i.number ? '#' + String(i.number).replace(/^#/, '') : '', i.variant];
  if (i.grader) parts.push(`${i.grader} ${i.grade || ''}`);
  const q = parts.filter(Boolean).join(' ').trim();
  return q || i.name;
}
