'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Lock,
  LogIn,
  RefreshCw,
  Save,
  Shield,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';

const SALARY_CAP = 50000;
const REQUIRED_GOLFERS = 6;
const STORAGE_PREFIX = 'golf-pool-live';
const SALARY_MIN = 5000;
const SALARY_MAX = 10800;
const VEGAS_WEIGHT = 0.65;
const WORLD_RANK_WEIGHT = 0.35;
const DEFAULT_JOIN_CODE = 'MAJORS2026';

const TOURNAMENTS = [
  {
    id: 'players',
    name: 'THE PLAYERS Championship',
    venue: 'TPC Sawgrass',
    lockAt: '2026-03-12T07:40:00',
  },
  {
    id: 'masters',
    name: 'The Masters',
    venue: 'Augusta National',
    lockAt: '2026-04-09T07:30:00',
  },
  {
    id: 'pga',
    name: 'PGA Championship',
    venue: 'Aronimink',
    lockAt: '2026-05-14T07:20:00',
  },
  {
    id: 'us-open',
    name: 'U.S. Open',
    venue: 'Shinnecock Hills',
    lockAt: '2026-06-18T07:15:00',
  },
  {
    id: 'open',
    name: 'The Open Championship',
    venue: 'Royal Birkdale',
    lockAt: '2026-07-16T06:35:00',
  },
] as const;

const PLAYER_POOL = [
  { id: 1, name: 'Scottie Scheffler', defaultOdds: '+450', worldRank: 1 },
  { id: 2, name: 'Rory McIlroy', defaultOdds: '+900', worldRank: 2 },
  { id: 3, name: 'Xander Schauffele', defaultOdds: '+1200', worldRank: 3 },
  { id: 4, name: 'Collin Morikawa', defaultOdds: '+1600', worldRank: 4 },
  { id: 5, name: 'Ludvig Aberg', defaultOdds: '+1800', worldRank: 5 },
  { id: 6, name: 'Tommy Fleetwood', defaultOdds: '+3500', worldRank: 12 },
  { id: 7, name: 'Patrick Cantlay', defaultOdds: '+3000', worldRank: 10 },
  { id: 8, name: 'Hideki Matsuyama', defaultOdds: '+4000', worldRank: 13 },
  { id: 9, name: 'Brooks Koepka', defaultOdds: '+4500', worldRank: 18 },
  { id: 10, name: 'Jordan Spieth', defaultOdds: '+5000', worldRank: 22 },
  { id: 11, name: 'Will Zalatoris', defaultOdds: '+5500', worldRank: 28 },
  { id: 12, name: 'Min Woo Lee', defaultOdds: '+7000', worldRank: 34 },
  { id: 13, name: 'Sahith Theegala', defaultOdds: '+8000', worldRank: 30 },
  { id: 14, name: 'Akshay Bhatia', defaultOdds: '+9000', worldRank: 37 },
] as const;

const DEFAULT_ROSTERS: Record<string, number[]> = {
  players: [1, 2, 8, 10, 12, 14],
  masters: [1, 2, 4, 8, 10, 12],
  pga: [1, 3, 5, 8, 10, 11],
  'us-open': [1, 2, 5, 7, 10, 14],
  open: [2, 3, 5, 6, 8, 12],
};

type TournamentId = (typeof TOURNAMENTS)[number]['id'];
type MainTab = 'Standings' | 'My entries' | 'Details' | 'Commissioner console';

type FeedRow = {
  position: string;
  score: string;
  thru: string;
  total?: string;
  canonicalName?: string;
};

type FeedResponse = {
  fetchedAt: string;
  players: FeedRow[];
  odds: Array<{
    canonicalName: string;
    odds: string;
  }>;
  oddsSource?: string;
  source: string;
  status: string;
};

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  poolIds: string[];
  rosters: Partial<Record<TournamentId, number[]>>;
};

type PoolInfo = {
  id: string;
  name: string;
  joinCode: string;
};

type PoolEntry = {
  id: string;
  name: string;
  rosters: Partial<Record<TournamentId, number[]>>;
};

const STATIC_ENTRIES: PoolEntry[] = [
  { id: 'static-2', name: 'Brady S.', rosters: { pga: [1, 3, 5, 7, 9, 11] } },
  { id: 'static-3', name: 'Megan T.', rosters: { pga: [2, 4, 6, 8, 12, 13] } },
  { id: 'static-4', name: 'Ryan H.', rosters: { pga: [3, 4, 5, 9, 10, 14] } },
];

type SessionPayload = {
  user: AuthUser | null;
  pool: PoolInfo | null;
  entries: PoolEntry[];
  error?: string;
};

