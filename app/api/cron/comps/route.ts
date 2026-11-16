import { NextResponse } from 'next/server';
import { supabaseAnon } from '@/lib/supabase/server';
import { askingPrices, ebayConfigured } from '@/lib/ebay';

export const maxDuration = 60;

/** Nightly: refresh eBay asking prices for items and wishes not checked in the last 7 days. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!ebayConfigured()) return NextResponse.json({ skipped: 'eBay keys not configured' });
  const sb = supabaseAnon();
  const { data: due, error } = await sb.rpc('cron_due_comps', { p_secret: secret, p_limit: 120 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const started = Date.now(); let done = 0, failed = 0;
  const queue = [...(due || [])];
  async function worker() {
    while (queue.length && Date.now() - started < 50_000) {
      const r: any = queue.shift();
      try {
        const s = await askingPrices(r.query);
        await sb.rpc('cron_save_comps', { p_secret: secret, p_kind: r.kind, p_id: r.id, p_query: s.query, p_median: s.median, p_low: s.low, p_high: s.high, p_count: s.count });
        done++;
      } catch { failed++; }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return NextResponse.json({ due: due?.length || 0, done, failed, remaining: queue.length });
}
