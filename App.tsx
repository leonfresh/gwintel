
import React, { useEffect, useMemo, useState } from 'react';
import { StrategyLog, LogType } from './types';
import StrategyForm from './components/StrategyForm';
import StrategyCard from './components/StrategyCard';
import HeroAutocomplete from './components/HeroAutocomplete';
import AuthModal from './components/AuthModal';
import { getSupabaseBrowserClient } from './lib/supabase/browserClient';

type DbStrategyLogRow = {
  id: string;
  enemy_team: string[];
  counter_team: string[];
  type: LogType;
  notes: string;
  votes: number;
  author_email: string | null;
  created_at: string;
};

function toStrategyLog(row: DbStrategyLogRow): StrategyLog {
  return {
    id: row.id,
    enemyTeam: row.enemy_team,
    counterTeam: row.counter_team,
    type: row.type,
    notes: row.notes,
    votes: row.votes,
    author: row.author_email ?? 'Unknown',
    createdAt: new Date(row.created_at).getTime(),
  };
}

function isEmailVerified(user: unknown): boolean {
  const u = user as { email_confirmed_at?: string | null; confirmed_at?: string | null } | null;
  return Boolean(u?.email_confirmed_at || u?.confirmed_at);
}

interface AddLogState {
  enemyIds?: string[];
  type?: LogType;
}

