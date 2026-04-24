'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Lock,
  RefreshCw,
  Save,
  Shield,
  Trophy,
} from 'lucide-react';

const SALARY_CAP = 50000;
const REQUIRED_GOLFERS = 6;
const STORAGE_PREFIX = 'golf-pool-live';

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

const PLAYERS = [
  { id: 1, name: 'Scottie Scheffler', salary: 10800, odds: '+450', worldRank: 1 },
  { id: 2, name: 'Rory McIlroy', salary: 10100, odds: '+900', worldRank: 2 },
  { id: 3, name: 'Xander Schauffele', salary: 9300, odds: '+1200', worldRank: 3 },
  { id: 4, name: 'Collin Morikawa', salary: 8800, odds: '+1600', worldRank: 4 },
  { id: 5, name: 'Ludvig Aberg', salary: 8500, odds: '+1800', worldRank: 5 },
  { id: 6, name: 'Tommy Fleetwood', salary: 7200, odds: '+3500', worldRank: 12 },
  { id: 7, name: 'Patrick Cantlay', salary: 7600, odds: '+3000', worldRank: 10 },
  { id: 8, name: 'Hideki Matsuyama', salary: 7000, odds: '+4000', worldRank: 13 },
  { id: 9, name: 'Brooks Koepka', salary: 6800, odds: '+4500', worldRank: 18 },
  { id: 10, name: 'Jordan Spieth', salary: 6500, odds: '+5000', worldRank: 22 },
  { id: 11, name: 'Will Zalatoris', salary: 6200, odds: '+5500', worldRank: 28 },
  { id: 12, name: 'Min Woo Lee', salary: 5600, odds: '+7000', worldRank: 34 },
  { id: 13, name: 'Sahith Theegala', salary: 5400, odds: '+8000', worldRank: 30 },
  { id: 14, name: 'Akshay Bhatia', salary: 5100, odds: '+9000', worldRank: 37 },
] as const;

const DEFAULT_ROSTERS: Record<string, number[]> = {
  players: [1, 2, 8, 10, 12, 14],
  masters: [1, 2, 4, 8, 10, 12],
  pga: [1, 3, 5, 8, 10, 11],
  'us-open': [1, 2, 5, 7, 10, 14],
  open: [2, 3, 5, 6, 8, 12],
};

const STATIC_ENTRIES = [
  { id: 2, name: 'Brady S.', picks: [1, 3, 5, 7, 9, 11] },
  { id: 3, name: 'Megan T.', picks: [2, 4, 6, 8, 12, 13] },
  { id: 4, name: 'Ryan H.', picks: [3, 4, 5, 9, 10, 14] },
];

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
  source: string;
  status: string;
};

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

