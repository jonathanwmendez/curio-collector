import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { askingPrices, ebayConfigured, itemQuery } from '@/lib/ebay';

/** On-demand eBay asking-price check for one of the signed-in user's items or wishes. */
export async function POST(req: Request) {
  if (!ebayConfigured()) return NextResponse.json({ error: 'eBay keys are not set up on this site yet.' }, { status: 501 });
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { kind, id } = await req.json().catch(() => ({}));
  const table = kind === 'wish' ? 'wishes' : 'items';
  const { data: row } = await sb.from(table).select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  try {
    const s = await askingPrices(itemQuery(row));
    const patch = kind === 'wish'
      ? { ask_median: s.median, ask_count: s.count, ask_checked_at: new Date().toISOString() }
      : { ask_query: s.query, ask_median: s.median, ask_low: s.low, ask_high: s.high, ask_count: s.count, ask_checked_at: new Date().toISOString() };
    await sb.from(table).update(patch).eq('id', id);
    return NextResponse.json(s);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'eBay check failed.' }, { status: 502 });
  }
}