function parseAmericanOdds(odds: string) {
  const numeric = Number(odds.replace('+', ''));

  if (Number.isNaN(numeric) || numeric === 0) {
    return 0;
  }

  if (numeric > 0) {
    return 100 / (numeric + 100);
  }

  return Math.abs(numeric) / (Math.abs(numeric) + 100);
}

function normalizeValue(value: number, min: number, max: number) {
  if (max === min) {
    return 1;
  }

  return (value - min) / (max - min);
}

function buildPricedPlayers(
  playerPool: ReadonlyArray<{
    id: number;
    name: string;
    defaultOdds: string;
    worldRank: number;
  }>,
  liveOddsMap: Record<string, string>,
) {
  const playersWithOdds = playerPool.map((player) => ({
    ...player,
    odds: liveOddsMap[normalizeName(player.name)] ?? player.defaultOdds,
  }));
  const impliedProbabilities = playersWithOdds.map((player) => parseAmericanOdds(player.odds));
  const ranks = playersWithOdds.map((player) => player.worldRank);
  const minProbability = Math.min(...impliedProbabilities);
  const maxProbability = Math.max(...impliedProbabilities);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);

  return playersWithOdds.map((player) => {
    const oddsScore = normalizeValue(parseAmericanOdds(player.odds), minProbability, maxProbability);
    const rankScore = 1 - normalizeValue(player.worldRank, minRank, maxRank);
    const blendedScore = oddsScore * VEGAS_WEIGHT + rankScore * WORLD_RANK_WEIGHT;
    const salary =
      Math.round((SALARY_MIN + blendedScore * (SALARY_MAX - SALARY_MIN)) / 100) * 100;

    return {
      id: player.id,
      name: player.name,
      worldRank: player.worldRank,
      odds: player.odds,
      salary,
    };
  });
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function readRoster(tournamentId: TournamentId) {
  if (typeof window === 'undefined') {
    return DEFAULT_ROSTERS[tournamentId];
  }

  const key = `${STORAGE_PREFIX}:roster:${tournamentId}`;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return DEFAULT_ROSTERS[tournamentId];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_ROSTERS[tournamentId];
  } catch {
    return DEFAULT_ROSTERS[tournamentId];
  }
}

function saveGuestRoster(tournamentId: TournamentId, roster: number[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const key = `${STORAGE_PREFIX}:roster:${tournamentId}`;
  window.localStorage.setItem(key, JSON.stringify(roster));
}

function scoreToNumber(score: string | undefined) {
  if (!score || score === '--') {
    return 0;
  }

  if (score === 'E') {
    return 0;
  }

  if (score === 'CUT') {
    return 10;
  }

  if (score === 'WD' || score === 'DQ' || score === 'MDF') {
    return 12;
  }

  return Number(score);
}

function positionBonus(position: string | undefined) {
  if (!position) {
    return 0;
  }

  const numeric = Number(position.replace('T', ''));
  if (Number.isNaN(numeric)) {
    return 0;
  }

  if (numeric === 1) return 40;
  if (numeric === 2) return 25;
  if (numeric === 3) return 20;
  if (numeric === 4) return 18;
  if (numeric === 5) return 16;
  if (numeric === 6) return 14;
  if (numeric === 7) return 12;
  if (numeric === 8) return 10;
  if (numeric === 9) return 9;
  if (numeric === 10) return 8;
  if (numeric <= 15) return 7;
  if (numeric <= 20) return 6;
  if (numeric <= 25) return 5;
  if (numeric <= 30) return 3;
  if (numeric <= 40) return 1;
  return 0;
}

function getCountdown(lockAt: string) {
  const diff = new Date(lockAt).getTime() - Date.now();
  if (diff <= 0) {
    return { isLocked: true, label: 'Locked' };
  }

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return { isLocked: false, label: `${h}h ${m}m` };
}

function formatRefresh(value: string | null) {
  if (!value) {
    return 'Waiting for first sync';
  }

  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) {
    return 'Updated just now';
  }
  if (minutes === 1) {
    return 'Updated 1 minute ago';
  }
  return `Updated ${minutes} minutes ago`;
}

async function readJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed.');
  }

  return payload;
}

function fieldStyle() {
  return {
    width: '100%',
    borderRadius: 14,
    border: '1px solid #d7e0e8',
    padding: '12px 14px',
    fontSize: 15,
    background: '#fff',
  } satisfies CSSProperties;
}

