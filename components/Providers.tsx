'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

type AuthCtx = { user: User | null; profile: Profile | null; loading: boolean; refreshProfile: () => Promise<void> };
const Auth = createContext<AuthCtx>({ user: null, profile: null, loading: true, refreshProfile: async () => {} });
type UiCtx = { toast: (msg: string) => void; confirm: (msg: string, ok?: string) => Promise<boolean> };
const Ui = createContext<UiCtx>({ toast: () => {}, confirm: async () => false });

export const useAuth = () => useContext(Auth);
export const useUi = () => useContext(Ui);

export function Providers({ children }: { children: React.ReactNode }) {
  const sb = supabaseBrowser();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [dialog, setDialog] = useState<{ msg: string; ok: string; resolve: (v: boolean) => void } | null>(null);
  const timer = useRef<any>(null);

  const loadProfile = useCallback(async (u: User | null) => {
    if (!u) { setProfile(null); return; }
    const { data } = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
    setProfile(data as Profile);
  }, [sb]);

  useEffect(() => {
    sb.auth.getUser().then(async ({ data }) => { setUser(data.user); await loadProfile(data.user); setLoading(false); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u); loadProfile(u);
    });
    return () => sub.subscription.unsubscribe();
  }, [sb, loadProfile]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg); clearTimeout(timer.current); timer.current = setTimeout(() => setToastMsg(''), 4200);
  }, []);
  const confirm = useCallback((msg: string, ok = 'Delete') => new Promise<boolean>(resolve => setDialog({ msg, ok, resolve })), []);
  const close = (v: boolean) => { dialog?.resolve(v); setDialog(null); };

  return (
    <Auth.Provider value={{ user, profile, loading, refreshProfile: () => loadProfile(user) }}>
      <Ui.Provider value={{ toast, confirm }}>
        {children}
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
        {dialog && (
          <>
            <div className="scrim" style={{ zIndex: 59 }} onClick={() => close(false)} />
            <div className="modal" onClick={e => { if (e.target === e.currentTarget) close(false); }}>
              <div className="modal-card" role="dialog" aria-modal="true">
                <h2>{dialog.msg}</h2>
                <p className="muted" style={{ margin: 0 }}>This can&apos;t be undone.</p>
                <div className="actions" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn" type="button" onClick={() => close(false)}>Cancel</button>
                  <button className="btn primary" type="button" onClick={() => close(true)} autoFocus>{dialog.ok}</button>
                </div>
              </div>
            </div>
          </>
        )}
      </Ui.Provider>
    </Auth.Provider>
  );
}
