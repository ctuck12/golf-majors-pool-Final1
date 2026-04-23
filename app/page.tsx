'use client';
//hi
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

const MAIN_TABS = ['Standings', 'My entries', 'Details', 'Commissioner console'] as const;
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
  const tournamentTabs = TOURNAMENTS.map(t => ({ ...t, isPast: new Date(t.lockAt) < today }));

  const hasTournamentData = selectedTournament === 'players';

  const tdClass = (t: typeof tournamentTabs[0]) => {
    if (t.id === selectedTournament) return 'active-tab';
    if (t.isPast) return 'past-tab';
    return 'future-tab';
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#e8edf3' }}>

      {/* ══ Header ══ */}
      <header
        className="shrink-0"
        style={{
          background: '#1d1940',
          color: '#fff',
          boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
        }}
      >
        {/* Top strip */}
        <div className="flex items-center gap-5 px-8 py-2">
          <div className="flex-1 min-w-0">
            <img
              src="/logo-banner.png"
              alt="Golf Majors Pool"
              style={{
                height: 130,
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
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
                    background: isActive ? 'rgba(0,212,238,0.13)' : 'rgba(255,255,255,0.05)',
                    border: 'none',
                    outline: 'none',
                    borderBottom: isActive ? '2px solid #00d4ee' : '2px solid transparent',
                    borderRadius: '4px 4px 0 0',
                    color: isActive ? '#00d4ee' : '#9ab4cc',
                    cursor: 'pointer',
                    padding: '12px 16px',
                    fontSize: 13.5,
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: isActive ? '0.01em' : 0,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)';
                      (e.currentTarget as HTMLElement).style.color = '#c8ddf0';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                      (e.currentTarget as HTMLElement).style.color = '#9ab4cc';
                    }
                  }}
                >
                  {tab}
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
                    const isActive = tdClass(t) === 'active-tab';

                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTournament(t.id)}
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
                          color: '#0369a1',
                          fontWeight: 500,
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
                    {/* Prize row — dark navy like My entries contest bar */}
                    <div
                      style={{
                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                        background: 'linear-gradient(135deg, #0c1628 0%, #162040 100%)',
                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
                      }}
                    >
                      {([
                        { label: 'Prize Pool', value: `$${projectedPot.toLocaleString()}`, color: '#fbbf24' },
                        { label: '1st Place',  value: `$${Math.round(projectedPot * settings.payouts.first / 100).toLocaleString()}`, color: '#fbbf24' },
                        { label: 'Entries',    value: standings.length, color: '#e2eaf4' },
                        { label: 'Entry Fee',  value: `$${settings.entryFee}`, color: '#4ade80' },
                      ] as any[]).map(({ label, value, color }) => (
                        <div key={label} style={{ padding: '16px 24px', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.38)', marginBottom: 6 }}>{label}</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Table header */}
                    <div
                      style={{
                        display: 'grid', gridTemplateColumns: '56px 1fr 100px 72px 72px 80px',
                        padding: '10px 24px', gap: 0,
                        background: 'linear-gradient(to right, #edf1f7, #e4e9f2)',
                        borderBottom: '1px solid #cdd4e0',
                      }}
                    >
                      {[['Place', 'left'], ['Entry', 'left'], ['Salary', 'left'], ['Raw', 'left'], ['Bonus', 'left'], ['Net', 'left']].map(([h, align]) => (
                        <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a8fa8', textAlign: align as any }}>{h}</span>
                      ))}
                    </div>

                    {/* Entry rows */}
                    {standings.map((entry: any) => {
                      const isMe = entry.name === entryName;
                      return (
                        <div
                          key={entry.id}
                          style={{
                            display: 'grid', gridTemplateColumns: '56px 1fr 100px 72px 72px 80px',
                            alignItems: 'center', padding: '14px 24px', gap: 0,
                            borderBottom: '1px solid #dde3ec',
                            background: isMe
                              ? 'linear-gradient(to right, #e8faf4, #f0fdf9)'
                              : 'white',
                            boxShadow: isMe ? 'inset 4px 0 0 #00bcd4' : undefined,
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { if (!isMe) (e.currentTarget as HTMLElement).style.background = '#f5f8fc'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isMe ? 'linear-gradient(to right, #e8faf4, #f0fdf9)' : 'white'; }}
                        >
                          {/* Place */}
                          <div style={{ fontSize: 18 }}>
                            {entry.place === 1 ? '🥇' : entry.place === 2 ? '🥈' : entry.place === 3 ? '🥉' : (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #e2e8f0, #d0d8e4)',
                                fontSize: 11, fontWeight: 800, color: '#64748b',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                              }}>#{entry.place}</span>
                            )}
                          </div>

                          {/* Entry name */}
                          <div style={{ paddingRight: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{entry.name}</span>
                              {isMe && (
                                <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 999, background: 'linear-gradient(135deg, #00bcd4, #0097a7)', color: '#fff', boxShadow: '0 1px 4px rgba(0,188,212,0.3)' }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{entry.golfers.length} golfers</div>
                          </div>

                          {/* Salary */}
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>${entry.salary.toLocaleString()}</span>

                          {/* Raw */}
                          <span className={`tabular-nums ${scoreColor(entry.rawScore)}`} style={{ fontSize: 13, fontWeight: 700 }}>{fmtScore(entry.rawScore)}</span>

                          {/* Bonus */}
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>{entry.bonus}</span>

                          {/* Net */}
                          <span className={`tabular-nums ${scoreColor(entry.net)}`} style={{ fontSize: 15, fontWeight: 900 }}>{fmtScore(entry.net)}</span>
                        </div>
                      );
                    })}

                    {/* Sync footer */}
                    <div
                      className="flex items-center justify-between px-6 py-3"
                      style={{ background: 'linear-gradient(to right, #edf1f7, #e4e9f2)', borderTop: '1px solid #cdd4e0' }}
                    >
                      <div className="flex items-center gap-3" style={{ fontSize: 11, color: '#7a8fa8' }}>
                        <Clock3 className="h-3.5 w-3.5" />
                        <span>Last sync {lastRefresh}</span>
                        <span>·</span>
                        <Shield className="h-3.5 w-3.5" />
                        <span>Unofficial source</span>
                        <span
                          style={{
                            padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                            background: syncStatus === 'Healthy' ? 'linear-gradient(135deg,#d1fae5,#a7f3d0)' : syncStatus === 'Delayed' ? '#fef3c7' : '#fee2e2',
                            color: syncStatus === 'Healthy' ? '#065f46' : syncStatus === 'Delayed' ? '#92400e' : '#991b1b',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          }}
                        >
                          {syncStatus}
                        </span>
                      </div>
                      <button
                        onClick={simulateRefresh}
                        className="flex items-center gap-1.5 transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#7a8fa8' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0f172a'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#7a8fa8'; }}
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
            <div className="flex flex-col flex-1 overflow-hidden" style={{ background: '#f4f6fa', borderRight: '1px solid #d8dfe8' }}>

              {/* Contest bar */}
              <div
                className="shrink-0 flex border-b shrink-0"
                style={{ background: 'linear-gradient(135deg, #0c1628 0%, #162040 100%)', borderColor: 'rgba(255,255,255,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.18)' }}
              >
                {([
                  { label: 'Tournament', value: 'The Players Championship', color: '#e2eaf4' },
                  { label: 'Venue', value: 'TPC Sawgrass', color: '#9ab8d8' },
                  { label: 'Entry Fee', value: `$${settings.entryFee}`, color: '#4ade80' },
                  { label: 'Prize Pool', value: `$${projectedPot.toLocaleString()}`, color: '#fbbf24' },
                ] as any[]).map(({ label, value, color }) => (
                  <div key={label} className="flex-1 px-6 py-4" style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
                    <div className="truncate" style={{ color, fontWeight: 700, fontSize: 14 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Column headers */}
              <div
                className="shrink-0 border-b"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr 56px 64px 76px 96px',
                  gap: 0,
                  alignItems: 'center',
                  padding: '10px 24px',
                  background: 'linear-gradient(to right, #edf1f7, #e4e9f2)',
                  borderColor: '#cdd4e0',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a8fa8', textAlign: 'center' }}>RK</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a8fa8' }}>Player</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a8fa8', textAlign: 'center' }}>Thru</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a8fa8', textAlign: 'center' }}>Score</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a8fa8' }}>Salary</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a8fa8', textAlign: 'center' }}>Action</span>
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
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '44px 1fr 56px 64px 76px 96px',
                          gap: 0,
                          alignItems: 'center',
                          padding: '13px 24px',
                          borderBottom: '1px solid #dde3ec',
                          background: selected
                            ? 'linear-gradient(to right, #e8faf4, #f0fdf9)'
                            : 'white',
                          cursor: canAdd || canRemove ? 'pointer' : 'not-allowed',
                          opacity: (!canAdd && !selected) ? 0.45 : 1,
                          boxShadow: selected ? 'inset 4px 0 0 #00bcd4' : undefined,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { if (canAdd && !selected) (e.currentTarget as HTMLElement).style.background = '#f5f8fc'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selected ? 'linear-gradient(to right, #e8faf4, #f0fdf9)' : 'white'; }}
                      >
                        {/* Rank */}
                        <div style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 26, height: 26, borderRadius: '50%',
                              background: selected ? 'linear-gradient(135deg, #00bcd4, #0097a7)' : 'linear-gradient(135deg, #e8ecf2, #d8dfe8)',
                              color: selected ? '#fff' : '#7a8fa8',
                              fontSize: 11, fontWeight: 800,
                              boxShadow: selected ? '0 2px 6px rgba(0,188,212,0.35)' : '0 1px 3px rgba(0,0,0,0.08)',
                            }}
                          >{player.owgr}</span>
                        </div>

                        {/* Player info */}
                        <div className="min-w-0 flex items-center gap-2.5" style={{ paddingRight: 8 }}>
                          <div
                            style={{
                              flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 900,
                              background: selected
                                ? 'linear-gradient(135deg, #00c9a7, #00a896)'
                                : 'linear-gradient(135deg, #c8d4e4, #b8c8dc)',
                              color: selected ? '#fff' : '#4a6080',
                              boxShadow: selected ? '0 2px 8px rgba(0,188,212,0.30)' : '0 1px 4px rgba(0,0,0,0.10)',
                            }}
                          >
                            {player.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{player.name}</span>
                              {selected && (
                                <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 999, background: 'linear-gradient(135deg, #00bcd4, #0097a7)', color: '#fff', boxShadow: '0 1px 4px rgba(0,188,212,0.3)' }}>
                                  In Lineup
                                </span>
                              )}
                              {wouldExceedCap && (
                                <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 999, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                                  Over Cap
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{player.odds} outright</div>
                          </div>
                        </div>

                        {/* Thru */}
                        <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>{player.thru}</div>

                        {/* Score */}
                        <div style={{ textAlign: 'center' }}>
                          <span
                            className={`tabular-nums ${scoreColor(player.score)}`}
                            style={{ fontSize: 14, fontWeight: 800 }}
                          >{player.score}</span>
                        </div>

                        {/* Salary */}
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>${(player.salary / 1000).toFixed(1)}K</div>

                        {/* Action button */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            onClick={e => { e.stopPropagation(); toggleRosterPlayer(player.id); }}
                            disabled={!canAdd && !canRemove}
                            style={{
                              width: 76, padding: '7px 0',
                              borderRadius: 8,
                              fontSize: 10, fontWeight: 800, letterSpacing: '0.07em',
                              cursor: canAdd || canRemove ? 'pointer' : 'not-allowed',
                              transition: 'all 0.15s',
                              opacity: (!canAdd && !canRemove) ? 0.2 : 1,
                              ...(selected
                                ? {
                                  background: 'linear-gradient(to bottom, #f87171, #dc2626)',
                                  color: '#fff', border: '1px solid #b91c1c',
                                  boxShadow: '0 2px 8px rgba(220,38,38,0.30), inset 0 1px 0 rgba(255,255,255,0.15)',
                                }
                                : {
                                  background: 'linear-gradient(to bottom, #34d399, #059669)',
                                  color: '#fff', border: '1px solid #047857',
                                  boxShadow: '0 2px 8px rgba(5,150,105,0.28), inset 0 1px 0 rgba(255,255,255,0.15)',
                                }),
                            }}
                          >
                            {selected ? 'REMOVE' : '+ ADD'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Lineup builder */}
            <div className="w-[300px] xl:w-[330px] shrink-0 flex flex-col bg-white" style={{ boxShadow: '-4px 0 28px rgba(0, 0, 0, 0.12)' }}>

              {/* Header + salary bar */}
              <div
                className="shrink-0 border-b px-6 pt-5 pb-4"
                style={{ background: 'linear-gradient(135deg, #0c1628 0%, #162040 100%)', borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#7ab8e0' }}>My Lineup</span>
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'rgba(0,188,212,0.18)', border: '1px solid rgba(0,188,212,0.3)', borderRadius: 20, padding: '2px 10px' }}
                  >{selectedRoster.length}/{REQUIRED_GOLFERS} picks</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)' }}>Salary Cap</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: salaryRemaining < 0 ? '#f87171' : '#fff' }}>
                      ${salaryUsed.toLocaleString()} / $50K
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.10)' }}>
                    <div
                      style={{ height: '100%', borderRadius: 99, transition: 'width 0.5s', width: `${salaryPct}%`, background: salaryRemaining < 0 ? 'linear-gradient(to right, #f87171, #dc2626)' : 'linear-gradient(to right, #00e5ff, #00b8d9)' }}
                    />
                  </div>
                  <div style={{ marginTop: 5, textAlign: 'right', fontSize: 11, fontWeight: 700, color: salaryRemaining < 0 ? '#f87171' : '#4ade80' }}>
                    ${salaryRemaining.toLocaleString()} remaining
                  </div>
                </div>
              </div>

              {/* Slots */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: '#f4f6fa' }}>
                {Array.from({ length: REQUIRED_GOLFERS }, (_, i) => {
                  const p: any = playersById[selectedRoster[i]];
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl p-3.5 transition-all"
                      style={p
                        ? { background: 'white', border: '1px solid #c8eee4', boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 3px 0 0 #00bcd4' }
                        : { background: 'white', border: '1px solid #dde3ec', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
                      }
                    >
                      <div
                        style={{
                          flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 900,
                          background: p ? 'linear-gradient(135deg, #00bcd4, #0097a7)' : 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
                          color: p ? '#fff' : '#94a3b8',
                          boxShadow: p ? '0 2px 6px rgba(0,188,212,0.30)' : 'none',
                        }}
                      >
                        {i + 1}
                      </div>
                      {p ? (
                        <>
                          <div className="flex-1 min-w-0">
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }} className="truncate">{p.name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>${p.salary.toLocaleString()} · OWGR #{p.owgr}</div>
                          </div>
                          <span className={`tabular-nums ${scoreColor(p.score)}`} style={{ fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{p.score}</span>
                          {!locked && (
                            <button
                              onClick={() => toggleRosterPlayer(p.id)}
                              style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 2, borderRadius: 4 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#cbd5e1'; }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Empty slot</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Score + actions */}
              <div className="shrink-0 p-4 space-y-3" style={{ background: 'linear-gradient(to bottom, #0f1e34, #162840)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {([
                    { label: 'Raw', val: fmtScore(rosterRaw), color: scoreColor(rosterRaw) },
                    { label: 'Bonus', val: `+${rosterBonus}`, color: 'text-blue-400' },
                    { label: 'Net', val: fmtScore(rosterNet), color: scoreColor(rosterNet) },
                  ] as any[]).map(({ label, val, color }) => (
                    <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '10px 4px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{label}</div>
                      <div className={`tabular-nums ${color}`} style={{ fontSize: 16, fontWeight: 900 }}>{val}</div>
                    </div>
                  ))}
                </div>

                {saveMessage && (
                  <div style={{ fontSize: 11, color: '#7ab8e0', background: 'rgba(0,188,212,0.10)', border: '1px solid rgba(0,188,212,0.20)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                    {saveMessage}
                  </div>
                )}

                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.28)', textAlign: 'center' }}>
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
                  style={{ width: '100%', padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.02em' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}
                >
                  Reset to default picks
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── DETAILS ─── */}
        {mainTab === 'Details' && (
          <div className="overflow-y-auto h-full">
            <div className="max-w-3xl mx-auto px-10 py-8 space-y-8">

              {/* Rules card */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
                <div className="px-7 py-6" style={{ fontFamily: 'inherit', color: '#1a1a1a' }}>

                  {/* Roster & Entry Details */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <span style={{ fontSize: 18 }}>🏌️</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>Roster &amp; Entry Details</span>
                    </div>
                    {[
                      <>For each major tournament, and The Players Championship, members select <strong>six golfers</strong>. Each golfer will have a salary assigned to them based on a blend of their world ranking and odds to win the tournament.</>,
                      <>Participants will be assigned a fixed salary cap of <strong>$50,000</strong> they must stay under in order to create their 6-player roster. These six golfers make up their Player Roster for that tournament.</>,
                      <>Golfers <strong>CAN be picked more than once per season</strong>. Points are awarded based on the players hole by hole performance, as well as their tournament standings. Cut players receive <strong>-10 points</strong>.</>,
                      <><strong>1st, 2nd and 3rd places pay out</strong>, and amounts vary based on the size of the pool field.</>,
                    ].map((text, i, arr) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < arr.length - 1 ? 14 : 0 }}>
                        <span style={{ color: '#4ade80', fontSize: 22, fontWeight: 900, lineHeight: 1.3, flexShrink: 0 }}>›</span>
                        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#1a1a1a', margin: 0 }}>{text}</p>
                      </div>
                    ))}
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', marginBottom: 20 }} />

                  <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#1a1a1a', marginBottom: 20 }}>
                    The scores of all <strong>6 golfers</strong> on your roster count towards your score.
                  </p>

                  <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', marginBottom: 20 }} />

                  {/* Entry & Contact */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 18 }}>💰</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>Entry &amp; Contact</span>
                    </div>
                    {[
                      <><strong>Entry Fee:</strong> $25</>,
                      <><strong>Venmo:</strong> @claytont743</>,
                      <><strong>Questions:</strong> Clayton Tucker (325.665.8299)</>,
                    ].map((line, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: '#4ade80', fontSize: 22, fontWeight: 900, lineHeight: 1.5, flexShrink: 0 }}>›</span>
                        <p style={{ fontSize: 14.5, lineHeight: 1.5, color: '#1a1a1a', margin: 0 }}>{line}</p>
                      </div>
                    ))}
                  </div>

                </div>
              </div>

              {/* Points card */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h2 className="font-bold text-gray-900 text-base">📊 Points are awarded as follows:</h2>
                </div>
                <div className="px-7 py-6">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>

                    {/* ── Left column ── */}
                    <div>
                      {/* Negatives */}
                      {[['Triple+', '-5 pts'], ['Double', '-3 pts'], ['Bogey', '-1 pts']].map(([lbl, pts]) => (
                        <div key={lbl} style={{ display: 'flex', gap: 6, padding: '5px 0', fontSize: 15.5 }}>
                          <span style={{ fontWeight: 800, color: '#111' }}>{lbl}:</span>
                          <span style={{ fontWeight: 700, color: '#8b1a1a' }}>{pts}</span>
                        </div>
                      ))}
                      <hr style={{ border: 'none', borderTop: '1px solid #ccc', margin: '3px 0' }} />
                      {/* Par */}
                      <div style={{ display: 'flex', gap: 6, padding: '5px 0', fontSize: 15.5 }}>
                        <span style={{ fontWeight: 800, color: '#111' }}>Par:</span>
                        <span style={{ fontWeight: 700, color: '#2d6b2d' }}>.5 pts</span>
                      </div>
                      {/* Birdie–Ace */}
                      {[['Birdie', '3 pts'], ['Eagle', '8 pts'], ['Albatross', '13 pts'], ['Ace', '10 pts']].map(([lbl, pts]) => (
                        <div key={lbl} style={{ display: 'flex', gap: 6, padding: '5px 0', fontSize: 15.5 }}>
                          <span style={{ fontWeight: 800, color: '#111' }}>{lbl}:</span>
                          <span style={{ fontWeight: 700, color: '#2d6b2d' }}>{pts}</span>
                        </div>
                      ))}
                      <hr style={{ border: 'none', borderTop: '1px solid #ccc', margin: '3px 0' }} />
                      {/* Streak / Round bonuses */}
                      {[['3 Birdie Streak', '4 pts'], ['Bogey Free Rnd', '6 pts'], ['Tourney Low Rnd', '5 pts']].map(([lbl, pts]) => (
                        <div key={lbl} style={{ display: 'flex', gap: 6, padding: '5px 0', fontSize: 15.5 }}>
                          <span style={{ fontWeight: 800, color: '#111' }}>{lbl}:</span>
                          <span style={{ fontWeight: 700, color: '#2d6b2d' }}>{pts}</span>
                        </div>
                      ))}
                      <hr style={{ border: 'none', borderTop: '1px solid #ccc', margin: '3px 0' }} />
                      {/* Round leaders */}
                      {([
                        [<>1<sup style={{ fontSize: '0.6em' }}>st</sup> Rnd Leader</>, '5 pts'],
                        [<>2<sup style={{ fontSize: '0.6em' }}>nd</sup> Rnd Leader</>, '5 pts'],
                        [<>3<sup style={{ fontSize: '0.6em' }}>rd</sup> Rnd Leader</>, '5 pts'],
                      ] as [React.ReactNode, string][]).map(([lbl, pts], i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, padding: '5px 0', fontSize: 15.5 }}>
                          <span style={{ fontWeight: 800, color: '#111' }}>{lbl}:</span>
                          <span style={{ fontWeight: 700, color: '#2d6b2d' }}>{pts}</span>
                        </div>
                      ))}
                    </div>

                    {/* ── Right column ── */}
                    <div>
                      {/* 1st–3rd */}
                      {[['1st Place', '40 pts'], ['2nd Place', '25 pts'], ['3rd Place', '20 pts']].map(([lbl, pts]) => (
                        <div key={lbl} style={{ display: 'flex', gap: 6, padding: '5px 0', fontSize: 15.5 }}>
                          <span style={{ fontWeight: 800, color: '#111' }}>{lbl}:</span>
                          <span style={{ fontWeight: 700, color: '#2d6b2d' }}>{pts}</span>
                        </div>
                      ))}
                      <hr style={{ border: 'none', borderTop: '1px solid #ccc', margin: '3px 0' }} />
                      {/* 4th–10th */}
                      {[['4th Place', '18 pts'], ['5th Place', '16 pts'], ['6th Place', '14 pts'], ['7th Place', '12 pts'], ['8th Place', '10 pts'], ['9th Place', '9 pts'], ['10th Place', '8 pts']].map(([lbl, pts]) => (
                        <div key={lbl} style={{ display: 'flex', gap: 6, padding: '5px 0', fontSize: 15.5 }}>
                          <span style={{ fontWeight: 800, color: '#111' }}>{lbl}:</span>
                          <span style={{ fontWeight: 700, color: '#2d6b2d' }}>{pts}</span>
                        </div>
                      ))}
                      <hr style={{ border: 'none', borderTop: '1px solid #ccc', margin: '3px 0' }} />
                      {/* 11th–40th */}
                      {[['11-15th Place', '7 pts'], ['16-20th Place', '6 pts'], ['21-25th Place', '5 pts'], ['26-30th Place', '3 pts'], ['31-40th Place', '1 pts']].map(([lbl, pts]) => (
                        <div key={lbl} style={{ display: 'flex', gap: 6, padding: '5px 0', fontSize: 15.5 }}>
                          <span style={{ fontWeight: 800, color: '#111' }}>{lbl}:</span>
                          <span style={{ fontWeight: 700, color: '#2d6b2d' }}>{pts}</span>
                        </div>
                      ))}
                      {/* Cut Players */}
                      <div style={{ display: 'flex', gap: 6, padding: '5px 0', fontSize: 15.5 }}>
                        <span style={{ fontWeight: 800, color: '#8b1a1a' }}>Cut Players:</span>
                        <span style={{ fontWeight: 700, color: '#8b1a1a' }}>-10 pts</span>
                      </div>
                    </div>

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
