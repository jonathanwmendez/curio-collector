'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from './supabase/client';
import type { HistoryPoint, Item, Wish } from './types';

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

export function useMyItems(userId?: string, withHistory = false) {
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!userId) return;
    const sb = supabaseBrowser();
    try {
      const [its, hist] = await Promise.all([
        fetchAll<Item>((a, b) => sb.from('items').select('*').eq('user_id', userId).order('created_at', { ascending: false }).range(a, b)),
        withHistory ? fetchAll<HistoryPoint>((a, b) => sb.from('value_history').select('item_id,t,value,source').eq('user_id', userId).order('t').range(a, b)) : Promise.resolve([])
      ]);
      setItems(its); setHistory(hist); setError('');
    } catch (e: any) { setError(e.message || 'Could not load your items.'); }
    setLoading(false);
  }, [userId, withHistory]);
  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('curio:items-changed', h);
    return () => window.removeEventListener('curio:items-changed', h);
  }, [load]);
  return { items, setItems, history, loading, error, reload: load };
}

export function useMyWishes(userId?: string) {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabaseBrowser().from('wishes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setWishes((data || []) as Wish[]); setLoading(false);
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  return { wishes, setWishes, loading, reload: load };
}