export default function Page() {
  const [mainTab, setMainTab] = useState<MainTab>('Standings');
  const [selectedTournament, setSelectedTournament] = useState<TournamentId>('pga');
  const [selectedRoster, setSelectedRoster] = useState<number[]>(DEFAULT_ROSTERS.pga);
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [autoLocked, setAutoLocked] = useState(false);
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [poolEntries, setPoolEntries] = useState<PoolEntry[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    displayName: '',
    email: '',
    password: '',
    joinCode: '',
  });
  const [joinCode, setJoinCode] = useState(DEFAULT_JOIN_CODE);

  const tournament = TOURNAMENTS.find((item) => item.id === selectedTournament) ?? TOURNAMENTS[0];

  useEffect(() => {
    const loadSession = async () => {
      setSessionLoading(true);

      try {
        const payload = await readJson<SessionPayload>('/api/auth/session', { cache: 'no-store' });
        setSessionUser(payload.user);
        setPool(payload.pool);
        setPoolEntries(payload.entries);
      } catch {
        setSessionUser(null);
        setPool(null);
        setPoolEntries([]);
      } finally {
        setSessionLoading(false);
      }
    };

    void loadSession();
  }, []);

  useEffect(() => {
    if (sessionUser) {
      setSelectedRoster(sessionUser.rosters[selectedTournament] ?? DEFAULT_ROSTERS[selectedTournament]);
      return;
    }

    setSelectedRoster(readRoster(selectedTournament));
  }, [selectedTournament, sessionUser]);

  useEffect(() => {
    if (!sessionUser) {
      saveGuestRoster(selectedTournament, selectedRoster);
    }
  }, [selectedTournament, selectedRoster, sessionUser]);

  useEffect(() => {
    const tick = () => {
      const countdown = getCountdown(tournament.lockAt);
      setAutoLocked(countdown.isLocked);
    };

    tick();
    const timer = window.setInterval(tick, 60000);
    return () => window.clearInterval(timer);
  }, [tournament.lockAt]);

  useEffect(() => {
    let active = true;

    const loadFeed = async () => {
      setIsLoading(true);
      setError('');

      try {
        const payload = await readJson<FeedResponse>(`/api/leaderboard?tournamentId=${selectedTournament}`, {
          cache: 'no-store',
        });

        if (active) {
          setFeed(payload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load leaderboard.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadFeed();
    const timer = window.setInterval(() => {
      void loadFeed();
    }, 180000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedTournament]);

  const applySession = (payload: SessionPayload, successMessage?: string) => {
    setSessionUser(payload.user);
    setPool(payload.pool);
    setPoolEntries(payload.entries);
    setAuthError('');
    setAuthSuccess(successMessage ?? '');
  };

  const handleRegister = async () => {
    setAuthBusy(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      const payload = await readJson<SessionPayload>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });

      applySession(payload, 'Account created and signed in.');
      setRegisterForm({ displayName: '', email: '', password: '', joinCode: '' });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogin = async () => {
    setAuthBusy(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      const payload = await readJson<SessionPayload>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      applySession(payload, 'Signed in successfully.');
      setLoginForm({ email: '', password: '' });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleJoinPool = async () => {
    setAuthBusy(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      const payload = await readJson<SessionPayload>('/api/pool/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode }),
      });

      applySession(payload, 'You joined the pool.');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to join the pool.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      await readJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
      setSessionUser(null);
      setPool(null);
      setPoolEntries([]);
      setSaveMessage('');
      setAuthSuccess('Signed out.');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign out.');
    } finally {
      setAuthBusy(false);
    }
  };

  const feedMap = useMemo(() => {
    const rows = feed?.players ?? [];
    return Object.fromEntries(rows.map((row) => [normalizeName(row.canonicalName ?? ''), row])) as Record<
      string,
      FeedRow
    >;
  }, [feed]);

  const liveOddsMap = useMemo(() => {
    const rows = feed?.odds ?? [];
    return Object.fromEntries(rows.map((row) => [normalizeName(row.canonicalName), row.odds])) as Record<
      string,
      string
    >;
  }, [feed]);

  const players = useMemo(
    () =>
      buildPricedPlayers(PLAYER_POOL, liveOddsMap).map((player) => {
        const live = feedMap[normalizeName(player.name)];
        const score = live?.score ?? '--';
        const position = live?.position ?? '--';
        const thru = live?.thru ?? '--';
        const scoreValue = scoreToNumber(score);
        const bonus = positionBonus(position);

        return {
          ...player,
          position,
          thru,
          score,
          scoreValue,
          bonus,
          poolTotal: scoreValue - bonus,
        };
      }),
    [feedMap, liveOddsMap],
  );

  const playersById = useMemo(
    () => Object.fromEntries(players.map((player) => [player.id, player])),
    [players],
  );

  const rosterPlayers = selectedRoster.map((id) => playersById[id]).filter(Boolean);
  const orderedRosterPlayers = [...rosterPlayers].sort((left, right) => right.salary - left.salary);
  const salaryUsed = rosterPlayers.reduce((sum, player) => sum + player.salary, 0);
  const salaryRemaining = SALARY_CAP - salaryUsed;
  const playersNeeded = Math.max(0, REQUIRED_GOLFERS - selectedRoster.length);
  const averageRemainingPerPlayer =
    playersNeeded > 0 ? Math.max(0, Math.floor(salaryRemaining / playersNeeded)) : 0;
  const locked = autoLocked;

  const userLabel = sessionUser?.displayName ?? 'Guest lineup';
  const liveStandingEntries =
    poolEntries.length > 0
      ? poolEntries
      : [
          {
            id: sessionUser?.id ?? 'guest-entry',
            name: userLabel,
            rosters: { [selectedTournament]: selectedRoster },
          },
          ...STATIC_ENTRIES,
        ];

  const standings = liveStandingEntries
    .map((entry) => {
      const picks = entry.rosters[selectedTournament] ?? [];
      const golfers = picks.map((id) => playersById[id]).filter(Boolean);
      const rawScore = golfers.reduce((sum, golfer) => sum + golfer.scoreValue, 0);
      const bonus = golfers.reduce((sum, golfer) => sum + golfer.bonus, 0);
      const total = rawScore - bonus;

      return {
        ...entry,
        picks,
        golfers,
        rawScore,
        bonus,
        total,
      };
    })
    .sort((left, right) => left.total - right.total)
    .map((entry, index) => ({ ...entry, place: index + 1 }));

  const canSave =
    Boolean(sessionUser) &&
    selectedRoster.length === REQUIRED_GOLFERS &&
    salaryUsed <= SALARY_CAP &&
    !locked;

  const togglePlayer = (playerId: number) => {
    if (locked) {
      return;
    }

    if (selectedRoster.includes(playerId)) {
      setSelectedRoster(selectedRoster.filter((id) => id !== playerId));
      return;
    }

    if (selectedRoster.length >= REQUIRED_GOLFERS) {
      return;
    }

    const next = [...selectedRoster, playerId];
    const nextSalary = next.reduce((sum, id) => sum + playersById[id].salary, 0);

    if (nextSalary > SALARY_CAP) {
      return;
    }

    setSelectedRoster(next);
  };

  const handleSave = async () => {
    if (!sessionUser) {
      setSaveMessage('Create an account or sign in to save this lineup to the pool.');
      return;
    }

    if (!canSave) {
      setSaveMessage('Lineup must have 6 golfers, stay under the salary cap, and be saved before lock.');
      return;
    }

    try {
      const payload = await readJson<SessionPayload & { roster: number[] }>('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournament,
          roster: selectedRoster,
        }),
      });

      applySession(payload);
      setSaveMessage('Lineup saved to your account for this tournament.');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save lineup.');
    }
  };

  const renderRosterCards = (background: string) => (
    <div style={{ display: 'grid', gap: 10 }}>
      {orderedRosterPlayers.map((player, index) => (
        <div
          key={player.id}
          style={{
            border: '1px solid #e6edf1',
            borderRadius: 16,
            padding: 14,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            background,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#0b7a53' }}>
              Roster {index + 1}
            </div>
            <div style={{ fontWeight: 700 }}>{player.name}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>
              OWGR {player.worldRank} | ${player.salary.toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{player.score}</div>
            <div style={{ fontSize: 12, color: '#0b7a53' }}>bonus {player.bonus}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderBudgetCards = (background: string, border: string) => (
    <div
      style={{
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 10,
      }}
    >
      <div style={{ borderRadius: 16, background, padding: 14, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>Salary used</div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>${salaryUsed.toLocaleString()}</div>
      </div>
      <div style={{ borderRadius: 16, background, padding: 14, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>Remaining</div>
        <div
          style={{
            marginTop: 6,
            fontSize: 22,
            fontWeight: 900,
            color: salaryRemaining < 0 ? '#b91c1c' : '#0f1720',
          }}
        >
          ${salaryRemaining.toLocaleString()}
        </div>
      </div>
      <div style={{ borderRadius: 16, background, padding: 14, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
          Avg/player left
        </div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>${averageRemainingPerPlayer.toLocaleString()}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#6b7b88' }}>
          {playersNeeded === 0 ? 'Roster complete' : `${playersNeeded} spot${playersNeeded === 1 ? '' : 's'} left`}
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(0, 135, 91, 0.18), transparent 28%), linear-gradient(180deg, #f7fbf9 0%, #eef3f7 100%)',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 20px 40px' }}>
        <header
          style={{
            background: 'linear-gradient(135deg, #0b3d2e 0%, #092233 100%)',
            color: '#fff',
            borderRadius: 28,
            padding: '28px 28px 24px',
            boxShadow: '0 24px 64px rgba(9, 34, 51, 0.18)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.75 }}>
                Golf Majors Pool
              </div>
              <h1 style={{ margin: '8px 0 6px', fontSize: 36, lineHeight: 1.05 }}>
                Live tournament scoring and real pool accounts
              </h1>
              <p style={{ margin: 0, maxWidth: 720, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55 }}>
                This board pulls leaderboard data from ESPN, recalculates the standings, and now lets players create
                accounts, join the pool, and save tournament rosters to their own login.
              </p>
            </div>
            <div
              style={{
                minWidth: 280,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 18,
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 10 }}>
                <Shield size={16} />
                Feed health
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ opacity: 0.72 }}>Source</span>
                  <span>{feed?.source ?? 'ESPN leaderboard'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ opacity: 0.72 }}>Status</span>
                  <span>{feed?.status ?? (isLoading ? 'Refreshing...' : 'Unavailable')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ opacity: 0.72 }}>Last sync</span>
                  <span>{formatRefresh(feed?.fetchedAt ?? null)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ opacity: 0.72 }}>Odds</span>
                  <span>{feed?.oddsSource ?? 'Fallback board'}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section
          style={{
            marginTop: 24,
            display: 'grid',
            gridTemplateColumns: sessionUser ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 18,
          }}
        >
          {!sessionUser ? (
            <>
              <div
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <LogIn size={18} color="#0b7a53" />
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Sign in</div>
                </div>
                <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                  <input
                    value={loginForm.email}
                    onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="Email address"
                    style={fieldStyle()}
                  />
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Password"
                    style={fieldStyle()}
                  />
                  <button
                    onClick={handleLogin}
                    disabled={authBusy}
                    style={{
                      border: 'none',
                      borderRadius: 16,
                      padding: '14px 16px',
                      background: '#0b7a53',
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 900,
                      cursor: authBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {authBusy ? 'Working...' : 'Sign in'}
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserPlus size={18} color="#0b7a53" />
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Create account</div>
                </div>
                <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                  <input
                    value={registerForm.displayName}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, displayName: event.target.value }))
                    }
                    placeholder="Display name"
                    style={fieldStyle()}
                  />
                  <input
                    value={registerForm.email}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="Email address"
                    style={fieldStyle()}
                  />
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="Password"
                    style={fieldStyle()}
                  />
                  <input
                    value={registerForm.joinCode}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, joinCode: event.target.value }))}
                    placeholder={`Pool join code (optional, ex: ${DEFAULT_JOIN_CODE})`}
                    style={fieldStyle()}
                  />
                  <button
                    onClick={handleRegister}
                    disabled={authBusy}
                    style={{
                      border: 'none',
                      borderRadius: 16,
                      padding: '14px 16px',
                      background: 'linear-gradient(135deg, #0b7a53 0%, #0c5f85 100%)',
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 900,
                      cursor: authBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {authBusy ? 'Working...' : 'Create account'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 18,
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Account
                  </div>
                  <h2 style={{ margin: '6px 0 4px', fontSize: 28, color: '#0f1720' }}>{sessionUser.displayName}</h2>
                  <div style={{ color: '#5b6b79' }}>{sessionUser.email}</div>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 999,
                    padding: '10px 14px',
                    background: pool ? '#eefbf5' : '#fff8e7',
                    color: pool ? '#0b7a53' : '#9a6700',
                    fontWeight: 800,
                  }}
                >
                  <Users size={16} />
                  {pool ? `Joined ${pool.name}` : 'Not joined to a pool yet'}
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  display: 'grid',
                  gridTemplateColumns: pool ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr) auto auto',
                  gap: 12,
                }}
              >
                {pool ? (
                  <>
                    <div style={{ borderRadius: 16, background: '#f5f9fb', padding: 14 }}>
                      <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
                        Pool
                      </div>
                      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900 }}>{pool.name}</div>
                    </div>
                    <div style={{ borderRadius: 16, background: '#f5f9fb', padding: 14 }}>
                      <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
                        Join code
                      </div>
                      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900 }}>{pool.joinCode}</div>
                    </div>
                    <button
                      onClick={handleLogout}
                      disabled={authBusy}
                      style={{
                        border: '1px solid #d7e0e8',
                        borderRadius: 16,
                        padding: '14px 16px',
                        background: '#fff',
                        fontSize: 15,
                        fontWeight: 900,
                        cursor: authBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value)}
                      placeholder="Pool join code"
                      style={fieldStyle()}
                    />
                    <button
                      onClick={handleJoinPool}
                      disabled={authBusy}
                      style={{
                        border: 'none',
                        borderRadius: 16,
                        padding: '14px 16px',
                        background: '#0b7a53',
                        color: '#fff',
                        fontSize: 15,
                        fontWeight: 900,
                        cursor: authBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Join pool
                    </button>
                    <button
                      onClick={handleLogout}
                      disabled={authBusy}
                      style={{
                        border: '1px solid #d7e0e8',
                        borderRadius: 16,
                        padding: '14px 16px',
                        background: '#fff',
                        fontSize: 15,
                        fontWeight: 900,
                        cursor: authBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Sign out
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {sessionLoading ? (
          <div
            style={{
              marginTop: 16,
              borderRadius: 16,
              background: '#f5f9fb',
              color: '#50616f',
              border: '1px solid #d7e0e8',
              padding: '14px 16px',
            }}
          >
            Checking account session...
          </div>
        ) : null}

        {authError ? (
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: 16,
              background: '#fff5f5',
              color: '#a61b1b',
              border: '1px solid #fecaca',
              padding: '14px 16px',
            }}
          >
            <AlertCircle size={18} />
            <span>{authError}</span>
          </div>
        ) : null}

        {authSuccess ? (
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: 16,
              background: '#eefbf5',
              color: '#0b7a53',
              border: '1px solid #cdebdc',
              padding: '14px 16px',
            }}
          >
            <CheckCircle2 size={18} />
            <span>{authSuccess}</span>
          </div>
        ) : null}

        <section
          style={{
            marginTop: 24,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
          }}
        >
          {TOURNAMENTS.map((item) => {
            const active = item.id === selectedTournament;
            const countdown = getCountdown(item.lockAt);

            return (
              <button
                key={item.id}
                onClick={() => setSelectedTournament(item.id)}
                style={{
                  textAlign: 'left',
                  borderRadius: 20,
                  padding: 18,
                  border: active ? '2px solid #0b7a53' : '1px solid #d7e0e8',
                  background: active ? '#f2fbf7' : '#fff',
                  boxShadow: '0 8px 24px rgba(9, 34, 51, 0.06)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                  {countdown.isLocked ? 'Locked' : 'Open'}
                </div>
                <div style={{ marginTop: 8, fontSize: 19, fontWeight: 800, color: '#0f1720' }}>{item.name}</div>
                <div style={{ marginTop: 6, color: '#5b6b79' }}>{item.venue}</div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#0b7a53' }}>
                  <Clock3 size={15} />
                  <span>{countdown.label}</span>
                </div>
              </button>
            );
          })}
        </section>

        <section
          style={{
            marginTop: 18,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {(['Standings', 'My entries', 'Details', 'Commissioner console'] as MainTab[]).map((tab) => {
            const active = tab === mainTab;
            return (
              <button
                key={tab}
                onClick={() => setMainTab(tab)}
                style={{
                  border: active ? '1px solid #0b7a53' : '1px solid #d7e0e8',
                  background: active ? '#0b7a53' : '#fff',
                  color: active ? '#fff' : '#31424f',
                  borderRadius: 999,
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: active ? '0 10px 20px rgba(11, 122, 83, 0.18)' : 'none',
                }}
              >
                {tab}
              </button>
            );
          })}
        </section>

        {error ? (
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: 16,
              background: '#fff5f5',
              color: '#a61b1b',
              border: '1px solid #fecaca',
              padding: '14px 16px',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {mainTab === 'Standings' && (
          <main
            style={{
              marginTop: 24,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 0.9fr)',
              gap: 20,
            }}
          >
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Pool standings
                  </div>
                  <h2 style={{ margin: '6px 0 0', fontSize: 26, color: '#0f1720' }}>{tournament.name}</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5b6b79', fontSize: 14 }}>
                  <RefreshCw size={15} />
                  <span>{isLoading ? 'Refreshing live scores...' : formatRefresh(feed?.fetchedAt ?? null)}</span>
                </div>
              </div>

              <div style={{ marginTop: 18, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#5b6b79', fontSize: 12, textTransform: 'uppercase' }}>
                      <th style={{ padding: '0 0 12px' }}>Place</th>
                      <th style={{ padding: '0 0 12px' }}>Entry</th>
                      <th style={{ padding: '0 0 12px' }}>Score</th>
                      <th style={{ padding: '0 0 12px' }}>Bonus</th>
                      <th style={{ padding: '0 0 12px' }}>Pool total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((entry) => (
                      <tr key={entry.id} style={{ borderTop: '1px solid #edf1f4' }}>
                        <td style={{ padding: '16px 0', fontWeight: 800, color: '#0b7a53' }}>#{entry.place}</td>
                        <td style={{ padding: '16px 0' }}>
                          <div style={{ fontWeight: 700, color: '#0f1720' }}>{entry.name}</div>
                          <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>
                            {entry.golfers.map((golfer) => golfer.name.split(' ')[0]).join(', ') || 'No lineup saved'}
                          </div>
                        </td>
                        <td style={{ padding: '16px 0', fontWeight: 700 }}>
                          {entry.rawScore > 0 ? `+${entry.rawScore}` : entry.rawScore}
                        </td>
                        <td style={{ padding: '16px 0', fontWeight: 700, color: '#0b7a53' }}>{entry.bonus}</td>
                        <td style={{ padding: '16px 0', fontWeight: 900, fontSize: 18 }}>{entry.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop: 18,
                  borderRadius: 18,
                  background: '#f5f9fb',
                  padding: 16,
                  color: '#50616f',
                  lineHeight: 1.5,
                }}
              >
                Pool totals are recalculated from each golfer&apos;s current score to par, with ESPN leaderboard position
                used for a live bonus estimate while the event is underway.
              </div>
            </section>

            <aside style={{ display: 'grid', gap: 20 }}>
              <section
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                      My entry
                    </div>
                    <h3 style={{ margin: '6px 0 0', fontSize: 24 }}>{userLabel}</h3>
                    <div style={{ marginTop: 4, color: '#6b7b88', fontSize: 13 }}>
                      {sessionUser ? 'Saved to your account' : 'Guest mode until you sign in'}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 10px',
                      borderRadius: 999,
                      background: locked ? '#fff1f2' : '#eefbf5',
                      color: locked ? '#be123c' : '#0b7a53',
                      fontWeight: 800,
                      fontSize: 12,
                      textTransform: 'uppercase',
                    }}
                  >
                    <Lock size={14} />
                    {locked ? 'Locked' : 'Editable'}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>{renderRosterCards('#fff')}</div>
                {renderBudgetCards('#f5f9fb', 'none')}

                {!sessionUser ? (
                  <div
                    style={{
                      marginTop: 14,
                      borderRadius: 14,
                      background: '#fff8e7',
                      color: '#9a6700',
                      padding: '12px 14px',
                    }}
                  >
                    Sign in or create an account above to save this lineup to the pool.
                  </div>
                ) : null}

                {saveMessage ? (
                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 14,
                      background: '#eefbf5',
                      color: '#0b7a53',
                      padding: '12px 14px',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>{saveMessage}</span>
                  </div>
                ) : null}

                <button
                  onClick={handleSave}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    border: 'none',
                    borderRadius: 16,
                    padding: '14px 16px',
                    background: canSave ? 'linear-gradient(135deg, #0b7a53 0%, #0c5f85 100%)' : '#cbd5df',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 900,
                    cursor: canSave ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Save size={16} />
                  {sessionUser ? 'Save lineup' : 'Sign in to save'}
                </button>
              </section>

              <section
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Trophy size={18} color="#0b7a53" />
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Tracked golfers</div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {players.map((player) => {
                    const selected = selectedRoster.includes(player.id);
                    const disabled =
                      !selected &&
                      (locked || selectedRoster.length >= REQUIRED_GOLFERS || player.salary > salaryRemaining);

                    return (
                      <button
                        key={player.id}
                        onClick={() => togglePlayer(player.id)}
                        style={{
                          textAlign: 'left',
                          borderRadius: 16,
                          border: selected ? '2px solid #0b7a53' : disabled ? '1px solid #d7dee6' : '1px solid #e6edf1',
                          background: selected ? '#f2fbf7' : disabled ? '#f3f5f7' : '#fff',
                          padding: 14,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.58 : 1,
                        }}
                        disabled={disabled}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 800, color: disabled ? '#748391' : '#0f1720' }}>{player.name}</div>
                            <div style={{ marginTop: 4, color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 13 }}>
                              OWGR {player.worldRank} | {player.odds}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, fontSize: 20 }}>{player.score}</div>
                            <div style={{ color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 12 }}>
                              ${player.salary.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </aside>
          </main>
        )}

        {mainTab === 'My entries' && (
          <main style={{ marginTop: 24, display: 'grid', gap: 20 }}>
            {!sessionUser ? (
              <div
                style={{
                  borderRadius: 18,
                  background: '#fff8e7',
                  color: '#9a6700',
                  border: '1px solid #f0d28a',
                  padding: '16px 18px',
                }}
              >
                This tab is ready for saved entries, but you need to sign in first so the lineup belongs to your account.
              </div>
            ) : null}

            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                My entries
              </div>
              <h2 style={{ margin: '6px 0 18px', fontSize: 26, color: '#0f1720' }}>
                Build and save your {tournament.name} lineup
              </h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: 20,
                }}
              >
                <div
                  style={{
                    background: '#f8fbfd',
                    border: '1px solid #e6edf1',
                    borderRadius: 20,
                    padding: 18,
                  }}
                >
                  {renderRosterCards('#fff')}
                  {renderBudgetCards('#fff', '1px solid #e6edf1')}

                  {saveMessage ? (
                    <div
                      style={{
                        marginTop: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        borderRadius: 14,
                        background: '#eefbf5',
                        color: '#0b7a53',
                        padding: '12px 14px',
                      }}
                    >
                      <CheckCircle2 size={16} />
                      <span>{saveMessage}</span>
                    </div>
                  ) : null}

                  <button
                    onClick={handleSave}
                    style={{
                      marginTop: 16,
                      width: '100%',
                      border: 'none',
                      borderRadius: 16,
                      padding: '14px 16px',
                      background: canSave ? 'linear-gradient(135deg, #0b7a53 0%, #0c5f85 100%)' : '#cbd5df',
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 900,
                      cursor: canSave ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Save size={16} />
                    {sessionUser ? 'Save lineup' : 'Sign in to save'}
                  </button>
                </div>

                <section
                  style={{
                    background: '#fff',
                    borderRadius: 20,
                    padding: 18,
                    border: '1px solid #e6edf1',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Trophy size={18} color="#0b7a53" />
                    <div style={{ fontSize: 18, fontWeight: 900 }}>Tracked golfers</div>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {players.map((player) => {
                      const selected = selectedRoster.includes(player.id);
                      const disabled =
                        !selected &&
                        (locked || selectedRoster.length >= REQUIRED_GOLFERS || player.salary > salaryRemaining);

                      return (
                        <button
                          key={player.id}
                          onClick={() => togglePlayer(player.id)}
                          style={{
                            textAlign: 'left',
                            borderRadius: 16,
                            border: selected ? '2px solid #0b7a53' : disabled ? '1px solid #d7dee6' : '1px solid #e6edf1',
                            background: selected ? '#f2fbf7' : disabled ? '#f3f5f7' : '#fff',
                            padding: 14,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.58 : 1,
                          }}
                          disabled={disabled}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                              <div style={{ fontWeight: 800, color: disabled ? '#748391' : '#0f1720' }}>{player.name}</div>
                              <div style={{ marginTop: 4, color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 13 }}>
                                OWGR {player.worldRank} | {player.odds}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 900, fontSize: 20 }}>{player.score}</div>
                              <div style={{ color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 12 }}>
                                ${player.salary.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </section>
          </main>
        )}

        {mainTab === 'Details' && (
          <main style={{ marginTop: 24, display: 'grid', gap: 20 }}>
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                Pool details
              </div>
              <h2 style={{ margin: '6px 0 18px', fontSize: 26, color: '#0f1720' }}>
                How scoring, accounts, and lineup locks work
              </h2>
              <div style={{ display: 'grid', gap: 12, color: '#425463', lineHeight: 1.6 }}>
                <div>Each event uses a 6-golfer lineup and a $50,000 salary cap.</div>
                <div>Lineups lock automatically at the tournament tee time shown on the event card.</div>
                <div>
                  Live standings use current score to par plus a live finishing-position bonus estimate from the active
                  leaderboard.
                </div>
                <div>
                  New accounts can sign in, save rosters by tournament, and join the main pool using a join code.
                </div>
                <div>
                  The app pulls leaderboard data from ESPN and uses live odds when available for player pricing.
                </div>
              </div>
            </section>
          </main>
        )}

        {mainTab === 'Commissioner console' && (
          <main style={{ marginTop: 24, display: 'grid', gap: 20 }}>
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                Commissioner console
              </div>
              <h2 style={{ margin: '6px 0 18px', fontSize: 26, color: '#0f1720' }}>
                Live feed and pool status for {tournament.name}
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 14,
                }}
              >
                <div style={{ border: '1px solid #e6edf1', borderRadius: 18, padding: 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Source
                  </div>
                  <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>{feed?.source ?? 'ESPN leaderboard'}</div>
                </div>
                <div style={{ border: '1px solid #e6edf1', borderRadius: 18, padding: 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Status
                  </div>
                  <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>{feed?.status ?? 'Unavailable'}</div>
                </div>
                <div style={{ border: '1px solid #e6edf1', borderRadius: 18, padding: 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Last sync
                  </div>
                  <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>{formatRefresh(feed?.fetchedAt ?? null)}</div>
                </div>
                <div style={{ border: '1px solid #e6edf1', borderRadius: 18, padding: 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Lineup lock
                  </div>
                  <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>{locked ? 'Locked' : 'Open'}</div>
                </div>
                <div style={{ border: '1px solid #e6edf1', borderRadius: 18, padding: 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Join code
                  </div>
                  <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>{pool?.joinCode ?? DEFAULT_JOIN_CODE}</div>
                </div>
                <div style={{ border: '1px solid #e6edf1', borderRadius: 18, padding: 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Pool members
                  </div>
                  <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>{poolEntries.length}</div>
                </div>
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