function saveRoster(tournamentId: TournamentId, roster: number[]) {
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

export default function Page() {
  const [mainTab, setMainTab] = useState<MainTab>('Standings');
  const [selectedTournament, setSelectedTournament] = useState<TournamentId>('pga');
  const [entryName, setEntryName] = useState('Clayton Tucker');
  const [selectedRoster, setSelectedRoster] = useState<number[]>(DEFAULT_ROSTERS.pga);
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [autoLocked, setAutoLocked] = useState(false);

  const tournament = TOURNAMENTS.find((item) => item.id === selectedTournament) ?? TOURNAMENTS[0];

  useEffect(() => {
    setSelectedRoster(readRoster(selectedTournament));
    setSaveMessage('');
  }, [selectedTournament]);

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
        const response = await fetch(`/api/leaderboard?tournamentId=${selectedTournament}`, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as FeedResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to load leaderboard.');
        }

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

    loadFeed();
    const timer = window.setInterval(loadFeed, 180000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedTournament]);

  const feedMap = useMemo(() => {
    const rows = feed?.players ?? [];
    return Object.fromEntries(
      rows.map((row) => [normalizeName(row.canonicalName ?? ''), row]),
    ) as Record<string, FeedRow>;
  }, [feed]);

  const players = useMemo(
    () =>
      PLAYERS.map((player) => {
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
    [feedMap],
  );

  const playersById = useMemo(
    () => Object.fromEntries(players.map((player) => [player.id, player])),
    [players],
  );

  const rosterPlayers = selectedRoster.map((id) => playersById[id]).filter(Boolean);
  const salaryUsed = rosterPlayers.reduce((sum, player) => sum + player.salary, 0);
  const salaryRemaining = SALARY_CAP - salaryUsed;
  const playersNeeded = Math.max(0, REQUIRED_GOLFERS - selectedRoster.length);
  const averageRemainingPerPlayer =
    playersNeeded > 0 ? Math.max(0, Math.floor(salaryRemaining / playersNeeded)) : 0;
  const locked = autoLocked;

  const standings = [{ id: 1, name: entryName, picks: selectedRoster }, ...STATIC_ENTRIES]
    .map((entry) => {
      const golfers = entry.picks.map((id) => playersById[id]).filter(Boolean);
      const rawScore = golfers.reduce((sum, golfer) => sum + golfer.scoreValue, 0);
      const bonus = golfers.reduce((sum, golfer) => sum + golfer.bonus, 0);
      const total = rawScore - bonus;
      return {
        ...entry,
        golfers,
        rawScore,
        bonus,
        total,
      };
    })
    .sort((left, right) => left.total - right.total)
    .map((entry, index) => ({ ...entry, place: index + 1 }));

  const canSave =
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

  const handleSave = () => {
    if (!canSave) {
      setSaveMessage('Lineup must have 6 golfers and stay under the salary cap.');
      return;
    }

    saveRoster(selectedTournament, selectedRoster);
    setSaveMessage('Lineup saved for this tournament.');
  };

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
                Live tournament scoring is now web-fed
              </h1>
              <p style={{ margin: 0, maxWidth: 720, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55 }}>
                This board pulls leaderboard data from ESPN on a repeating sync, matches it to your tracked golfers,
                and recalculates pool standings per tournament.
              </p>
            </div>
            <div
              style={{
                minWidth: 260,
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
              </div>
            </div>
          </div>
        </header>

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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#5b6b79',
                    fontSize: 14,
                  }}
                >
                  <RefreshCw size={15} />
                  <span>{isLoading ? 'Refreshing live scores...' : formatRefresh(feed?.fetchedAt ?? null)}</span>
                </div>
              </div>

              <div style={{ marginTop: 18, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#5b6b79', fontSize: 13 }}>
                      <th style={{ padding: '0 0 12px' }}>Place</th>
                      <th style={{ padding: '0 0 12px' }}>Entry</th>
                      <th style={{ padding: '0 0 12px' }}>Raw</th>
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
                            {entry.golfers.map((golfer) => golfer.name.split(' ')[0]).join(', ')}
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
                    <h3 style={{ margin: '6px 0 0', fontSize: 24 }}>{entryName}</h3>
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

                <label style={{ display: 'block', marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79', marginBottom: 8 }}>
                    Entry name
                  </div>
                  <input
                    value={entryName}
                    onChange={(event) => setEntryName(event.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: 14,
                      border: '1px solid #d7e0e8',
                      padding: '12px 14px',
                      fontSize: 15,
                    }}
                  />
                </label>

                <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                  {rosterPlayers.map((player) => (
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
                      }}
                    >
                      <div>
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

                <div
                  style={{
                    marginTop: 16,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 10,
                  }}
                >
                  <div style={{ borderRadius: 16, background: '#f5f9fb', padding: 14 }}>
                    <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
                      Salary used
                    </div>
                    <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>
                      ${salaryUsed.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ borderRadius: 16, background: '#f5f9fb', padding: 14 }}>
                    <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
                      Remaining
                    </div>
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
                  <div style={{ borderRadius: 16, background: '#f5f9fb', padding: 14 }}>
                    <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
                      Avg/player left
                    </div>
                    <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>
                      ${averageRemainingPerPlayer.toLocaleString()}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#6b7b88' }}>
                      {playersNeeded === 0 ? 'Roster complete' : `${playersNeeded} spot${playersNeeded === 1 ? '' : 's'} left`}
                    </div>
                  </div>
                </div>

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
                  Save lineup
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
                  <label style={{ display: 'block' }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: '#5b6b79',
                        marginBottom: 8,
                      }}
                    >
                      Entry name
                    </div>
                    <input
                      value={entryName}
                      onChange={(event) => setEntryName(event.target.value)}
                      style={{
                        width: '100%',
                        borderRadius: 14,
                        border: '1px solid #d7e0e8',
                        padding: '12px 14px',
                        fontSize: 15,
                      }}
                    />
                  </label>

                  <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
                    {rosterPlayers.map((player) => (
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
                          background: '#fff',
                        }}
                      >
                        <div>
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

                  <div
                    style={{
                      marginTop: 16,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 10,
                    }}
                  >
                    <div style={{ borderRadius: 16, background: '#fff', padding: 14, border: '1px solid #e6edf1' }}>
                      <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
                        Salary used
                      </div>
                      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>
                        ${salaryUsed.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ borderRadius: 16, background: '#fff', padding: 14, border: '1px solid #e6edf1' }}>
                      <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
                        Remaining
                      </div>
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
                    <div style={{ borderRadius: 16, background: '#fff', padding: 14, border: '1px solid #e6edf1' }}>
                      <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
                        Avg/player left
                      </div>
                      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>
                        ${averageRemainingPerPlayer.toLocaleString()}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#6b7b88' }}>
                        {playersNeeded === 0 ? 'Roster complete' : `${playersNeeded} spot${playersNeeded === 1 ? '' : 's'} left`}
                      </div>
                    </div>
                  </div>

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
                    Save lineup
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
                How scoring and lineup locks work
              </h2>
              <div style={{ display: 'grid', gap: 12, color: '#425463', lineHeight: 1.6 }}>
                <div>Each event uses a 6-golfer lineup and a $50,000 salary cap.</div>
                <div>Lineups lock automatically at the tournament tee time shown on the event card.</div>
                <div>
                  Live standings use current score to par plus a live finishing-position bonus estimate from the active
                  leaderboard.
                </div>
                <div>
                  The app now fetches from ESPN for `The Players`, `The Masters`, `PGA Championship`, `U.S. Open`,
                  and `The Open Championship`.
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
                Live feed status for {tournament.name}
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
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
