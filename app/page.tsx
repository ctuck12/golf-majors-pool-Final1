'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Clock3,
  Shield,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Flag,
  Settings2,
  Save,
  Lock,
  Unlock,
  CheckCircle2,
  X,
  Wallet,
  Users,
  Medal,
  Bell,
  Info,
  ChevronDown,
} from 'lucide-react';

/* ─── Constants ─────────────────────────────────────── */

const SALARY_CAP = 50000;
const REQUIRED_GOLFERS = 6;
const STORAGE_PREFIX = 'golf-pool-mvp';
const DEFAULT_ROSTER = [1, 2, 8, 10, 12, 14];
const DEFAULT_SETTINGS = {
  venmo: '@YourVenmo',
  entryFee: 50,
  payouts: { first: 50, second: 30, third: 20 },
  manualLock: false,
};

const DATA_MODEL = {
  tournaments: { id: 'string', name: 'string', venue: 'string', lockAt: 'datetime', status: 'scheduled | live | final' },
  players: { id: 'number', name: 'string', owgr: 'number' },
  tournamentSalaries: { tournamentId: 'string', playerId: 'number', salary: 'number', odds: 'string', salaryRank: 'number' },
  entries: { id: 'number', userId: 'string', entryName: 'string', tournamentId: 'string', savedAt: 'datetime', lockedAt: 'datetime | null' },
  entryPicks: { entryId: 'number', playerId: 'number', slot: 'number' },
  livePlayerStats: { tournamentId: 'string', playerId: 'number', thru: 'string', score: 'string', pars: 'number', birdies: 'number', eagles: 'number', aces: 'number', bogeys: 'number', doubles: 'number', triplePlus: 'number', streaks: 'number', roundLeadBonus: 'number', finishingBonus: 'number', lowRoundBonus: 'number', updatedAt: 'datetime' },
  poolSettings: { venmo: 'string', entryFee: 'number', payoutFirst: 'number', payoutSecond: 'number', payoutThird: 'number', manualLock: 'boolean' },
};

const TOURNAMENTS = [
  { id: 'players', name: 'The Players Championship', shortName: 'The Players', venue: 'TPC Sawgrass', lockTimeLabel: 'Thu 7:40 AM', lockAt: '2026-03-12T07:40:00' },
  { id: 'masters', name: 'The Masters', shortName: 'The Masters', venue: 'Augusta National', lockTimeLabel: 'Thu 7:30 AM', lockAt: '2026-04-09T07:30:00' },
  { id: 'pga', name: 'PGA Championship', shortName: 'The PGA', venue: 'Aronimink', lockTimeLabel: 'Thu 7:20 AM', lockAt: '2026-05-14T07:20:00' },
  { id: 'us-open', name: 'U.S. Open', shortName: 'The U.S. Open', venue: 'TBD', lockTimeLabel: 'Thu 7:15 AM', lockAt: '2026-06-18T07:15:00' },
  { id: 'open', name: 'The Open Championship', shortName: 'The British Open', venue: 'TBD', lockTimeLabel: 'Thu 6:35 AM', lockAt: '2026-07-16T06:35:00' },
];

const BONUS_ROWS = [
  ['Low Round of the Tournament', 5],
  ['1st Round Leader', 5],
  ['2nd Round Leader', 5],
  ['3rd Round Leader', 5],
  ['Tournament Leader', 40],
  ['2nd Place', 25],
  ['3rd Place', 20],
  ['4th Place', 19],
  ['5th Place', 18],
  ['6th Place', 16],
  ['7th Place', 14],
  ['8th Place', 12],
  ['9th Place', 11],
  ['10th Place', 10],
  ['11th Place', 9],
  ['12th Place', 8],
  ['13th Place', 7],
  ['14th Place', 6],
  ['15th – 20th Place', 5],
  ['21st – 29th Place', 3],
  ['30th – 40th Place', 1],
  ['Missed Cut', -10],
  ['Pars', 1],
  ['Birdies', 3],
  ['Eagles', 5],
  ['Hole in One', 8],
  ['Bogeys', -1],
  ['Double Bogeys', -3],
  ['Triple Bogey or Worse', -5],
  ['3 Birdies in a Row Streak', 3],
] as const;

const PLAYERS = [
  { id: 1, name: 'Scottie Scheffler', owgr: 1 },
  { id: 2, name: 'Rory McIlroy', owgr: 2 },
  { id: 3, name: 'Xander Schauffele', owgr: 3 },
  { id: 4, name: 'Collin Morikawa', owgr: 4 },
  { id: 5, name: 'Ludvig Åberg', owgr: 5 },
  { id: 6, name: 'Tommy Fleetwood', owgr: 12 },
  { id: 7, name: 'Patrick Cantlay', owgr: 10 },
  { id: 8, name: 'Hideki Matsuyama', owgr: 13 },
  { id: 9, name: 'Brooks Koepka', owgr: 18 },
  { id: 10, name: 'Jordan Spieth', owgr: 22 },
  { id: 11, name: 'Will Zalatoris', owgr: 28 },
  { id: 12, name: 'Min Woo Lee', owgr: 34 },
  { id: 13, name: 'Sahith Theegala', owgr: 30 },
  { id: 14, name: 'Akshay Bhatia', owgr: 37 },
];

const TOURNAMENT_SALARIES = [
  { tournamentId: 'players', playerId: 1, salary: 10800, odds: '+450', salaryRank: 1 },
  { tournamentId: 'players', playerId: 2, salary: 10100, odds: '+900', salaryRank: 2 },
  { tournamentId: 'players', playerId: 3, salary: 9300, odds: '+1200', salaryRank: 3 },
  { tournamentId: 'players', playerId: 4, salary: 8800, odds: '+1600', salaryRank: 4 },
  { tournamentId: 'players', playerId: 5, salary: 8500, odds: '+1800', salaryRank: 5 },
  { tournamentId: 'players', playerId: 6, salary: 7200, odds: '+3500', salaryRank: 8 },
  { tournamentId: 'players', playerId: 7, salary: 7600, odds: '+3000', salaryRank: 7 },
  { tournamentId: 'players', playerId: 8, salary: 7000, odds: '+4000', salaryRank: 9 },
  { tournamentId: 'players', playerId: 9, salary: 6800, odds: '+4500', salaryRank: 10 },
  { tournamentId: 'players', playerId: 10, salary: 6500, odds: '+5000', salaryRank: 11 },
  { tournamentId: 'players', playerId: 11, salary: 6200, odds: '+5500', salaryRank: 12 },
  { tournamentId: 'players', playerId: 12, salary: 5600, odds: '+7000', salaryRank: 13 },
  { tournamentId: 'players', playerId: 13, salary: 5400, odds: '+8000', salaryRank: 14 },
  { tournamentId: 'players', playerId: 14, salary: 5100, odds: '+9000', salaryRank: 15 },
];

