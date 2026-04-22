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

const BACKEND_MAPPING_NOTES = [
  'tournaments -> schedule, lock time, status',
  'players -> master player directory',
  'tournamentSalaries -> one row per player per event',
  'entries -> one saved roster shell per user per tournament',
  'entryPicks -> exactly 6 picks tied to an entry',
  'livePlayerStats -> refreshed every 2–5 minutes from leaderboard ingest',
  'poolSettings -> admin-controlled payout and payment details',
];

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
  { id: 'players', name: 'The Players Championship', shortName: 'Players', venue: 'TPC Sawgrass', lockTimeLabel: 'Thu 7:40 AM', lockAt: '2026-03-12T07:40:00' },
  { id: 'masters', name: 'The Masters', shortName: 'Masters', venue: 'Augusta National', lockTimeLabel: 'Thu 7:30 AM', lockAt: '2026-04-09T07:30:00' },
  { id: 'pga', name: 'PGA Championship', shortName: 'PGA Champ.', venue: 'TBD', lockTimeLabel: 'Thu 7:20 AM', lockAt: '2026-05-14T07:20:00' },
  { id: 'us-open', name: 'U.S. Open', shortName: 'US Open', venue: 'TBD', lockTimeLabel: 'Thu 7:15 AM', lockAt: '2026-06-18T07:15:00' },
  { id: 'open', name: 'The Open Championship', shortName: 'The Open', venue: 'TBD', lockTimeLabel: 'Thu 6:35 AM', lockAt: '2026-07-16T06:35:00' },
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
  { tournamentId: 'players', playerId: 14, thru: '10', score: '-1', pars: 39, birdies: 10, eagles: 0, aces: 0, bogeys: 6,  doubles: 0, triplePlus: 1, streaks: 1, roundLeadBonus: 0, finishingBonus: 7,  lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
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
  if (n < 0) return 'text-emerald-400';
  if (n > 0) return 'text-rose-400';
  return 'text-slate-400';
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

/* ─── Small UI atoms ─────────────────────────────────── */

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'amber' | 'blue' | 'red' }) {
  const cls = {
    slate: 'bg-[#1a2d47]/70 text-slate-400 border-slate-700/30',
    green: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/25',
    amber: 'bg-amber-950/60 text-amber-400 border-amber-500/25',
    blue:  'bg-sky-950/60 text-sky-400 border-sky-500/25',
    red:   'bg-rose-950/60 text-rose-400 border-rose-500/25',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

const PANEL = 'rounded-2xl border border-[#1c2d48] overflow-hidden';
const PANEL_HEAD = 'bg-[#0c1626] border-b border-[#1c2d48] px-5 py-3.5';
const COL_LABEL = 'text-[10px] font-semibold uppercase tracking-widest text-[#3d5878]';

/* ─── Page ───────────────────────────────────────────── */

export default function Page() {
  const [selectedTournament, setSelectedTournament] = useState(TOURNAMENTS[0].id);
  const [activeTab, setActiveTab] = useState('My Picks');
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

  const tournament = TOURNAMENTS.find(t => t.id === selectedTournament) ?? TOURNAMENTS[0];
  const tournamentPlayers = useMemo(() => buildPlayerView(selectedTournament), [selectedTournament]);
  const playersById = useMemo(() => Object.fromEntries(tournamentPlayers.map((p: any) => [p.id, p])), [tournamentPlayers]);

  useEffect(() => {
    let cancelled = false;
    mockPoolService.loadSettings().then(s => { if (!cancelled) { setSettings(s); setIsBooting(false); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsRosterLoading(true);
    mockPoolService.loadRoster(entryName, selectedTournament).then(saved => {
      if (cancelled) return;
      if (saved?.playerIds) { setSelectedRoster(saved.playerIds); setLastSavedAt(new Date(saved.savedAt).toLocaleString()); }
      else { setSelectedRoster(DEFAULT_ROSTER); setLastSavedAt('Not saved yet'); }
      setIsRosterLoading(false);
    });
    return () => { cancelled = true; };
  }, [entryName, selectedTournament]);

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
    const saved = await mockPoolService.saveRoster({ entryName, tournamentId: selectedTournament, playerIds: selectedRoster });
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

  /* ── RENDER ── */
  return (
    <div className="flex h-screen flex-col bg-[#070d1a] text-[#f0f6ff] overflow-hidden">

      {/* ══ Header ══ */}
      <header className="shrink-0 flex h-14 items-center border-b border-[#1c2d48] bg-[#0c1626] px-5 gap-6">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25">
            <span className="text-sm leading-none">⛳</span>
          </div>
          <span className="text-[15px] font-black tracking-tight">
            MAJORS <span className="text-emerald-400">POOL</span>
          </span>
        </div>

        <nav className="flex items-center gap-1 flex-1">
          {(['My Picks', 'Standings', 'Rules and Scoring', 'Admin'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 ${
                activeTab === tab
                  ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.28)]'
                  : 'text-[#6b82a8] hover:text-[#f0f6ff] hover:bg-white/[0.05]'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {isBooting && <span className="text-xs text-[#2a4063] animate-pulse">Loading…</span>}
          <span className="text-sm text-[#6b82a8] font-medium hidden sm:block">{entryName}</span>
          <Badge tone={locked ? 'red' : 'green'}>
            {locked ? <><Lock className="h-2.5 w-2.5" /> Locked</> : <><Unlock className="h-2.5 w-2.5" /> Open</>}
          </Badge>
        </div>
      </header>

      {/* ══ Tournament selector strip ══ */}
      <div className="shrink-0 flex items-center gap-2 border-b border-[#1c2d48] bg-[#070d1a] px-5 py-2.5 overflow-x-auto">
        {TOURNAMENTS.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedTournament(t.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all duration-150 ${
              selectedTournament === t.id
                ? 'bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.3)]'
                : 'bg-[#0c1626] text-[#6b82a8] border border-[#1c2d48] hover:text-[#f0f6ff] hover:border-[#2a4063]'
            }`}
          >
            {t.shortName}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-4 text-xs shrink-0">
          <div className="text-[#3d5878] flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            Lock: <span className="text-slate-300 font-semibold ml-0.5">{tournament.lockTimeLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${autoLocked ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
            <span className={`font-bold ${autoLocked ? 'text-rose-400' : 'text-emerald-400'}`}>
              {autoLocked ? 'LOCKED' : countdownLabel + ' until lock'}
            </span>
          </div>
        </div>
      </div>

      {/* ══ Main content area ══ */}
      <main className="flex-1 overflow-hidden">

        {/* ─── MY PICKS ─── */}
        {activeTab === 'My Picks' && (
          <div className="flex h-full">

            {/* Left: Player pool */}
            <div className="flex flex-col flex-1 overflow-hidden border-r border-[#1c2d48]">

              {/* Contest context bar */}
              <div className="shrink-0 grid grid-cols-4 border-b border-[#1c2d48]">
                {([
                  { label: 'Tournament', value: tournament.name },
                  { label: 'Venue', value: tournament.venue },
                  { label: 'Entry Fee', value: `$${settings.entryFee}`, hi: 'text-emerald-400' },
                  { label: 'Prize Pool', value: `$${projectedPot.toLocaleString()}`, hi: 'text-amber-400' },
                ] as any[]).map(({ label, value, hi }) => (
                  <div key={label} className="px-4 py-3 border-r border-[#1c2d48] last:border-0 bg-[#0c1626]">
                    <div className={COL_LABEL}>{label}</div>
                    <div className={`text-sm font-semibold mt-0.5 truncate ${hi ?? 'text-[#f0f6ff]'}`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Column headers */}
              <div className="shrink-0 grid grid-cols-[48px,1fr,56px,64px,80px,96px] gap-3 items-center px-5 py-2.5 bg-[#070d1a] border-b border-[#1c2d48]">
                <span className={COL_LABEL + ' text-center'}>RK</span>
                <span className={COL_LABEL}>Player</span>
                <span className={COL_LABEL + ' text-center'}>Thru</span>
                <span className={COL_LABEL + ' text-center'}>Score</span>
                <span className={COL_LABEL}>Salary</span>
                <span className={COL_LABEL + ' text-center'}>Action</span>
              </div>

              {/* Player rows */}
              <div className="overflow-y-auto flex-1">
                {isRosterLoading ? (
                  <div className="flex items-center justify-center h-32 text-[#3d5878] text-sm">Loading roster…</div>
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
                        className={`grid grid-cols-[48px,1fr,56px,64px,80px,96px] gap-3 items-center px-5 py-3 border-b border-[#1c2d48]/50 transition-all ${
                          selected
                            ? 'bg-emerald-950/20 shadow-[inset_3px_0_0_rgba(16,185,129,0.5)] cursor-pointer'
                            : canAdd
                              ? 'hover:bg-[#0f1e35]/50 cursor-pointer'
                              : 'opacity-30 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-xs text-[#3d5878] text-center font-medium tabular-nums">{player.owgr}</span>

                        <div className="min-w-0 flex items-center gap-2.5">
                          <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black ${
                            selected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#0f1e35] text-[#4d6a8a]'
                          }`}>
                            {player.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-[#f0f6ff]">{player.name}</span>
                              {selected && <Badge tone="green">In Lineup</Badge>}
                              {wouldExceedCap && <Badge tone="amber">Over Cap</Badge>}
                            </div>
                            <div className="text-[11px] text-[#3d5878] mt-0.5">{player.odds} outright</div>
                          </div>
                        </div>

                        <span className="text-xs text-slate-400 text-center tabular-nums">{player.thru}</span>
                        <span className={`text-sm font-bold text-center tabular-nums ${scoreColor(player.score)}`}>{player.score}</span>
                        <span className="text-sm font-semibold text-emerald-400 tabular-nums">${(player.salary / 1000).toFixed(1)}K</span>

                        <button
                          onClick={e => { e.stopPropagation(); toggleRosterPlayer(player.id); }}
                          disabled={!canAdd && !canRemove}
                          className={`py-1.5 rounded-lg text-[11px] font-bold tracking-wide border transition-all disabled:opacity-20 disabled:cursor-not-allowed ${
                            selected
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
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
            <div className="w-[300px] xl:w-[330px] shrink-0 flex flex-col bg-[#0c1626]">

              {/* Header + salary bar */}
              <div className="shrink-0 border-b border-[#1c2d48] px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#6b82a8]">My Lineup</span>
                  <span className="text-xs text-[#3d5878]">{selectedRoster.length}/{REQUIRED_GOLFERS} picks</span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className={COL_LABEL}>Salary Cap</span>
                    <span className={`font-bold tabular-nums ${salaryRemaining < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                      ${salaryUsed.toLocaleString()} / $50K
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#111d33] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        salaryRemaining < 0
                          ? 'bg-rose-500'
                          : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                      }`}
                      style={{ width: `${salaryPct}%` }}
                    />
                  </div>
                  <div className={`mt-1 text-right text-xs font-semibold ${salaryRemaining < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ${salaryRemaining.toLocaleString()} remaining
                  </div>
                </div>
              </div>

              {/* Roster slots */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {Array.from({ length: REQUIRED_GOLFERS }, (_, i) => {
                  const p: any = playersById[selectedRoster[i]];
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                        p ? 'border-emerald-500/20 bg-emerald-950/15' : 'border-[#1c2d48] bg-[#111d33]/50'
                      }`}
                    >
                      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                        p ? 'bg-emerald-500/25 text-emerald-400' : 'bg-[#1c2d48] text-[#3d5878]'
                      }`}>
                        {i + 1}
                      </div>

                      {p ? (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-[#f0f6ff] truncate">{p.name}</div>
                            <div className="text-[11px] text-[#3d5878] mt-0.5">
                              ${p.salary.toLocaleString()} · OWGR #{p.owgr}
                            </div>
                          </div>
                          <span className={`text-sm font-bold shrink-0 tabular-nums ${scoreColor(p.score)}`}>{p.score}</span>
                          {!locked && (
                            <button
                              onClick={() => toggleRosterPlayer(p.id)}
                              className="shrink-0 text-[#1c2d48] hover:text-rose-400 transition-colors ml-0.5"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-[#3d5878] italic">Empty slot</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Score strip + actions */}
              <div className="shrink-0 border-t border-[#1c2d48] p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { label: 'Raw', val: fmtScore(rosterRaw), color: scoreColor(rosterRaw) },
                    { label: 'Bonus', val: `+${rosterBonus}`, color: 'text-sky-400' },
                    { label: 'Net', val: fmtScore(rosterNet), color: scoreColor(rosterNet) },
                  ] as any[]).map(({ label, val, color }) => (
                    <div key={label} className="text-center rounded-xl bg-[#111d33] border border-[#1c2d48] py-2.5">
                      <div className={COL_LABEL + ' mb-1'}>{label}</div>
                      <div className={`text-base font-black tabular-nums ${color}`}>{val}</div>
                    </div>
                  ))}
                </div>

                {saveMessage && (
                  <div className="text-xs text-slate-400 bg-[#111d33] border border-[#1c2d48] rounded-lg px-3 py-2 text-center">
                    {saveMessage}
                  </div>
                )}

                <div className={COL_LABEL + ' text-center'}>
                  {isRosterLoading ? 'Loading…' : `Saved: ${lastSavedAt}`}
                </div>

                <button
                  onClick={handleSaveRoster}
                  disabled={isRosterSaving || isRosterLoading || locked}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-xl transition-all shadow-[0_4px_18px_rgba(16,185,129,0.22)] disabled:shadow-none flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isRosterSaving ? 'SAVING…' : 'SAVE LINEUP'}
                </button>
                <button
                  onClick={handleResetRoster}
                  disabled={isRosterSaving || isRosterLoading || locked}
                  className="w-full py-1.5 text-[#3d5878] hover:text-slate-300 disabled:opacity-40 text-xs font-semibold transition-colors"
                >
                  Reset to default picks
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STANDINGS ─── */}
        {activeTab === 'Standings' && (
          <div className="overflow-y-auto h-full">
            <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

              {/* Prize stat row */}
              <div className={`${PANEL} grid grid-cols-4 divide-x divide-[#1c2d48]`}>
                {([
                  { label: 'Prize Pool', value: `$${projectedPot.toLocaleString()}`, color: 'text-amber-400', icon: <Wallet className="h-4 w-4" /> },
                  { label: '1st Place',  value: `$${Math.round(projectedPot * settings.payouts.first / 100).toLocaleString()}`, color: 'text-amber-300', icon: <Medal className="h-4 w-4" /> },
                  { label: 'Entries',    value: standings.length, color: 'text-[#f0f6ff]', icon: <Users className="h-4 w-4" /> },
                  { label: 'Entry Fee',  value: `$${settings.entryFee}`, color: 'text-emerald-400', icon: <TrendingUp className="h-4 w-4" /> },
                ] as any[]).map(({ label, value, color, icon }) => (
                  <div key={label} className="bg-[#0c1626] px-5 py-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`${color} opacity-50`}>{icon}</span>
                      <div className={COL_LABEL}>{label}</div>
                    </div>
                    <div className={`text-2xl font-black ${color}`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Standings table */}
              <div className={PANEL}>
                <div className={`${PANEL_HEAD} flex items-center justify-between`}>
                  <div>
                    <h2 className="font-bold text-[#f0f6ff]">Live Standings</h2>
                    <p className="text-xs text-[#3d5878] mt-0.5 flex items-center gap-1.5">
                      <Clock3 className="h-3 w-3" /> Last sync {lastRefresh}
                      <span className="mx-1">·</span>
                      <Shield className="h-3 w-3" /> Unofficial source
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={syncStatus === 'Healthy' ? 'green' : syncStatus === 'Delayed' ? 'amber' : 'red'}>{syncStatus}</Badge>
                    <button
                      onClick={simulateRefresh}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#6b82a8] hover:text-[#f0f6ff] bg-[#111d33] border border-[#1c2d48] px-3 py-1.5 rounded-full transition-all hover:border-[#2a4063]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-[64px,1fr,110px,80px,80px,88px] gap-3 px-5 py-2.5 bg-[#070d1a] border-b border-[#1c2d48]">
                  {['Place', 'Entry', 'Salary', 'Raw', 'Bonus', 'Net'].map(h => (
                    <span key={h} className={COL_LABEL}>{h}</span>
                  ))}
                </div>

                {standings.map((entry: any) => (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-[64px,1fr,110px,80px,80px,88px] gap-3 items-center px-5 py-4 border-b border-[#1c2d48]/50 last:border-0 transition-all ${
                      entry.name === entryName
                        ? 'bg-emerald-950/20 shadow-[inset_3px_0_0_rgba(16,185,129,0.45)]'
                        : 'hover:bg-[#0f1e35]/40'
                    }`}
                  >
                    <div className="text-base font-black">
                      {entry.place === 1 ? '🥇' : entry.place === 2 ? '🥈' : entry.place === 3 ? '🥉' : (
                        <span className="text-[#3d5878] text-sm">#{entry.place}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#f0f6ff]">{entry.name}</span>
                        {entry.name === entryName && <Badge tone="green">You</Badge>}
                      </div>
                      <div className="text-xs text-[#3d5878] mt-0.5">{entry.golfers.length} golfers</div>
                    </div>
                    <span className="text-sm text-slate-300 tabular-nums">${entry.salary.toLocaleString()}</span>
                    <span className={`text-sm font-bold tabular-nums ${scoreColor(entry.rawScore)}`}>{fmtScore(entry.rawScore)}</span>
                    <span className="text-sm font-bold text-sky-400 tabular-nums">{entry.bonus}</span>
                    <span className={`text-base font-black tabular-nums ${scoreColor(entry.net)}`}>{fmtScore(entry.net)}</span>
                  </div>
                ))}
              </div>

              {/* Bottom row */}
              <div className="grid gap-5 lg:grid-cols-2">
                {/* Player tracker */}
                <div className={PANEL}>
                  <div className={PANEL_HEAD}>
                    <h3 className="font-bold text-[#f0f6ff] text-sm">Featured Players</h3>
                    <p className="text-xs text-[#3d5878] mt-0.5">Top of the leaderboard</p>
                  </div>
                  <div className="grid grid-cols-[28px,1fr,56px,60px] gap-3 px-5 py-2.5 bg-[#070d1a] border-b border-[#1c2d48]">
                    {['#', 'Player', 'Score', 'Bonus'].map(h => <span key={h} className={COL_LABEL}>{h}</span>)}
                  </div>
                  {tournamentPlayers.slice(0, 6).map((player: any, idx: number) => (
                    <div key={player.id} className="grid grid-cols-[28px,1fr,56px,60px] gap-3 items-center px-5 py-3 border-b border-[#1c2d48]/50 last:border-0 hover:bg-[#0f1e35]/40 transition-all">
                      <span className="text-xs text-[#3d5878] font-bold">{idx + 1}</span>
                      <div>
                        <div className="text-sm font-semibold text-[#f0f6ff]">{player.name}</div>
                        <div className="text-[11px] text-[#3d5878]">Thru {player.thru} · {player.odds}</div>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${scoreColor(player.score)}`}>{player.score}</span>
                      <span className="text-xs font-semibold text-sky-400 tabular-nums">+{calculatePlayerBonus(player)}</span>
                    </div>
                  ))}
                </div>

                {/* Payout */}
                <div className={PANEL}>
                  <div className={PANEL_HEAD}>
                    <h3 className="font-bold text-[#f0f6ff] text-sm">Payout Structure</h3>
                    <p className="text-xs text-[#3d5878] mt-0.5">Send to {settings.venmo}</p>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {([
                      { icon: '🥇', label: '1st Place', pct: settings.payouts.first, gold: true },
                      { icon: '🥈', label: '2nd Place', pct: settings.payouts.second, gold: false },
                      { icon: '🥉', label: '3rd Place', pct: settings.payouts.third,  gold: false },
                    ] as any[]).map(({ icon, label, pct, gold }) => (
                      <div key={label} className={`flex items-center justify-between rounded-xl border px-4 py-3.5 ${
                        gold ? 'bg-amber-950/25 border-amber-500/20' : 'bg-[#111d33] border-[#1c2d48]'
                      }`}>
                        <span className="flex items-center gap-2 text-sm font-semibold text-[#f0f6ff]">{icon} {label}</span>
                        <div className="text-right">
                          <div className={`text-xl font-black tabular-nums ${gold ? 'text-amber-400' : 'text-[#f0f6ff]'}`}>
                            ${Math.round(projectedPot * pct / 100).toLocaleString()}
                          </div>
                          <div className="text-xs text-[#3d5878]">{pct}% of pot</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── RULES AND SCORING ─── */}
        {activeTab === 'Rules and Scoring' && (
          <div className="overflow-y-auto h-full">
            <div className="max-w-5xl mx-auto px-6 py-6 grid gap-6 lg:grid-cols-2">

              <div className={PANEL}>
                <div className={PANEL_HEAD}>
                  <h2 className="font-bold text-[#f0f6ff]">Pool Rules</h2>
                  <p className="text-xs text-[#3d5878] mt-0.5">How to play</p>
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
                    <div key={title} className="rounded-xl bg-[#111d33] border border-[#1c2d48] p-4">
                      <div className="text-sm font-bold text-[#f0f6ff] mb-3">{title}</div>
                      <ul className="space-y-2">
                        {items.map((item: string) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm text-[#6b82a8]">
                            <span className="text-emerald-500 shrink-0 mt-0.5">›</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className={PANEL}>
                <div className={PANEL_HEAD}>
                  <h2 className="font-bold text-[#f0f6ff]">Bonus Scoring</h2>
                  <p className="text-xs text-[#3d5878] mt-0.5">Subtracted from raw score</p>
                </div>
                <div className="grid grid-cols-[1fr,72px] gap-3 px-5 py-2.5 bg-[#070d1a] border-b border-[#1c2d48]">
                  <span className={COL_LABEL}>Category</span>
                  <span className={COL_LABEL + ' text-right'}>Pts</span>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 500 }}>
                  {BONUS_ROWS.map(([label, points]) => (
                    <div key={label} className="grid grid-cols-[1fr,72px] gap-3 items-center px-5 py-2.5 border-b border-[#1c2d48]/50 last:border-0 hover:bg-[#0f1e35]/40 transition-all">
                      <span className="text-sm text-[#a0b4cc]">{label}</span>
                      <span className={`text-sm font-bold text-right tabular-nums ${Number(points) > 0 ? 'text-emerald-400' : Number(points) < 0 ? 'text-rose-400' : 'text-[#6b82a8]'}`}>
                        {Number(points) > 0 ? `+${points}` : points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── ADMIN ─── */}
        {activeTab === 'Admin' && (
          <div className="overflow-y-auto h-full">
            <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">

              <div className={PANEL}>
                <div className={`${PANEL_HEAD} flex items-center justify-between`}>
                  <div>
                    <h2 className="font-bold text-[#f0f6ff]">Admin Controls</h2>
                    <p className="text-xs text-[#3d5878] mt-0.5">Simulates tools for running the pool</p>
                  </div>
                  <Badge tone="amber">Owner Only</Badge>
                </div>

                <div className="p-5 grid gap-4 sm:grid-cols-2">
                  {([
                    { label: 'Entry Name', input: <input value={entryName} onChange={e => setEntryName(e.target.value)} className="w-full rounded-xl border border-[#1c2d48] bg-[#111d33] px-3 py-2.5 text-[#f0f6ff] text-sm outline-none focus:border-emerald-500/50 transition-colors placeholder:text-[#3d5878]" /> },
                    { label: 'Venmo Handle', input: <input value={settings.venmo} onChange={e => setSettings({ ...settings, venmo: e.target.value })} className="w-full rounded-xl border border-[#1c2d48] bg-[#111d33] px-3 py-2.5 text-[#f0f6ff] text-sm outline-none focus:border-emerald-500/50 transition-colors" /> },
                    { label: 'Entry Fee ($)', input: <input type="number" value={settings.entryFee} onChange={e => setSettings({ ...settings, entryFee: Number(e.target.value) })} className="w-full rounded-xl border border-[#1c2d48] bg-[#111d33] px-3 py-2.5 text-[#f0f6ff] text-sm outline-none focus:border-emerald-500/50 transition-colors" /> },
                    {
                      label: 'Lineup Lock',
                      input: (
                        <button
                          onClick={() => setSettings({ ...settings, manualLock: !settings.manualLock })}
                          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border ${
                            locked
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                        >
                          {locked ? <><Lock className="h-4 w-4" /> LOCKED — Click to Open</> : <><Unlock className="h-4 w-4" /> OPEN — Click to Lock</>}
                        </button>
                      ),
                    },
                  ] as any[]).map(({ label, input }) => (
                    <label key={label} className="block rounded-xl bg-[#0c1626] border border-[#1c2d48] p-4">
                      <div className={COL_LABEL + ' mb-2'}>{label}</div>
                      {input}
                    </label>
                  ))}
                </div>

                <div className="px-5 pb-5">
                  <div className={COL_LABEL + ' mb-3'}>Payout Splits (%)</div>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { label: '1st Place', key: 'first' as const },
                      { label: '2nd Place', key: 'second' as const },
                      { label: '3rd Place', key: 'third' as const },
                    ] as const).map(({ label, key }) => (
                      <label key={key} className="block rounded-xl bg-[#0c1626] border border-[#1c2d48] p-3">
                        <div className="text-xs text-[#3d5878] mb-2">{label}</div>
                        <input
                          type="number"
                          value={settings.payouts[key]}
                          onChange={e => setSettings({ ...settings, payouts: { ...settings.payouts, [key]: Number(e.target.value) } })}
                          className="w-full rounded-lg border border-[#1c2d48] bg-[#111d33] px-2.5 py-2 text-[#f0f6ff] text-sm outline-none focus:border-emerald-500/50 transition-colors"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Badge tone={payoutTotal === 100 ? 'green' : 'amber'}>
                      <CheckCircle2 className="h-3 w-3" /> Total: {payoutTotal}%
                    </Badge>
                    <span className={`text-xs ${isSettingsSaving ? 'text-[#3d5878] animate-pulse' : 'text-[#1c2d48]'}`}>
                      {isSettingsSaving ? 'Saving…' : 'Auto-saved'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={PANEL}>
                <div className={PANEL_HEAD}>
                  <h2 className="font-bold text-[#f0f6ff]">Semi-live Feed Workflow</h2>
                  <p className="text-xs text-[#3d5878] mt-0.5">Operating model using unofficial leaderboard data</p>
                </div>
                <div className="p-5 space-y-3">
                  {([
                    { icon: <RefreshCw className="h-4 w-4 text-sky-400" />,     title: 'Refresh leaderboard every 2–5 minutes', desc: 'Normalize player score, thru, status, and last update time into your database.' },
                    { icon: <TrendingUp className="h-4 w-4 text-emerald-400" />, title: 'Recompute entry scores after each sync', desc: 'Raw team score and bonus points are recalculated from stored golfer states.' },
                    { icon: <AlertCircle className="h-4 w-4 text-amber-400" />,  title: 'Flag source issues for manual review', desc: 'If the feed is delayed or parsing fails, the site shows last good data and a warning.' },
                    { icon: <Flag className="h-4 w-4 text-[#3d5878]" />,          title: 'Lock at first tee time', desc: 'No roster edits after official start — enforced server-side in production.' },
                  ] as any[]).map(({ icon, title, desc }) => (
                    <div key={title} className="flex items-start gap-4 rounded-xl border border-[#1c2d48] bg-[#0c1626] p-4">
                      <div className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-[#111d33]">{icon}</div>
                      <div>
                        <div className="text-sm font-semibold text-[#f0f6ff]">{title}</div>
                        <div className="mt-1 text-xs text-[#3d5878]">{desc}</div>
                      </div>
                    </div>
                  ))}
                  <button onClick={simulateRefresh} className="flex items-center gap-2 rounded-xl bg-[#111d33] border border-[#1c2d48] px-4 py-3 text-sm font-semibold text-[#6b82a8] hover:text-[#f0f6ff] hover:bg-[#162035] transition-all hover:border-[#2a4063]">
                    <Settings2 className="h-4 w-4" /> Run simulated sync
                  </button>
                </div>
              </div>

              <div className={PANEL}>
                <div className={PANEL_HEAD}>
                  <h2 className="font-bold text-[#f0f6ff]">Backend Contract</h2>
                  <p className="text-xs text-[#3d5878] mt-0.5">Replace mock methods with real API calls to go live</p>
                </div>
                <div className="p-5">
                  <pre className="text-xs text-[#6b82a8] bg-black/40 border border-[#1c2d48] rounded-xl p-4 overflow-x-auto leading-relaxed font-mono">{`mockPoolService methods:
  loadSettings()
  saveSettings(settings)
  loadRoster(entryName, tournamentId)
  saveRoster({ entryName, tournamentId, playerIds })

next real implementation:
  → replace localStorage reads/writes with fetch() / Supabase
  → keep all UI state and validation unchanged
  → keep loading/saving indicators as-is`}</pre>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* ══ Footer ══ */}
      <footer className="shrink-0 border-t border-[#1c2d48] bg-[#0c1626] px-5 py-2.5 flex items-center justify-between text-xs text-[#2a4063]">
        <span>MVP prototype · connect auth, DB, and live data feeds to go live</span>
        <span className="flex items-center gap-1 hover:text-[#6b82a8] transition-colors cursor-pointer">
          Next: connect real APIs <ChevronRight className="h-3 w-3" />
        </span>
      </footer>
    </div>
  );
}