const App: React.FC = () => {
  const [logs, setLogs] = useState<StrategyLog[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [addState, setAddState] = useState<AddLogState>({});
  const [filterHeroId, setFilterHeroId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<'post' | 'vote' | 'generic'>('generic');
  const [loading, setLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authVerified, setAuthVerified] = useState(false);
  const [supabaseReady, setSupabaseReady] = useState(true);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setSupabaseReady(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [{ data: sessionData }, { data: userData }] = await Promise.all([
        client.auth.getSession(),
        client.auth.getUser(),
      ]);

      if (cancelled) return;
      const sessionUser = sessionData.session?.user ?? null;
      const user = userData.user ?? sessionUser;
      setAuthEmail(user?.email ?? null);
      setAuthVerified(isEmailVerified(user));

      const { data, error } = await client
        .from('strategy_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error('Failed to load logs', error);
        setLogs([]);
      } else {
        setLogs((data as DbStrategyLogRow[]).map(toStrategyLog));
      }
      setLoading(false);
    };

    load();

    const { data: sub } = client.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setAuthEmail(user?.email ?? null);
      setAuthVerified(isEmailVerified(user));
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const ensureVerified = (reason: 'post' | 'vote') => {
    if (!authEmail) {
      setAuthModalReason(reason);
      setAuthModalOpen(true);
      return false;
    }
    if (!authVerified) {
      setAuthModalReason(reason);
      setAuthModalOpen(true);
      return false;
    }
    return true;
  };

  const handleCreateLog = async (data: Pick<StrategyLog, 'enemyTeam' | 'counterTeam' | 'type' | 'notes'>) => {
    if (!ensureVerified('post')) return;

    const client = getSupabaseBrowserClient();
    if (!client) return;

    const { data: userData } = await client.auth.getUser();
    const user = userData.user;
    if (!user || !isEmailVerified(user)) {
      setAuthModalReason('post');
      setAuthModalOpen(true);
      return;
    }

    const { data: inserted, error } = await client
      .from('strategy_logs')
      .insert({
        enemy_team: data.enemyTeam,
        counter_team: data.counterTeam,
        type: data.type,
        notes: data.notes,
        author_id: user.id,
        author_email: user.email,
      })
      .select('*')
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    const newLog = toStrategyLog(inserted as DbStrategyLogRow);
    setLogs((prev) => [newLog, ...prev]);
    setShowForm(false);
    setAddState({});
  };

  const handleVote = async (id: string, type: 'up' | 'down') => {
    if (!ensureVerified('vote')) return;

    const client = getSupabaseBrowserClient();
    if (!client) return;

    const { data: userData } = await client.auth.getUser();
    const user = userData.user;
    if (!user || !isEmailVerified(user)) {
      setAuthModalReason('vote');
      setAuthModalOpen(true);
      return;
    }

    const desired = type === 'up' ? 1 : -1;

    const { data: existingVote, error: existingError } = await client
      .from('log_votes')
      .select('value')
      .eq('log_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingError) {
      alert(existingError.message);
      return;
    }

    const oldValue = (existingVote as { value?: number } | null)?.value ?? 0;

    if (oldValue === desired) {
      const { error } = await client
        .from('log_votes')
        .delete()
        .eq('log_id', id)
        .eq('user_id', user.id);
      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await client
        .from('log_votes')
        .upsert(
          { log_id: id, user_id: user.id, value: desired },
          { onConflict: 'log_id,user_id' }
        );
      if (error) {
        alert(error.message);
        return;
      }
    }

    // Pull the authoritative total (trigger-maintained) and update UI.
    const { data: updatedLog, error: updatedError } = await client
      .from('strategy_logs')
      .select('id,votes')
      .eq('id', id)
      .single();

    if (updatedError) {
      alert(updatedError.message);
      return;
    }

    setLogs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, votes: (updatedLog as { votes: number }).votes } : l))
    );
  };

  const openAddLog = (enemyIds?: string[], type?: LogType) => {
    if (!ensureVerified('post')) return;
    setAddState({ enemyIds, type });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Group logs by unique enemy squad
  const groupedLogs = useMemo(() => {
    const groups: Record<string, StrategyLog[]> = {};
    
    const filtered = filterHeroId 
      ? logs.filter(l => l.enemyTeam.includes(filterHeroId) || l.counterTeam.includes(filterHeroId))
      : logs;

    filtered.forEach(log => {
      const key = [...log.enemyTeam].sort().join(',');
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });

    return Object.entries(groups).sort((a, b) => {
      const votesA = a[1].reduce((sum, l) => sum + l.votes, 0);
      const votesB = b[1].reduce((sum, l) => sum + l.votes, 0);
      return votesB - votesA;
    });
  }, [logs, filterHeroId]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
      <AuthModal
        open={authModalOpen}
        initialTab="login"
        reason={authModalReason}
        onClose={() => setAuthModalOpen(false)}
      />

      {!supabaseReady ? (
        <div className="mb-8 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-200">
          Missing Supabase env vars. Add <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and{' '}
          <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> in <span className="font-mono">.env.local</span>.
        </div>
      ) : null}

      <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(37,99,235,0.4)] rotate-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white italic uppercase leading-none">
              REBIRTH<br/><span className="text-blue-500">GW INTEL</span>
            </h1>
          </div>
          <p className="text-slate-400 max-w-lg font-medium border-l-2 border-slate-700 pl-6">
            The elite collaborative vault for <span className="text-blue-400 font-bold italic">Seven Knights Rebirth</span> guild operations. Counter the meta or report critical failures.
          </p>
        </div>
        
        {!showForm && (
          <button
            onClick={() => openAddLog()}
            className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-2xl hover:scale-105 active:scale-95 flex items-center gap-3 uppercase tracking-widest text-sm italic"
          >
            <span>NEW SQUAD REPORT</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
          </button>
        )}
      </header>

      <main className="space-y-12">
        {loading ? (
          <div className="p-10 rounded-3xl border border-slate-800 bg-slate-900/40 text-slate-400">
            Loading intelligence...
          </div>
        ) : null}
        {showForm && (
          <StrategyForm 
            onSubmit={handleCreateLog} 
            onCancel={() => { setShowForm(false); setAddState({}); }} 
            initialEnemyTeam={addState.enemyIds}
            initialType={addState.type}
          />
        )}

        {/* Improved Filter UI */}
        <div className="bg-slate-800/60 p-6 rounded-[2rem] border-2 border-slate-700/50 flex flex-col md:flex-row items-center gap-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3 text-slate-400 whitespace-nowrap">
            <div className="p-2 bg-slate-700 rounded-lg">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Intel Search</span>
          </div>
          <div className="flex-1 w-full flex items-center gap-4">
            <HeroAutocomplete 
              onSelect={(h) => setFilterHeroId(h.id)} 
              placeholder="Search hero identity..."
              className="flex-1"
            />
            {filterHeroId && (
              <button
                onClick={() => setFilterHeroId(null)}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-black transition-all border border-slate-600"
              >
                RESET
              </button>
            )}
          </div>
        </div>

        <div className="space-y-12">
          {groupedLogs.length > 0 ? (
            groupedLogs.map(([key, logs]) => (
              <StrategyCard 
                key={key} 
                enemyIds={key.split(',')} 
                logs={logs} 
                onVote={handleVote} 
                onAddLog={openAddLog}
              />
            ))
          ) : (
            <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-700 bg-slate-800/20 rounded-[3rem] border-4 border-dashed border-slate-800">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <p className="text-xl font-black italic uppercase tracking-widest">No Intelligence Data</p>
              <button onClick={() => openAddLog()} className="mt-6 text-blue-500 font-bold hover:underline">Click here to start a new squad record</button>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-32 py-12 border-t-2 border-slate-800/80 text-center">
        <div className="flex justify-center gap-8 mb-6 opacity-20 grayscale">
          {/* Mock Brand/Guild Logos can go here */}
          <div className="w-10 h-10 bg-white rounded-full"></div>
          <div className="w-10 h-10 bg-white rounded-full"></div>
          <div className="w-10 h-10 bg-white rounded-full"></div>
        </div>
        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em]">
          Classified Intelligence Protocol &copy; 2024 Rebirth Alliance
        </p>
      </footer>
    </div>
  );
};

export default App;