const LIVE_PLAYER_STATS = [
  { tournamentId: 'players', playerId: 1,  thru: '13', score: '-4', pars: 42, birdies: 14, eagles: 1, aces: 0, bogeys: 5,  doubles: 0, triplePlus: 0, streaks: 2, roundLeadBonus: 5, finishingBonus: 40, lowRoundBonus: 5, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 2,  thru: 'F',  score: '-2', pars: 40, birdies: 13, eagles: 0, aces: 0, bogeys: 6,  doubles: 1, triplePlus: 0, streaks: 1, roundLeadBonus: 0, finishingBonus: 25, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 3,  thru: '11', score: '-1', pars: 39, birdies: 11, eagles: 0, aces: 0, bogeys: 5,  doubles: 0, triplePlus: 0, streaks: 1, roundLeadBonus: 5, finishingBonus: 20, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 4,  thru: '12', score: 'E',  pars: 44, birdies: 10, eagles: 0, aces: 0, bogeys: 8,  doubles: 0, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: 19, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 5,  thru: '10', score: '-1', pars: 41, birdies: 12, eagles: 1, aces: 0, bogeys: 7,  doubles: 0, triplePlus: 0, streaks: 1, roundLeadBonus: 5, finishingBonus: 18, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 6,  thru: 'F',  score: '+1', pars: 46, birdies: 9,  eagles: 0, aces: 0, bogeys: 9,  doubles: 1, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: 16, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 7,  thru: '8',  score: 'E',  pars: 43, birdies: 10, eagles: 0, aces: 0, bogeys: 7,  doubles: 0, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: 14, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 8,  thru: '14', score: '-2', pars: 45, birdies: 12, eagles: 0, aces: 0, bogeys: 5,  doubles: 0, triplePlus: 0, streaks: 2, roundLeadBonus: 0, finishingBonus: 12, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 9,  thru: '9',  score: '+1', pars: 42, birdies: 8,  eagles: 1, aces: 0, bogeys: 10, doubles: 1, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: 11, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 10, thru: '12', score: '-1', pars: 41, birdies: 11, eagles: 0, aces: 1, bogeys: 7,  doubles: 0, triplePlus: 0, streaks: 1, roundLeadBonus: 0, finishingBonus: 10, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 11, thru: 'F',  score: '+2', pars: 38, birdies: 8,  eagles: 0, aces: 0, bogeys: 11, doubles: 2, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: -10, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 12, thru: '7',  score: '-2', pars: 40, birdies: 12, eagles: 1, aces: 0, bogeys: 6,  doubles: 0, triplePlus: 0, streaks: 2, roundLeadBonus: 0, finishingBonus: 9,  lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 13, thru: '11', score: 'E',  pars: 43, birdies: 9,  eagles: 0, aces: 0, bogeys: 8,  doubles: 1, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: 8,  lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 14, thru: '10', score: '-1', pars: 39, birdies: 10, eagles: 0, acs: 0, bogeys: 6,  doubles: 0, triplePlus: 1, streaks: 1, roundLeadBonus: 0, finishingBonus: 7,  lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
];

const STATIC_ENTRIES = [
  { id: 2, name: 'Brady S.',  picks: [1, 3, 5, 7, 9, 11] },
  { id: 3, name: 'Megan T.', picks: [2, 4, 6, 8, 12, 13] },
  { id: 4, name: 'Ryan H.',  picks: [3, 4, 5, 9, 10, 14] },
];

/* ─── Storage ────────────────────────────────────────── */

const getRosterKey = (name: string, tid: string) => `${STORAGE_PREFIX}:roster:${name}:${tid}`;
const getSettingsKey = () => `${STORAGE_PREFIX}:settings`;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; }
  catch { return fallback; }
}
function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

const mockPoolService = {
  async loadSettings() { return readJson(getSettingsKey(), DEFAULT_SETTINGS); },
  async saveSettings(s: typeof DEFAULT_SETTINGS) { writeJson(getSettingsKey(), s); return s; },
  async loadRoster(name: string, tid: string) {
    return readJson<null | { entryName: string; tournamentId: string; playerIds: number[]; savedAt: string }>(getRosterKey(name, tid), null);
  },
  async saveRoster({ entryName, tournamentId, playerIds }: { entryName: string; tournamentId: string; playerIds: number[] }) {
    const payload = { entryName, tournamentId, playerIds, savedAt: new Date().toISOString() };
    writeJson(getRosterKey(entryName, tournamentId), payload);
    return payload;
  },
};

/* ─── Pure helpers ───────────────────────────────────── */

const scoreToNumber = (v: string) => (v === 'E' ? 0 : Number(v));

const scoreColor = (score: string | number) => {
  const n = typeof score === 'string' ? scoreToNumber(score) : score;
  if (n < 0) return 'text-red-600';
  if (n > 0) return 'text-gray-500';
  return 'text-gray-400';
};

const fmtScore = (n: number) => (n > 0 ? `+${n}` : String(n));

const calculatePlayerBonus = (p: any) =>
  p.pars + p.birdies * 3 + p.eagles * 5 + p.aces * 8 +
  p.bogeys * -1 + p.doubles * -3 + p.triplePlus * -5 +
  p.streaks * 3 + p.roundLeadBonus + p.finishingBonus + p.lowRoundBonus;

const buildPlayerView = (tid: string) => {
  const salMap = Object.fromEntries(TOURNAMENT_SALARIES.filter(r => r.tournamentId === tid).map(r => [r.playerId, r]));
  const liveMap = Object.fromEntries(LIVE_PLAYER_STATS.filter(r => r.tournamentId === tid).map(r => [r.playerId, r]));
  return PLAYERS.map(p => {
    const s = salMap[p.id]; const l = liveMap[p.id];
    if (!s || !l) return null;
    return { ...p, ...s, ...l };
  }).filter(Boolean);
};

const validateRoster = (roster: number[], byId: Record<number, any>) => {
  if (roster.length !== REQUIRED_GOLFERS) return { ok: false, message: `Select exactly ${REQUIRED_GOLFERS} golfers.` };
  if (roster.some(id => !byId[id])) return { ok: false, message: 'Roster contains invalid golfers.' };
  const salary = roster.reduce((s, id) => s + byId[id].salary, 0);
  if (salary > SALARY_CAP) return { ok: false, message: `Roster exceeds the $${SALARY_CAP.toLocaleString()} salary cap.` };
  return { ok: true, message: 'Roster is valid.' };
};

function getCountdown(lockAt: string) {
  const diff = new Date(lockAt).getTime() - Date.now();
  if (diff <= 0) return { isLocked: true, label: 'Locked' };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return { isLocked: false, label: `${h}h ${m}m` };
}

/* ─── Tournament logo placeholder ───────────────────── */

function TournamentLogo({ tid }: { tid: string }) {
  if (tid === 'pga') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ color: '#00205b', fontSize: 14, fontWeight: 700 }}>20</span>
          <div style={{
            width: 52, height: 52,
            borderRadius: '50%',
            border: '2.5px solid #00205b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}>
            <span style={{ color: '#00205b', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>AG</span>
            <div style={{ width: 24, height: 1.5, background: '#00205b' }} />
            <span style={{ color: '#00205b', fontSize: 6, fontWeight: 700, letterSpacing: 1 }}>CLUB</span>
          </div>
          <span style={{ color: '#00205b', fontSize: 14, fontWeight: 700 }}>26</span>
        </div>
        <div style={{ color: '#00205b', fontSize: 30, fontWeight: 900, letterSpacing: 3, lineHeight: 1.1 }}>PGA</div>
        <div style={{ color: '#00205b', fontSize: 8, fontWeight: 700, letterSpacing: 4, marginTop: 3 }}>ARONIMINK</div>
      </div>
    );
  }
  const configs: Record<string, { bg: string; fg: string; lines: string[] }> = {
    players:  { bg: '#00553a', fg: '#ffffff', lines: ['THE', 'PLAYERS', '2026'] },
    masters:  { bg: '#00553a', fg: '#f5d000', lines: ['MASTERS', '2026', 'AUGUSTA'] },
    'us-open':{ bg: '#002868', fg: '#ffffff', lines: ['U.S.', 'OPEN', '2026'] },
    open:     { bg: '#003087', fg: '#ffffff', lines: ['THE', 'OPEN', '2026'] },
  };
  const c = configs[tid] ?? configs['players'];
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-0.5" style={{ background: c.bg }}>
      {c.lines.map((line, i) => (
        <div
          key={i}
          style={{ color: c.fg, fontWeight: i === 1 ? 900 : 700, fontSize: i === 1 ? 28 : 13, letterSpacing: i === 1 ? 2 : 1 }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

/* ─── Main nav tabs ──────────────────────────────────── */

const MAIN_TABS = ['Standings', 'My entries', 'Reports', 'Message board', 'Details', 'Commissioner console'] as const;
type MainTab = typeof MAIN_TABS[number];

/* ─── Page ───────────────────────────────────────────── */

export default function Page() {
  const [mainTab, setMainTab] = useState<MainTab>('Standings');
  const [selectedTournament, setSelectedTournament] = useState(TOURNAMENTS[2].id); // default to PGA like screenshot
  const [entryName, setEntryName] = useState('Clayton Tucker');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [selectedRoster, setSelectedRoster] = useState<number[]>(DEFAULT_ROSTER);
  const [lastRefresh, setLastRefresh] = useState('2 minutes ago');
  const [syncStatus, setSyncStatus] = useState('Healthy');
  const [lastSavedAt, setLastSavedAt] = useState('Not saved yet');
  const [saveMessage, setSaveMessage] = useState('');
  const [countdownLabel, setCountdownLabel] = useState('...');
  const [autoLocked, setAutoLocked] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [isRosterSaving, setIsRosterSaving] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [showYtd, setShowYtd] = useState(false);

  const tournament = TOURNAMENTS.find(t => t.id === selectedTournament) ?? TOURNAMENTS[0];
  const tournamentPlayers = useMemo(() => buildPlayerView('players'), []);
  const playersById = useMemo(() => Object.fromEntries(tournamentPlayers.map((p: any) => [p.id, p])), [tournamentPlayers]);

  useEffect(() => {
    let cancelled = false;
    mockPoolService.loadSettings().then(s => { if (!cancelled) { setSettings(s); setIsBooting(false); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsRosterLoading(true);
    mockPoolService.loadRoster(entryName, 'players').then(saved => {
      if (cancelled) return;
      if (saved?.playerIds) { setSelectedRoster(saved.playerIds); setLastSavedAt(new Date(saved.savedAt).toLocaleString()); }
      else { setSelectedRoster(DEFAULT_ROSTER); setLastSavedAt('Not saved yet'); }
      setIsRosterLoading(false);
    });
    return () => { cancelled = true; };
  }, [entryName]);

  useEffect(() => {
    let cancelled = false;
    setIsSettingsSaving(true);
    mockPoolService.saveSettings(settings).then(() => { if (!cancelled) setIsSettingsSaving(false); });
    return () => { cancelled = true; };
  }, [settings]);

  useEffect(() => {
    const tick = () => { const c = getCountdown(tournament.lockAt); setAutoLocked(c.isLocked); setCountdownLabel(c.label); };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [tournament.lockAt]);

  const locked = settings.manualLock || autoLocked;

  const rosterPlayers = selectedRoster.map(id => playersById[id]).filter(Boolean);
  const salaryUsed = rosterPlayers.reduce((s: number, p: any) => s + p.salary, 0);
  const salaryRemaining = SALARY_CAP - salaryUsed;
  const salaryPct = Math.min(100, (salaryUsed / SALARY_CAP) * 100);
  const rosterRaw   = rosterPlayers.reduce((s: number, p: any) => s + scoreToNumber(p.score), 0);
  const rosterBonus = rosterPlayers.reduce((s: number, p: any) => s + calculatePlayerBonus(p), 0);
  const rosterNet   = rosterRaw - rosterBonus;

  const standings = [{ id: 1, name: entryName, picks: selectedRoster }, ...STATIC_ENTRIES]
    .map(entry => {
      const golfers = entry.picks.map(id => playersById[id]).filter(Boolean);
      const rawScore = golfers.reduce((s: number, p: any) => s + scoreToNumber(p.score), 0);
      const bonus    = golfers.reduce((s: number, p: any) => s + calculatePlayerBonus(p), 0);
      const net      = rawScore - bonus;
      const salary   = golfers.reduce((s: number, p: any) => s + p.salary, 0);
      return { ...entry, golfers, rawScore, bonus, net, salary };
    })
    .sort((a, b) => a.net - b.net)
    .map((e, i) => ({ ...e, place: i + 1 }));

  const projectedPot = standings.length * Number(settings.entryFee || 0);
  const payoutTotal  = Number(settings.payouts.first) + Number(settings.payouts.second) + Number(settings.payouts.third);

  const toggleRosterPlayer = (id: number) => {
    if (locked || isRosterLoading || isRosterSaving) return;
    if (selectedRoster.includes(id)) { setSelectedRoster(selectedRoster.filter(x => x !== id)); return; }
    if (selectedRoster.length >= REQUIRED_GOLFERS) return;
    const next = [...selectedRoster, id];
    if (next.reduce((s, i) => s + playersById[i].salary, 0) > SALARY_CAP) return;
    setSelectedRoster(next);
  };

  const handleSaveRoster = async () => {
    if (locked) { setSaveMessage('Lineups are locked.'); return; }
    const v = validateRoster(selectedRoster, playersById);
    if (!v.ok) { setSaveMessage(v.message); return; }
    setIsRosterSaving(true);
    const saved = await mockPoolService.saveRoster({ entryName, tournamentId: 'players', playerIds: selectedRoster });
    setLastSavedAt(new Date(saved.savedAt).toLocaleString());
    setSaveMessage('Lineup saved!');
    setIsRosterSaving(false);
  };

  const handleResetRoster = () => {
    if (locked || isRosterLoading || isRosterSaving) return;
    setSelectedRoster(DEFAULT_ROSTER);
    setSaveMessage('Reset to default picks.');
  };

  const simulateRefresh = () => {
    setSyncStatus(['Healthy', 'Delayed', 'Manual review'][Math.floor(Math.random() * 3)]);
    setLastRefresh(['just now', '1 minute ago', '2 minutes ago'][Math.floor(Math.random() * 3)]);
  };

  // Today = April 22 2026; players + masters are past, rest upcoming
  const today = new Date('2026-04-22');
  const tournamentTabs = [
    ...TOURNAMENTS.map(t => ({ ...t, isPast: new Date(t.lockAt) < today, isYtd: false })),
    { id: 'ytd', name: 'Year-to-Date', shortName: 'Year-to-Date', venue: '', lockTimeLabel: '', lockAt: '', isPast: false, isYtd: true },
  ];

  const activeLeaderboardTid = showYtd ? 'ytd' : selectedTournament;
  const hasTournamentData = activeLeaderboardTid === 'players' || activeLeaderboardTid === 'ytd';

  const tdClass = (t: typeof tournamentTabs[0]) => {
    const isActive = showYtd ? t.isYtd : (!t.isYtd && t.id === selectedTournament);
    if (isActive) return 'active-tab';
    if (t.isYtd) return 'ytd-tab';
    if (t.isPast) return 'past-tab';
    return 'future-tab';
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#e8edf3' }}>

      {/* ══ Header ══ */}
      <header
        className="shrink-0"
        style={{
          background: 'linear-gradient(180deg, #0c1628 0%, #162040 55%, #1a2848 100%)',
          color: '#fff',
          boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
        }}
      >
        {/* Top strip */}
        <div className="flex items-center gap-5 px-8 py-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold leading-tight tracking-tight" style={{ fontSize: 17 }}>2026 Golf Majors Pool</span>
              <Info className="h-4 w-4 shrink-0" style={{ color: '#5a7fa0' }} />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium" style={{ color: '#5a7fa0' }}>3/12</span>
              <span style={{ color: '#2a4060', fontSize: 14 }}>•</span>
              <span
                className="text-xs px-3 py-1 rounded-full font-semibold"
                style={{ border: '1px solid #2a4a70', color: '#7ab8e0', background: 'rgba(0,150,220,0.12)' }}
              >
                Golf Majors
              </span>
              <Flag className="h-3.5 w-3.5" style={{ color: '#5a7fa0' }} />
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div
              className="flex items-center justify-center"
              style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <Bell className="h-4 w-4" style={{ color: '#7ab8e0' }} />
            </div>
            <div className="text-right">
              <div className="font-bold leading-tight" style={{ fontSize: 15 }}>23 Contest Entries</div>
              <div className="text-xs mt-0.5" style={{ color: '#5a7fa0' }}>Your Entries: 1/1 allowed</div>
            </div>
          </div>
        </div>

        {/* Nav tabs */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} className="px-8">
          <div className="flex items-end gap-1">
            {MAIN_TABS.map(tab => {
              const isActive = mainTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setMainTab(tab)}
                  className="whitespace-nowrap transition-all"
                  style={{
                    background: isActive ? 'rgba(0,188,212,0.12)' : 'transparent',
                    border: 'none',
                    outline: 'none',
                    borderBottom: isActive ? '2px solid #00d4ee' : '2px solid transparent',
                    borderRadius: '4px 4px 0 0',
                    color: isActive ? '#00d4ee' : '#7a94b0',
                    cursor: 'pointer',
                    padding: '12px 16px',
                    fontSize: 13.5,
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: isActive ? '0.01em' : 0,
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = '#c0d8f0'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = '#7a94b0'; }}
                >
                  {tab}
                  {tab === 'Reports' && <ChevronDown className="h-3.5 w-3.5 inline ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ══ Main content ══ */}
      <main className="flex-1 overflow-hidden">

        {/* ─── STANDINGS (Leaderboard) ─── */}
        {mainTab === 'Standings' && (
          <div className="overflow-y-auto h-full">
            <div className="max-w-6xl mx-auto px-8 py-8">

              <h1 className="font-black text-gray-900 mb-6 tracking-tight" style={{ fontSize: 28, letterSpacing: '-0.02em' }}>Leaderboard</h1>

              {/* White card with tabs inside */}
              <div
                className="bg-white rounded-2xl"
                style={{
                  border: '1px solid rgba(0,0,0,0.07)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.10)',
                }}
              >

                {/* Tournament sub-tabs */}
                <div
                  className="flex items-end gap-2 px-5 pt-3 overflow-x-auto"
                  style={{
                    background: 'linear-gradient(to bottom, #f6f8fb, #edf0f5)',
                    borderBottom: '1px solid #d4d9e3',
                    borderRadius: '16px 16px 0 0',
                  }}
                >
                  {tournamentTabs.map(t => {
                    const tabClass = tdClass(t);
                    const isActive = tabClass === 'active-tab';
                    const isYtd = tabClass === 'ytd-tab';

                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          if (t.isYtd) { setShowYtd(true); }
                          else { setShowYtd(false); setSelectedTournament(t.id); }
                        }}
                        className="shrink-0 text-sm whitespace-nowrap transition-colors"
                        style={isActive ? {
                          padding: '9px 20px',
                          marginBottom: '-1px',
                          background: '#ffffff',
                          border: '1px solid #bcc5d4',
                          borderBottom: '2px solid #ffffff',
                          borderRadius: '8px 8px 0 0',
                          color: '#0f172a',
                          fontWeight: 700,
                          fontSize: 13.5,
                          position: 'relative' as const,
                          zIndex: 2,
                          cursor: 'pointer',
                          boxShadow: '0 -4px 14px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
                          letterSpacing: '0.01em',
                        } : {
                          padding: '9px 20px',
                          color: isYtd ? '#0284c7' : '#0369a1',
                          fontWeight: isYtd ? 700 : 500,
                          fontSize: 13.5,
                          background: 'linear-gradient(to bottom, #ffffff, #f0f4f9)',
                          border: '1px solid #c8d0dc',
                          borderBottom: '1px solid #d4d9e3',
                          borderRadius: '7px 7px 0 0',
                          cursor: 'pointer',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 -2px 6px rgba(0,0,0,0.04)',
                        }}
                      >
                        {t.shortName}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content */}
                <div className="overflow-hidden rounded-b-xl">
                {hasTournamentData ? (
                  /* ── Standings table (The Players or Year-to-Date) ── */
                  <div>
                    {/* Prize row */}
                    <div className="grid grid-cols-4 border-b border-gray-100" style={{ background: 'linear-gradient(to right, #f0fafe, #e8f4fc, #f0f7ff)' }}>
                      {([
                        { label: 'Prize Pool', value: `$${projectedPot.toLocaleString()}`, color: '#b45309' },
                        { label: '1st Place',  value: `$${Math.round(projectedPot * settings.payouts.first / 100).toLocaleString()}`, color: '#b45309' },
                        { label: 'Entries',    value: standings.length, color: '#1a1a1a' },
                        { label: 'Entry Fee',  value: `$${settings.entryFee}`, color: '#047857' },
                      ] as any[]).map(({ label, value, color }) => (
                        <div key={label} className="px-6 py-5 border-r border-gray-200 last:border-0">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{label}</div>
                          <div className="text-xl font-black" style={{ color }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Table header */}
                    <div className="grid grid-cols-[60px,1fr,100px,72px,72px,80px] gap-3 px-6 py-3 border-b border-gray-100" style={{ background: 'linear-gradient(to right, #f3f5f8, #eaedf2)' }}>
                      {['Place', 'Entry', 'Salary', 'Raw', 'Bonus', 'Net'].map(h => (
                        <span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{h}</span>
                      ))}
                    </div>

                    {standings.map((entry: any) => (
                      <div
                        key={entry.id}
                        className="grid grid-cols-[60px,1fr,100px,72px,72px,80px] gap-3 items-center px-6 py-4 border-b border-gray-50 last:border-0 transition-all duration-200 hover:bg-gray-50"
                        style={entry.name === entryName ? { background: '#f0fdf9' } : {}}
                      >
                        <div className="font-bold text-base">
                          {entry.place === 1 ? '🥇' : entry.place === 2 ? '🥈' : entry.place === 3 ? '🥉' : (
                            <span className="text-gray-400 text-sm">#{entry.place}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{entry.name}</span>
                            {entry.name === entryName && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: '#d1fae5', color: '#065f46' }}>You</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{entry.golfers.length} golfers</div>
                        </div>
                        <span className="text-sm text-gray-600 tabular-nums">${entry.salary.toLocaleString()}</span>
                        <span className={`text-sm font-bold tabular-nums ${scoreColor(entry.rawScore)}`}>{fmtScore(entry.rawScore)}</span>
                        <span className="text-sm font-bold tabular-nums text-blue-600">{entry.bonus}</span>
                        <span className={`text-base font-black tabular-nums ${scoreColor(entry.net)}`}>{fmtScore(entry.net)}</span>
                      </div>
                    ))}

                    {/* Sync footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100" style={{ background: 'linear-gradient(to right, #f3f5f8, #eaedf2)' }}>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        <span>Last sync {lastRefresh}</span>
                        <span>·</span>
                        <Shield className="h-3.5 w-3.5" />
                        <span>Unofficial source</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                          style={{
                            background: syncStatus === 'Healthy' ? '#d1fae5' : syncStatus === 'Delayed' ? '#fef3c7' : '#fee2e2',
                            color: syncStatus === 'Healthy' ? '#065f46' : syncStatus === 'Delayed' ? '#92400e' : '#991b1b',
                          }}
                        >
                          {syncStatus}
                        </span>
                      </div>
                      <button
                        onClick={simulateRefresh}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Coming soon card (upcoming tournaments) ── */
                  <div>
                    <div className="p-8 flex gap-8">
                      {/* Tournament logo */}
                      <div
                        className="shrink-0 w-44 h-44 overflow-hidden"
                        style={{
                          borderRadius: 10,
                          border: '2px solid #e2e8f0',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8)',
                        }}
                      >
                        <TournamentLogo tid={selectedTournament} />
                      </div>

                      {/* Info text */}
                      <div className="pt-1 flex flex-col justify-center">
                        <p className="font-semibold mb-3" style={{ color: '#0f172a', fontSize: 15.5, lineHeight: 1.5 }}>
                          The {tournament.name} begins on{' '}
                          <span style={{ color: '#0369a1' }}>
                            {new Date(tournament.lockAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>.
                        </p>
                        <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.65 }}>
                          Picks can not be entered until the tournament field has been finalized and entered in our system (usually Monday morning the week of the tournament).
                        </p>
                      </div>
                    </div>

                    {/* Info banner */}
                    <div
                      className="px-6 py-4 flex items-start gap-3"
                      style={{
                        background: 'linear-gradient(to right, #e0f7fa, #e8f5fb)',
                        borderTop: '1px solid #b2d8e8',
                      }}
                    >
                      <div
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                        style={{ background: 'linear-gradient(135deg, #0288d1, #0097a7)', color: '#fff', fontSize: 10, fontWeight: 900, boxShadow: '0 2px 6px rgba(2,136,209,0.35)' }}
                      >
                        i
                      </div>
                      <p className="text-sm" style={{ color: '#1e3a4a', lineHeight: 1.6 }}>
                        Reminder: To modify your list of active tournaments, please go to your{' '}
                        <button
                          onClick={() => setMainTab('Commissioner console')}
                          style={{ color: '#0288d1', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                        >
                          tournament settings
                        </button>
                        .
                      </p>
                    </div>
                  </div>
                )}
                </div>
              </div>

              {/* Payout structure card */}
              {hasTournamentData && (
                <div
                  className="mt-5 bg-white rounded-2xl overflow-hidden"
                  style={{ border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.08)' }}
                >
                  <div className="px-6 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(to right, #f0fafe, #e8f4fc)' }}>
                    <h3 className="font-bold text-gray-900 text-sm tracking-wide">Payout Structure</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Send to {settings.venmo}</p>
                  </div>
                  <div className="p-5 grid grid-cols-3 gap-3">
                    {([
                      { icon: '🥇', label: '1st Place', pct: settings.payouts.first, grad: 'linear-gradient(135deg, #fef9e7, #fef3c7)' },
                      { icon: '🥈', label: '2nd Place', pct: settings.payouts.second, grad: 'linear-gradient(135deg, #f8fafc, #f0f4f8)' },
                      { icon: '🥉', label: '3rd Place', pct: settings.payouts.third, grad: 'linear-gradient(135deg, #fff7f0, #fef0e6)' },
                    ] as any[]).map(({ icon, label, pct, grad }) => (
                      <div
                        key={label}
                        className="rounded-xl px-5 py-4 flex items-center justify-between"
                        style={{ background: grad, border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                      >
                        <span className="text-sm font-semibold text-gray-700">{icon} {label}</span>
                        <div className="text-right">
                          <div className="text-lg font-black text-gray-900">${Math.round(projectedPot * pct / 100).toLocaleString()}</div>
                          <div className="text-xs text-gray-400">{pct}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── MY ENTRIES (My Picks) ─── */}
        {mainTab === 'My entries' && (
          <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 113px)' }}>

            {/* Left: Player pool */}
            <div className="flex flex-col flex-1 overflow-hidden bg-white border-r border-gray-200" style={{ boxShadow: '4px 0 20px rgba(0, 0, 0, 0.08)' }}>

              {/* Contest bar */}
              <div className="shrink-0 grid grid-cols-4 border-b border-gray-100" style={{ background: 'linear-gradient(to right, #f0fafe, #e8f4fc, #f0f7ff)' }}>
                {([
                  { label: 'Tournament', value: 'The Players Championship' },
                  { label: 'Venue', value: 'TPC Sawgrass' },
                  { label: 'Entry Fee', value: `$${settings.entryFee}`, color: '#047857' },
                  { label: 'Prize Pool', value: `$${projectedPot.toLocaleString()}`, color: '#b45309' },
                ] as any[]).map(({ label, value, color }) => (
                  <div key={label} className="px-6 py-4 border-r border-gray-200 last:border-0 bg-gray-50">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
                    <div className="text-sm font-semibold mt-0.5 truncate" style={{ color: color ?? '#1a1a1a' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Column headers */}
              <div className="shrink-0 grid grid-cols-[48px,1fr,56px,64px,80px,96px] gap-3 items-center px-6 py-3 border-b border-gray-100" style={{ background: 'linear-gradient(to right, #f3f5f8, #eaedf2)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-center">RK</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Player</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-center">Thru</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-center">Score</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Salary</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-center">Action</span>
              </div>

              {/* Player rows */}
              <div className="overflow-y-auto flex-1">
                {isRosterLoading ? (
                  <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading roster…</div>
                ) : (
                  tournamentPlayers.map((player: any) => {
                    const selected = selectedRoster.includes(player.id);
                    const wouldExceedCap = !selected && salaryUsed + player.salary > SALARY_CAP;
                    const atLimit = !selected && selectedRoster.length >= REQUIRED_GOLFERS;
                    const canAdd = !locked && !isRosterSaving && !wouldExceedCap && !atLimit && !selected;
                    const canRemove = !locked && !isRosterSaving && selected;

                    return (
                      <div
                        key={player.id}
                        onClick={() => (canAdd || canRemove) ? toggleRosterPlayer(player.id) : undefined}
                        className="grid grid-cols-[48px,1fr,56px,64px,80px,96px] gap-3 items-center px-6 py-4 border-b border-gray-50 transition-all duration-200"
                        style={{
                          background: selected ? '#f0fdf9' : 'white',
                          cursor: canAdd || canRemove ? 'pointer' : 'not-allowed',
                          opacity: (!canAdd && !selected) ? 0.4 : 1,
                          boxShadow: selected ? 'inset 3px 0 0 #00bcd4' : undefined,
                        }}
                        onMouseEnter={e => { if (canAdd && !selected) (e.currentTarget as HTMLElement).style.background = '#f9f9f9'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selected ? '#f0fdf9' : 'white'; }}
                      >
                        <span className="text-xs text-gray-400 text-center font-medium tabular-nums">{player.owgr}</span>

                        <div className="min-w-0 flex items-center gap-2.5">
                          <div
                            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black"
                            style={{ background: selected ? '#d1fae5' : '#f3f4f6', color: selected ? '#065f46' : '#6b7280' }}
                          >
                            {player.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">{player.name}</span>
                              {selected && (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: '#d1fae5', color: '#065f46' }}>
                                  In Lineup
                                </span>
                              )}
                              {wouldExceedCap && (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>
                                  Over Cap
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">{player.odds} outright</div>
                          </div>
                        </div>

                        <span className="text-xs text-gray-500 text-center tabular-nums">{player.thru}</span>
                        <span className={`text-sm font-bold text-center tabular-nums ${scoreColor(player.score)}`}>{player.score}</span>
                        <span className="text-sm font-semibold tabular-nums" style={{ color: '#047857' }}>${(player.salary / 1000).toFixed(1)}K</span>

                        <button
                          onClick={e => { e.stopPropagation(); toggleRosterPlayer(player.id); }}
                          disabled={!canAdd && !canRemove}
                          className="py-2 rounded-lg text-[11px] font-bold tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                          style={selected
                            ? {
                              background: 'linear-gradient(to bottom, #f87171, #dc2626)',
                              color: '#fff',
                              border: '1px solid #b91c1c',
                              boxShadow: '0 2px 8px rgba(220,38,38,0.30), inset 0 1px 0 rgba(255,255,255,0.15)',
                            }
                            : {
                              background: 'linear-gradient(to bottom, #34d399, #059669)',
                              color: '#fff',
                              border: '1px solid #047857',
                              boxShadow: '0 2px 8px rgba(5,150,105,0.28), inset 0 1px 0 rgba(255,255,255,0.15)',
                            }
                          }
                        >
                          {selected ? 'REMOVE' : '+ ADD'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Lineup builder */}
            <div className="w-[300px] xl:w-[330px] shrink-0 flex flex-col bg-white" style={{ boxShadow: '-4px 0 28px rgba(0, 0, 0, 0.12)' }}>

              {/* Header + salary bar */}
              <div className="shrink-0 border-b border-gray-100 px-6 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, #e8f8fc, #e0f0fb)' }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">My Lineup</span>
                  <span className="text-xs text-gray-400">{selectedRoster.length}/{REQUIRED_GOLFERS} picks</span>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Salary Cap</span>
                    <span className="font-bold tabular-nums" style={{ color: salaryRemaining < 0 ? '#dc2626' : '#374151' }}>
                      ${salaryUsed.toLocaleString()} / $50K
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${salaryPct}%`, background: salaryRemaining < 0 ? '#dc2626' : '#00bcd4' }}
                    />
                  </div>
                  <div className="mt-1 text-right text-xs font-semibold" style={{ color: salaryRemaining < 0 ? '#dc2626' : '#047857' }}>
                    ${salaryRemaining.toLocaleString()} remaining
                  </div>
                </div>
              </div>

              {/* Slots */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {Array.from({ length: REQUIRED_GOLFERS }, (_, i) => {
                  const p: any = playersById[selectedRoster[i]];
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4 rounded-lg border p-4 transition-all"
                      style={p
                        ? { borderColor: '#a7f3d0', background: '#f0fdf9' }
                        : { borderColor: '#e5e7eb', background: '#f9fafb' }
                      }
                    >
                      <div
                        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
                        style={p
                          ? { background: '#d1fae5', color: '#065f46' }
                          : { background: '#e5e7eb', color: '#9ca3af' }
                        }
                      >
                        {i + 1}
                      </div>
                      {p ? (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">${p.salary.toLocaleString()} · OWGR #{p.owgr}</div>
                          </div>
                          <span className={`text-sm font-bold shrink-0 tabular-nums ${scoreColor(p.score)}`}>{p.score}</span>
                          {!locked && (
                            <button onClick={() => toggleRosterPlayer(p.id)} className="shrink-0 text-gray-300 hover:text-red-500 transition-colors ml-0.5">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Empty slot</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Score + actions */}
              <div className="shrink-0 border-t border-gray-100 p-5 space-y-4" style={{ background: 'linear-gradient(to bottom, #f5f8fc, #eef2f8)' }}>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { label: 'Raw', val: fmtScore(rosterRaw), color: scoreColor(rosterRaw) },
                    { label: 'Bonus', val: `+${rosterBonus}`, color: 'text-blue-600' },
                    { label: 'Net', val: fmtScore(rosterNet), color: scoreColor(rosterNet) },
                  ] as any[]).map(({ label, val, color }) => (
                    <div key={label} className="text-center rounded-lg border border-gray-200 bg-white py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{label}</div>
                      <div className={`text-base font-black tabular-nums ${color}`}>{val}</div>
                    </div>
                  ))}
                </div>

                {saveMessage && (
                  <div className="text-xs text-gray-600 bg-white border border-gray-200 rounded px-3 py-2 text-center">
                    {saveMessage}
                  </div>
                )}

                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 text-center">
                  {isRosterLoading ? 'Loading…' : `Saved: ${lastSavedAt}`}
                </div>

                <button
                  onClick={handleSaveRoster}
                  disabled={isRosterSaving || isRosterLoading || locked}
                  className="w-full py-4 text-white font-black text-base rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #00d4e8 0%, #00a8c8 50%, #0080b0 100%)',
                    boxShadow: '0 4px 18px rgba(0,168,200,0.45), inset 0 1px 0 rgba(255,255,255,0.20)',
                    border: '1px solid rgba(0,160,200,0.5)',
                    letterSpacing: '0.06em',
                  }}
                >
                  <Save className="h-5 w-5" />
                  {isRosterSaving ? 'SAVING…' : 'SAVE LINEUP'}
                </button>
                <button
                  onClick={handleResetRoster}
                  disabled={isRosterSaving || isRosterLoading || locked}
                  className="w-full py-2 text-gray-400 hover:text-gray-700 disabled:opacity-40 text-sm font-semibold transition-colors"
                >
                  Reset to default picks
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── REPORTS ─── */}
        {mainTab === 'Reports' && (
          <div className="overflow-y-auto h-full">
            <div className="max-w-5xl mx-auto px-6 py-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Reports</h1>
              <div className="bg-white border border-gray-200 shadow-xl rounded-xl p-6" style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)' }}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {tournamentPlayers.slice(0, 6).map((player: any, idx: number) => (
                    <div key={player.id} className="flex items-center gap-4 border border-gray-200 rounded p-4">
                      <div className="text-2xl font-black text-gray-300 w-8">{idx + 1}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{player.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">Thru {player.thru} · {player.odds}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-black text-lg tabular-nums ${scoreColor(player.score)}`}>{player.score}</div>
                        <div className="text-xs font-semibold text-blue-600">+{calculatePlayerBonus(player)} pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MESSAGE BOARD ─── */}
        {mainTab === 'Message board' && (
          <div className="overflow-y-auto h-full">
            <div className="max-w-5xl mx-auto px-6 py-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Message Board</h1>
              <div className="bg-white border border-gray-300 shadow-lg rounded-lg p-8 text-center text-gray-400">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-sm">No messages yet. Post updates and trash talk here once connected to a real backend.</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── DETAILS (Rules and Scoring) ─── */}
        {mainTab === 'Details' && (
          <div className="overflow-y-auto h-full">
            <div className="max-w-5xl mx-auto px-6 py-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Details</h1>

              <div className="grid gap-5 lg:grid-cols-2">

                <div className="bg-white border border-gray-300 shadow-xl rounded-xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)' }}>
                  <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50">
                    <h2 className="font-bold text-gray-900">Pool Rules</h2>
                    <p className="text-xs text-gray-400 mt-0.5">How to play</p>
                  </div>
                  <div className="p-5 space-y-4">
                    {([
                      {
                        title: 'Roster Construction',
                        items: [
                          'Pick 6 golfers per tournament.',
                          'Total salary must not exceed $50,000.',
                          'Salaries blend world ranking with Vegas odds.',
                          'Editable until the first tee time of the event.',
                        ],
                      },
                      {
                        title: 'Scoring',
                        items: [
                          'Raw score = sum of all 6 golfers\' tournament scores.',
                          'Bonus points are subtracted to produce net score.',
                          'Lower net score ranks higher in the standings.',
                          'Updates refresh using unofficial leaderboard data.',
                        ],
                      },
                    ] as any[]).map(({ title, items }) => (
                      <div key={title} className="rounded border border-gray-200 p-4">
                        <div className="text-sm font-bold text-gray-800 mb-3">{title}</div>
                        <ul className="space-y-2">
                          {items.map((item: string) => (
                            <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                              <span style={{ color: '#00bcd4' }} className="shrink-0 mt-0.5">›</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-300 shadow-xl rounded-xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)' }}>
                  <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50">
                    <h2 className="font-bold text-gray-900">Bonus Scoring</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Subtracted from raw score</p>
                  </div>
                  <div className="grid grid-cols-[1fr,60px] gap-3 px-5 py-2 bg-gray-100 border-b border-gray-200">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Category</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 text-right">Pts</span>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
                    {BONUS_ROWS.map(([label, points]) => (
                      <div key={label} className="grid grid-cols-[1fr,60px] gap-3 items-center px-5 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        <span className="text-sm text-gray-700">{label}</span>
                        <span className={`text-sm font-bold text-right tabular-nums ${Number(points) > 0 ? 'text-green-600' : Number(points) < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {Number(points) > 0 ? `+${points}` : points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── COMMISSIONER CONSOLE (Admin) ─── */}
        {mainTab === 'Commissioner console' && (
          <div className="overflow-y-auto h-full">
            <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
              <h1 className="text-2xl font-bold text-gray-900">Commissioner Console</h1>

              <div className="bg-white border border-gray-300 shadow-xl rounded-xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)' }}>
                <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900">Pool Settings</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Manage your pool configuration</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>
                    Owner Only
                  </span>
                </div>

                <div className="p-6 grid gap-6 sm:grid-cols-2">
                  {([
                    { label: 'Entry Name', input: <input value={entryName} onChange={e => setEntryName(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 text-sm outline-none focus:border-teal-400 transition-colors" /> },
                    { label: 'Venmo Handle', input: <input value={settings.venmo} onChange={e => setSettings({ ...settings, venmo: e.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 text-sm outline-none focus:border-teal-400 transition-colors" /> },
                    { label: 'Entry Fee ($)', input: <input type="number" value={settings.entryFee} onChange={e => setSettings({ ...settings, entryFee: Number(e.target.value) })} className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 text-sm outline-none focus:border-teal-400 transition-colors" /> },
                    {
                      label: 'Lineup Lock',
                      input: (
                        <button
                          onClick={() => setSettings({ ...settings, manualLock: !settings.manualLock })}
                          className="w-full py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 border"
                          style={locked
                            ? { background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }
                            : { background: '#d1fae5', color: '#065f46', borderColor: '#6ee7b7' }
                          }
                        >
                          {locked ? <><Lock className="h-4 w-4" /> LOCKED — Click to Open</> : <><Unlock className="h-4 w-4" /> OPEN — Click to Lock</>}
                        </button>
                      ),
                    },
                  ] as any[]).map(({ label, input }) => (
                    <label key={label} className="block rounded-lg border border-gray-200 bg-gray-50 p-5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">{label}</div>
                      {input}
                    </label>
                  ))}
                </div>

                <div className="px-6 pb-6">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Payout Splits (%)</div>
                  <div className="grid grid-cols-3 gap-4">
                    {([
                      { label: '1st Place', key: 'first' as const },
                      { label: '2nd Place', key: 'second' as const },
                      { label: '3rd Place', key: 'third' as const },
                    ] as const).map(({ label, key }) => (
                      <label key={key} className="block rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs text-gray-400 mb-3">{label}</div>
                        <input
                          type="number"
                          value={settings.payouts[key]}
                          onChange={e => setSettings({ ...settings, payouts: { ...settings.payouts, [key]: Number(e.target.value) } })}
                          className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-gray-900 text-sm outline-none focus:border-teal-400 transition-colors"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full flex items-center gap-1"
                      style={{ background: payoutTotal === 100 ? '#d1fae5' : '#fef3c7', color: payoutTotal === 100 ? '#065f46' : '#92400e' }}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Total: {payoutTotal}%
                    </span>
                    <span className={`text-xs ${isSettingsSaving ? 'text-gray-400 animate-pulse' : 'text-gray-300'}`}>
                      {isSettingsSaving ? 'Saving…' : 'Auto-saved'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-300 shadow-xl rounded-xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)' }}>
                <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50">
                  <h2 className="font-bold text-gray-900">Semi-live Feed Workflow</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Operating model using unofficial leaderboard data</p>
                </div>
                <div className="p-6 space-y-4">
                  {([
                    { icon: <RefreshCw className="h-5 w-5 text-blue-500" />,     title: 'Refresh leaderboard every 2–5 minutes', desc: 'Normalize player score, thru, status, and last update time into your database.' },
                    { icon: <TrendingUp className="h-5 w-5 text-green-500" />,   title: 'Recompute entry scores after each sync', desc: 'Raw team score and bonus points are recalculated from stored golfer states.' },
                    { icon: <AlertCircle className="h-5 w-5 text-amber-500" />,  title: 'Flag source issues for manual review', desc: 'If the feed is delayed or parsing fails, the site shows last good data and a warning.' },
                    { icon: <Flag className="h-5 w-5 text-gray-400" />,          title: 'Lock at first tee time', desc: 'No roster edits after official start — enforced server-side in production.' },
                  ] as any[]).map(({ icon, title, desc }) => (
                    <div key={title} className="flex items-start gap-5 rounded-lg border border-gray-200 bg-gray-50 p-5">
                      <div className="shrink-0 mt-0.5 p-2 rounded bg-white border border-gray-200">{icon}</div>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{title}</div>
                        <div className="mt-1 text-xs text-gray-500">{desc}</div>
                      </div>
                    </div>
                  ))}
                  <button onClick={simulateRefresh} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all">
                    <Settings2 className="h-5 w-5" /> Run simulated sync
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ══ Footer ══ */}
      <footer className="shrink-0 px-6 py-3 flex items-center justify-between text-xs" style={{ background: 'linear-gradient(to right, #e0e6ee, #dce4ee)', borderTop: '1px solid #c8d2de', color: '#64748b' }}>
        <span>MVP prototype · connect auth, DB, and live data feeds to go live</span>
        <button
          onClick={() => setMainTab('Commissioner console')}
          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
        >
          Next: connect real APIs <ChevronRight className="h-3 w-3" />
        </button>
      </footer>
    </div>
  );
}
