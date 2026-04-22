'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  RefreshCw,
  Clock3,
  Shield,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Medal,
  Users,
  Flag,
  Settings2,
  Save,
  Lock,
  Unlock,
  CheckCircle2,
} from 'lucide-react';

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
  tournaments: {
    id: 'string',
    name: 'string',
    venue: 'string',
    lockAt: 'datetime',
    status: 'scheduled | live | final',
  },
  players: {
    id: 'number',
    name: 'string',
    owgr: 'number',
  },
  tournamentSalaries: {
    tournamentId: 'string',
    playerId: 'number',
    salary: 'number',
    odds: 'string',
    salaryRank: 'number',
  },
  entries: {
    id: 'number',
    userId: 'string',
    entryName: 'string',
    tournamentId: 'string',
    savedAt: 'datetime',
    lockedAt: 'datetime | null',
  },
  entryPicks: {
    entryId: 'number',
    playerId: 'number',
    slot: 'number',
  },
  livePlayerStats: {
    tournamentId: 'string',
    playerId: 'number',
    thru: 'string',
    score: 'string',
    pars: 'number',
    birdies: 'number',
    eagles: 'number',
    aces: 'number',
    bogeys: 'number',
    doubles: 'number',
    triplePlus: 'number',
    streaks: 'number',
    roundLeadBonus: 'number',
    finishingBonus: 'number',
    lowRoundBonus: 'number',
    updatedAt: 'datetime',
  },
  poolSettings: {
    venmo: 'string',
    entryFee: 'number',
    payoutFirst: 'number',
    payoutSecond: 'number',
    payoutThird: 'number',
    manualLock: 'boolean',
  },
};

const TOURNAMENTS = [
  { id: 'players', name: 'The Players Championship', venue: 'TPC Sawgrass', lockTimeLabel: 'Thu 7:40 AM', lockAt: '2026-03-12T07:40:00' },
  { id: 'masters', name: 'The Masters', venue: 'Augusta National', lockTimeLabel: 'Thu 7:30 AM', lockAt: '2026-04-09T07:30:00' },
  { id: 'pga', name: 'The PGA Championship', venue: 'TBD', lockTimeLabel: 'Thu 7:20 AM', lockAt: '2026-05-14T07:20:00' },
  { id: 'us-open', name: 'The U.S. Open', venue: 'TBD', lockTimeLabel: 'Thu 7:15 AM', lockAt: '2026-06-18T07:15:00' },
  { id: 'open', name: 'The Open Championship', venue: 'TBD', lockTimeLabel: 'Thu 6:35 AM', lockAt: '2026-07-16T06:35:00' },
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
  ['15th - 20th Place', 5],
  ['21st - 29th Place', 3],
  ['30th - 40th Place', 1],
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
  { tournamentId: 'players', playerId: 1, thru: '13', score: '-4', pars: 42, birdies: 14, eagles: 1, aces: 0, bogeys: 5, doubles: 0, triplePlus: 0, streaks: 2, roundLeadBonus: 5, finishingBonus: 40, lowRoundBonus: 5, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 2, thru: 'F', score: '-2', pars: 40, birdies: 13, eagles: 0, aces: 0, bogeys: 6, doubles: 1, triplePlus: 0, streaks: 1, roundLeadBonus: 0, finishingBonus: 25, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 3, thru: '11', score: '-1', pars: 39, birdies: 11, eagles: 0, aces: 0, bogeys: 5, doubles: 0, triplePlus: 0, streaks: 1, roundLeadBonus: 5, finishingBonus: 20, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 4, thru: '12', score: 'E', pars: 44, birdies: 10, eagles: 0, aces: 0, bogeys: 8, doubles: 0, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: 19, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 5, thru: '10', score: '-1', pars: 41, birdies: 12, eagles: 1, aces: 0, bogeys: 7, doubles: 0, triplePlus: 0, streaks: 1, roundLeadBonus: 5, finishingBonus: 18, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 6, thru: 'F', score: '+1', pars: 46, birdies: 9, eagles: 0, aces: 0, bogeys: 9, doubles: 1, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: 16, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 7, thru: '8', score: 'E', pars: 43, birdies: 10, eagles: 0, aces: 0, bogeys: 7, doubles: 0, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: 14, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 8, thru: '14', score: '-2', pars: 45, birdies: 12, eagles: 0, aces: 0, bogeys: 5, doubles: 0, triplePlus: 0, streaks: 2, roundLeadBonus: 0, finishingBonus: 12, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 9, thru: '9', score: '+1', pars: 42, birdies: 8, eagles: 1, aces: 0, bogeys: 10, doubles: 1, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: 11, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 10, thru: '12', score: '-1', pars: 41, birdies: 11, eagles: 0, aces: 1, bogeys: 7, doubles: 0, triplePlus: 0, streaks: 1, roundLeadBonus: 0, finishingBonus: 10, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 11, thru: 'F', score: '+2', pars: 38, birdies: 8, eagles: 0, aces: 0, bogeys: 11, doubles: 2, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: -10, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 12, thru: '7', score: '-2', pars: 40, birdies: 12, eagles: 1, aces: 0, bogeys: 6, doubles: 0, triplePlus: 0, streaks: 2, roundLeadBonus: 0, finishingBonus: 9, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 13, thru: '11', score: 'E', pars: 43, birdies: 9, eagles: 0, aces: 0, bogeys: 8, doubles: 1, triplePlus: 0, streaks: 0, roundLeadBonus: 0, finishingBonus: 8, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
  { tournamentId: 'players', playerId: 14, thru: '10', score: '-1', pars: 39, birdies: 10, eagles: 0, aces: 0, bogeys: 6, doubles: 0, triplePlus: 1, streaks: 1, roundLeadBonus: 0, finishingBonus: 7, lowRoundBonus: 0, updatedAt: '2026-03-12T12:00:00' },
];

const STATIC_ENTRIES = [
  { id: 2, name: 'Brady S.', picks: [1, 3, 5, 7, 9, 11] },
  { id: 3, name: 'Megan T.', picks: [2, 4, 6, 8, 12, 13] },
  { id: 4, name: 'Ryan H.', picks: [3, 4, 5, 9, 10, 14] },
];

const getRosterStorageKey = (userName: string, tournamentId: string) =>
  `${STORAGE_PREFIX}:roster:${userName}:${tournamentId}`;
const getSettingsStorageKey = () => `${STORAGE_PREFIX}:settings`;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

const mockPoolService = {
  async loadSettings() {
    return readJson(getSettingsStorageKey(), DEFAULT_SETTINGS);
  },
  async saveSettings(nextSettings: typeof DEFAULT_SETTINGS) {
    writeJson(getSettingsStorageKey(), nextSettings);
    return nextSettings;
  },
  async loadRoster(entryName: string, tournamentId: string) {
    return readJson<null | { entryName: string; tournamentId: string; playerIds: number[]; savedAt: string }>(
      getRosterStorageKey(entryName, tournamentId),
      null
    );
  },
  async saveRoster({
    entryName,
    tournamentId,
    playerIds,
  }: {
    entryName: string;
    tournamentId: string;
    playerIds: number[];
  }) {
    const payload = {
      entryName,
      tournamentId,
      playerIds,
      savedAt: new Date().toISOString(),
    };
    writeJson(getRosterStorageKey(entryName, tournamentId), payload);
    return payload;
  },
};

const scoreToNumber = (value: string) => (value === 'E' ? 0 : Number(value));

const calculatePlayerBonus = (player: any) =>
  player.pars +
  player.birdies * 3 +
  player.eagles * 5 +
  player.aces * 8 +
  player.bogeys * -1 +
  player.doubles * -3 +
  player.triplePlus * -5 +
  player.streaks * 3 +
  player.roundLeadBonus +
  player.finishingBonus +
  player.lowRoundBonus;

const buildTournamentPlayerView = (tournamentId: string) => {
  const salaryByPlayerId = Object.fromEntries(
    TOURNAMENT_SALARIES.filter((row) => row.tournamentId === tournamentId).map((row) => [row.playerId, row])
  );
  const liveByPlayerId = Object.fromEntries(
    LIVE_PLAYER_STATS.filter((row) => row.tournamentId === tournamentId).map((row) => [row.playerId, row])
  );

  return PLAYERS.map((player) => {
    const salaryRow = salaryByPlayerId[player.id];
    const liveRow = liveByPlayerId[player.id];
    if (!salaryRow || !liveRow) return null;
    return {
      id: player.id,
      name: player.name,
      owgr: player.owgr,
      salary: salaryRow.salary,
      odds: salaryRow.odds,
      salaryRank: salaryRow.salaryRank,
      thru: liveRow.thru,
      score: liveRow.score,
      pars: liveRow.pars,
      birdies: liveRow.birdies,
      eagles: liveRow.eagles,
      aces: liveRow.aces,
      bogeys: liveRow.bogeys,
      doubles: liveRow.doubles,
      triplePlus: liveRow.triplePlus,
      streaks: liveRow.streaks,
      roundLeadBonus: liveRow.roundLeadBonus,
      finishingBonus: liveRow.finishingBonus,
      lowRoundBonus: liveRow.lowRoundBonus,
      updatedAt: liveRow.updatedAt,
    };
  }).filter(Boolean);
};

const validateRoster = (roster: number[], playersById: Record<number, any>) => {
  if (roster.length !== REQUIRED_GOLFERS) {
    return { ok: false, message: `Roster must contain exactly ${REQUIRED_GOLFERS} golfers.` };
  }
  const invalidIds = roster.filter((id) => !playersById[id]);
  if (invalidIds.length > 0) {
    return { ok: false, message: 'Roster contains invalid golfers.' };
  }
  const salary = roster.reduce((sum, id) => sum + playersById[id].salary, 0);
  if (salary > SALARY_CAP) {
    return { ok: false, message: `Roster exceeds the $${SALARY_CAP.toLocaleString()} salary cap.` };
  }
  return { ok: true, message: 'Roster is valid.' };
};

function getCountdownParts(lockAt: string) {
  const now = new Date().getTime();
  const lock = new Date(lockAt).getTime();
  const diff = lock - now;
  if (diff <= 0) return { isLocked: true, label: 'Locked' };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { isLocked: false, label: `${hours}h ${minutes}m until lock` };
}

function Pill({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'green' | 'amber' | 'blue' | 'red';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-sky-100 text-sky-700',
    red: 'bg-rose-100 text-rose-700',
  };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
function NavTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-sm font-semibold transition ${
        active ? 'tab-active' : 'tab-inactive hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}
function SectionCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm text-slate-100">{children}</pre>;
}

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
  const [countdownLabel, setCountdownLabel] = useState('Loading...');
  const [autoLocked, setAutoLocked] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [isRosterSaving, setIsRosterSaving] = useState(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);

  const tournament = TOURNAMENTS.find((t) => t.id === selectedTournament) ?? TOURNAMENTS[0];
  const tournamentPlayers = useMemo(() => buildTournamentPlayerView(selectedTournament), [selectedTournament]);
  const playersById = useMemo(() => Object.fromEntries(tournamentPlayers.map((p: any) => [p.id, p])), [tournamentPlayers]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      setIsBooting(true);
      const loadedSettings = await mockPoolService.loadSettings();
      if (!cancelled) {
        setSettings(loadedSettings);
        setIsBooting(false);
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRoster = async () => {
      setIsRosterLoading(true);
      const savedRoster = await mockPoolService.loadRoster(entryName, selectedTournament);
      if (cancelled) return;
      if (savedRoster && Array.isArray(savedRoster.playerIds)) {
        setSelectedRoster(savedRoster.playerIds);
        setLastSavedAt(new Date(savedRoster.savedAt).toLocaleString());
      } else {
        setSelectedRoster(DEFAULT_ROSTER);
        setLastSavedAt('Not saved yet');
      }
      setIsRosterLoading(false);
    };
    loadRoster();
    return () => {
      cancelled = true;
    };
  }, [entryName, selectedTournament]);

  useEffect(() => {
    let cancelled = false;
    const persistSettings = async () => {
      setIsSettingsSaving(true);
      await mockPoolService.saveSettings(settings);
      if (!cancelled) {
        setIsSettingsSaving(false);
      }
    };
    persistSettings();
    return () => {
      cancelled = true;
    };
  }, [settings]);

  useEffect(() => {
    const updateCountdown = () => {
      const next = getCountdownParts(tournament.lockAt);
      setAutoLocked(next.isLocked);
      setCountdownLabel(next.label);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [tournament.lockAt]);

  const locked = settings.manualLock || autoLocked;

  const rosterPlayers = selectedRoster.map((id) => playersById[id]).filter(Boolean);
  const salaryUsed = rosterPlayers.reduce((sum: number, player: any) => sum + player.salary, 0);
  const salaryRemaining = SALARY_CAP - salaryUsed;
  const rosterRaw = rosterPlayers.reduce((sum: number, player: any) => sum + scoreToNumber(player.score), 0);
  const rosterBonus = rosterPlayers.reduce((sum: number, player: any) => sum + calculatePlayerBonus(player), 0);
  const rosterNet = rosterRaw - rosterBonus;

  const dynamicEntry = { id: 1, name: entryName, picks: selectedRoster };
  const standings = [dynamicEntry, ...STATIC_ENTRIES]
    .map((entry) => {
      const golfers = entry.picks.map((id) => playersById[id]).filter(Boolean);
      const rawScore = golfers.reduce((sum: number, player: any) => sum + scoreToNumber(player.score), 0);
      const bonus = golfers.reduce((sum: number, player: any) => sum + calculatePlayerBonus(player), 0);
      const net = rawScore - bonus;
      const salary = golfers.reduce((sum: number, player: any) => sum + player.salary, 0);
      return { ...entry, golfers, rawScore, bonus, net, salary };
    })
    .sort((a, b) => a.net - b.net)
    .map((entry, index) => ({ ...entry, place: index + 1 }));

  const projectedPot = standings.length * Number(settings.entryFee || 0);
  const payoutTotal = Number(settings.payouts.first) + Number(settings.payouts.second) + Number(settings.payouts.third);

  const toggleRosterPlayer = (playerId: number) => {
    if (locked || isRosterLoading || isRosterSaving) return;
    if (selectedRoster.includes(playerId)) {
      setSelectedRoster(selectedRoster.filter((id) => id !== playerId));
      return;
    }
    if (selectedRoster.length >= REQUIRED_GOLFERS) return;
    const next = [...selectedRoster, playerId];
    const nextSalary = next.reduce((sum, id) => sum + playersById[id].salary, 0);
    if (nextSalary > SALARY_CAP) return;
    setSelectedRoster(next);
  };

  const handleSaveRoster = async () => {
    const validation = validateRoster(selectedRoster, playersById);
    if (locked) {
      setSaveMessage('Lineups are locked for this tournament.');
      return;
    }
    if (!validation.ok) {
      setSaveMessage(validation.message);
      return;
    }
    setIsRosterSaving(true);
    const saved = await mockPoolService.saveRoster({
      entryName,
      tournamentId: selectedTournament,
      playerIds: selectedRoster,
    });
    setLastSavedAt(new Date(saved.savedAt).toLocaleString());
    setSaveMessage('Roster saved successfully.');
    setIsRosterSaving(false);
  };

  const handleResetRoster = () => {
    if (locked || isRosterLoading || isRosterSaving) return;
    setSelectedRoster(DEFAULT_ROSTER);
    setSaveMessage('Roster reset to default mock picks.');
  };

  const simulateRefresh = () => {
    const statuses = ['Healthy', 'Delayed', 'Manual review'];
    const times = ['just now', '1 minute ago', '2 minutes ago'];
    setLastRefresh(times[Math.floor(Math.random() * times.length)]);
    setSyncStatus(statuses[Math.floor(Math.random() * statuses.length)]);
  };

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(34,197,94,0.18),rgba(15,23,42,0.95),rgba(2,6,23,1))] text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="grid gap-8 p-6 lg:grid-cols-[1.5fr,1fr] lg:p-8">
            <div>
              <Pill tone="green">5-Tournament Major Pool</Pill>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Golf pool MVP for a shareable season-long majors site</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200">
                Build a six-player roster under the $50,000 cap, lock picks at first tee time, and follow semi-live standings with golfer-by-golfer updates and bonus scoring.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {TOURNAMENTS.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedTournament(event.id)}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      selectedTournament === event.id ? 'bg-white text-slate-900' : 'bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20'
                    }`}
                  >
                    <div>{event.name}</div>
                    <div className="mt-1 text-xs opacity-80">{event.venue}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 rounded-[1.75rem] bg-white/10 p-5 ring-1 ring-white/10 backdrop-blur">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Wallet className="h-4 w-4" /> Entry Fee
                  </div>
                  <p className="mt-2 text-3xl font-bold">${settings.entryFee}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Users className="h-4 w-4" /> Entrants
                  </div>
                  <p className="mt-2 text-3xl font-bold">{standings.length}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-200">Payment</p>
                    <p className="mt-1 text-xl font-semibold">{settings.venmo}</p>
                  </div>
                  <Pill tone="green">Manual Venmo</Pill>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-white/10 p-3">
                    <div className="text-slate-300">1st</div>
                    <div className="mt-1 font-semibold">{settings.payouts.first}%</div>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3">
                    <div className="text-slate-300">2nd</div>
                    <div className="mt-1 font-semibold">{settings.payouts.second}%</div>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3">
                    <div className="text-slate-300">3rd</div>
                    <div className="mt-1 font-semibold">{settings.payouts.third}%</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-200">Current Tournament</p>
                    <p className="mt-1 font-semibold">{tournament.name}</p>
                    <p className="mt-1 text-sm text-slate-300">Lock: {tournament.lockTimeLabel}</p>
                    <p className="mt-1 text-sm text-slate-300">{countdownLabel}</p>
                  </div>
                  <Clock3 className="h-5 w-5 text-slate-200" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {isBooting ? (
          <div className="mb-6 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            Loading pool settings...
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap gap-3">
          {['My Picks', 'Standings', 'Rules and Scoring', 'Admin'].map((tab) => (
            <NavTab key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
              {tab}
            </NavTab>
          ))}
        </div>

        {activeTab === 'My Picks' && (
          <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
            <SectionCard
              title="Build Your Roster"
              subtitle="Pick exactly 6 golfers without going over the $50,000 cap."
              right={<Pill tone={locked ? 'red' : 'green'}>{locked ? 'Locked' : 'Editable'}</Pill>}
            >
              <div className="mb-5 grid gap-4 sm:grid-cols-4">
                <div className="stat-box p-4">
                  <div className="text-sm text-slate-500">Entry Name</div>
                  <div className="mt-1 font-semibold">{entryName}</div>
                </div>
                <div className="stat-box p-4">
                  <div className="text-sm text-slate-500">Roster Spots</div>
                  <div className="mt-1 font-semibold">
                    {selectedRoster.length} / {REQUIRED_GOLFERS}
                  </div>
                </div>
                <div className="stat-box p-4">
                  <div className="text-sm text-slate-500">Salary Used</div>
                  <div className="mt-1 font-semibold">${salaryUsed.toLocaleString()}</div>
                </div>
                <div className="stat-box p-4">
                  <div className="text-sm text-slate-500">Remaining</div>
                  <div className={`mt-1 font-semibold ${salaryRemaining < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    ${salaryRemaining.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {tournamentPlayers.map((player: any) => {
                  const selected = selectedRoster.includes(player.id);
                  const nextSalary = salaryUsed + (selected ? 0 : player.salary);
                  const wouldExceedCap = !selected && nextSalary > SALARY_CAP;

                  return (
                    <button
                      key={player.id}
                      onClick={() => toggleRosterPlayer(player.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      } ${locked || wouldExceedCap || isRosterLoading || isRosterSaving ? 'opacity-70' : ''}`}
                    >
                      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{player.name}</span>
                            {selected ? <Pill tone="green">Selected</Pill> : null}
                            {wouldExceedCap ? <Pill tone="amber">Over cap</Pill> : null}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
                            <span>OWGR #{player.owgr}</span>
                            <span>•</span>
                            <span>Outright {player.odds}</span>
                            <span>•</span>
                            <span>Thru {player.thru}</span>
                            <span>•</span>
                            <span>Score {player.score}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm lg:min-w-[270px]">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-slate-500">Salary</div>
                            <div className="mt-1 font-semibold">${player.salary.toLocaleString()}</div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-slate-500">Bonus</div>
                            <div className="mt-1 font-semibold">{calculatePlayerBonus(player)}</div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-slate-500">Action</div>
                            <div className="mt-1 font-semibold">{selected ? 'Remove' : 'Add'}</div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={handleSaveRoster}
                  disabled={isRosterSaving || isRosterLoading}
                 className="button-primary inline-flex items-center gap-2 px-4 py-3 text-sm disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> {isRosterSaving ? 'Saving...' : 'Save roster'}
                </button>
                <button
                  onClick={handleResetRoster}
                  disabled={isRosterSaving || isRosterLoading}
                  className="button-secondary px-4 py-3 text-sm disabled:opacity-60"
                >
                  Reset to default roster
                </button>
              </div>
              <div className="mt-3 text-sm text-slate-500">
                {isRosterLoading ? 'Loading saved roster...' : `Last saved: ${lastSavedAt}`}
              </div>
              {saveMessage ? <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{saveMessage}</div> : null}
            </SectionCard>

            <div className="space-y-6">
              <SectionCard title="My Live Team" subtitle="Mock live scoring using your real bonus framework." right={<Pill tone="blue">Semi-live</Pill>}>
                <div className="space-y-3">
                  {rosterPlayers.map((player: any) => (
                    <div key={player.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">{player.name}</div>
                          <div className="mt-1 text-sm text-slate-500">Salary ${player.salary.toLocaleString()} • Thru {player.thru}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-semibold">{player.score}</div>
                          <div className="text-slate-500">Bonus {calculatePlayerBonus(player)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <div className="stat-box p-4">
                    <div className="text-slate-500">Raw Score</div>
                    <div className="mt-1 text-lg font-semibold">{rosterRaw > 0 ? `+${rosterRaw}` : rosterRaw}</div>
                  </div>
                  <div className="stat-box p-4">
                    <div className="text-slate-500">Bonus</div>
                    <div className="mt-1 text-lg font-semibold">{rosterBonus}</div>
                  </div>
                  <div className="stat-box p-4">
                    <div className="text-slate-500">Net</div>
                    <div className="mt-1 text-lg font-semibold">{rosterNet > 0 ? `+${rosterNet}` : rosterNet}</div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Payment and Payouts" subtitle="Public-facing info block.">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                    <span>Entry Fee</span>
                    <span className="font-semibold">${settings.entryFee}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                    <span>Venmo</span>
                    <span className="font-semibold">{settings.venmo}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                    <span>Projected Prize Pool</span>
                    <span className="font-semibold">${projectedPot.toLocaleString()}</span>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {activeTab === 'Standings' && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <SectionCard
              title="Live Standings"
              subtitle="Net score = combined golfer score minus bonus points. Lower is better."
              right={
                <div className="flex items-center gap-2">
                  <Pill tone={syncStatus === 'Healthy' ? 'green' : syncStatus === 'Delayed' ? 'amber' : 'red'}>{syncStatus}</Pill>
                  <button onClick={simulateRefresh} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                    <RefreshCw className="h-4 w-4" /> Refresh
                  </button>
                </div>
              }
            >
              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <div className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4" /> Last sync {lastRefresh}
                </div>
                <div className="inline-flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Source: unofficial leaderboard + cache
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Place</th>
                      <th className="px-4 py-3 font-medium">Entry</th>
                      <th className="px-4 py-3 font-medium">Salary</th>
                      <th className="px-4 py-3 font-medium">Raw</th>
                      <th className="px-4 py-3 font-medium">Bonus</th>
                      <th className="px-4 py-3 font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {standings.map((entry: any) => (
                      <tr key={entry.id} className={entry.name === entryName ? 'bg-emerald-50/70' : ''}>
                        <td className="px-4 py-3 font-semibold">{entry.place}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{entry.name}</div>
                          <div className="text-xs text-slate-500">{entry.golfers.length} golfers</div>
                        </td>
                        <td className="px-4 py-3">${entry.salary.toLocaleString()}</td>
                        <td className="px-4 py-3">{entry.rawScore > 0 ? `+${entry.rawScore}` : entry.rawScore}</td>
                        <td className="px-4 py-3">{entry.bonus}</td>
                        <td className="px-4 py-3 text-base font-semibold">{entry.net > 0 ? `+${entry.net}` : entry.net}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <div className="space-y-6">
              <SectionCard title="Featured Player Tracker" subtitle="Example live-ish golfer board fed from your refresh job.">
                <div className="space-y-3">
                  {tournamentPlayers.slice(0, 6).map((player: any) => (
                    <div key={player.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{player.name}</div>
                          <div className="mt-1 text-sm text-slate-500">Through {player.thru} • Score {player.score}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-semibold">Bonus {calculatePlayerBonus(player)}</div>
                          <div className="text-slate-500">Odds {player.odds}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Payout Snapshot" subtitle="Displayed publicly so participants can see what they are playing for.">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-amber-50 p-4">
                    <span className="inline-flex items-center gap-2">
                      <Medal className="h-4 w-4" /> 1st Place
                    </span>
                    <span className="font-semibold">${Math.round(projectedPot * (settings.payouts.first / 100)).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                    <span className="inline-flex items-center gap-2">
                      <Medal className="h-4 w-4" /> 2nd Place
                    </span>
                    <span className="font-semibold">${Math.round(projectedPot * (settings.payouts.second / 100)).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-orange-50 p-4">
                    <span className="inline-flex items-center gap-2">
                      <Medal className="h-4 w-4" /> 3rd Place
                    </span>
                    <span className="font-semibold">${Math.round(projectedPot * (settings.payouts.third / 100)).toLocaleString()}</span>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {activeTab === 'Rules and Scoring' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Pool Rules" subtitle="This tab uses your latest bonus structure.">
              <div className="space-y-4 text-sm leading-7 text-slate-600">
                <div className="stat-box p-4">
                  <div className="font-semibold text-slate-900">Roster Construction</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Participants pick 6 golfers per tournament.</li>
                    <li>Total salary must not exceed $50,000.</li>
                    <li>Salaries are based on a blend of world ranking and Vegas odds.</li>
                    <li>Picks may be edited until the first tee time of the event.</li>
                  </ul>
                </div>
                <div className="stat-box p-4">
                  <div className="font-semibold text-slate-900">Scoring</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Raw score is the sum of all 6 golfers&apos; tournament scores.</li>
                    <li>Bonus points are subtracted from the raw score to produce net score.</li>
                    <li>Lower net score ranks higher in the standings.</li>
                    <li>Live updates refresh on a delay using unofficial public leaderboard data.</li>
                  </ul>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Bonus Scoring" subtitle="Using the categories you provided.">
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {BONUS_ROWS.map(([label, points]) => (
                      <tr key={label}>
                        <td className="px-4 py-3">{label}</td>
                        <td className="px-4 py-3 font-semibold">{points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                The prototype now calculates mock bonus totals from your real scoring categories. In production, these values should be computed from live hole-by-hole event data and official finishing position data.
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === 'Admin' && (
          <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
            <SectionCard title="Admin Controls" subtitle="This section simulates the tools you would use to run the pool each week." right={<Pill tone="amber">Owner only</Pill>}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <div className="mb-2 font-medium">Entry Name</div>
                  <input value={entryName} onChange={(e) => setEntryName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none ring-0" />
                </label>
                <label className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <div className="mb-2 font-medium">Venmo</div>
                  <input value={settings.venmo} onChange={(e) => setSettings({ ...settings, venmo: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none ring-0" />
                </label>
                <label className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <div className="mb-2 font-medium">Entry Fee</div>
                  <input type="number" value={settings.entryFee} onChange={(e) => setSettings({ ...settings, entryFee: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none ring-0" />
                </label>
                <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <div className="mb-2 font-medium">Lineup Lock</div>
                  <button onClick={() => setSettings({ ...settings, manualLock: !settings.manualLock })} className={`w-full rounded-xl px-3 py-2 font-medium ${locked ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {locked ? (
                      <span className="inline-flex items-center gap-2">
                        <Lock className="h-4 w-4" /> Locked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Unlock className="h-4 w-4" /> Open
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <label className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <div className="mb-2 font-medium">1st %</div>
                  <input type="number" value={settings.payouts.first} onChange={(e) => setSettings({ ...settings, payouts: { ...settings.payouts, first: Number(e.target.value) } })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <div className="mb-2 font-medium">2nd %</div>
                  <input type="number" value={settings.payouts.second} onChange={(e) => setSettings({ ...settings, payouts: { ...settings.payouts, second: Number(e.target.value) } })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <div className="mb-2 font-medium">3rd %</div>
                  <input type="number" value={settings.payouts.third} onChange={(e) => setSettings({ ...settings, payouts: { ...settings.payouts, third: Number(e.target.value) } })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2" />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 ${payoutTotal === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <CheckCircle2 className="h-4 w-4" /> Payout total: {payoutTotal}%
                </span>
                <span className="text-slate-500">{isSettingsSaving ? 'Saving settings...' : 'Settings save automatically in this prototype.'}</span>
              </div>
            </SectionCard>

            <div className="space-y-6">
              <SectionCard title="Semi-live Feed Workflow" subtitle="This is the operating model for Option A using unofficial public leaderboard data.">
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <RefreshCw className="mt-0.5 h-4 w-4 text-sky-600" />
                    <div>
                      <div className="font-medium">Refresh leaderboard every 2–5 minutes</div>
                      <div className="mt-1 text-slate-500">Normalize player score, thru, status, and last update time into your database.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <TrendingUp className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="font-medium">Recompute entry scores after each sync</div>
                      <div className="mt-1 text-slate-500">Raw team score and bonus points are recalculated from stored golfer states.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                    <div>
                      <div className="font-medium">Flag source issues for manual review</div>
                      <div className="mt-1 text-slate-500">If the feed is delayed or parsing fails, the site shows last good data and an admin status warning.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <Flag className="mt-0.5 h-4 w-4 text-slate-700" />
                    <div>
                      <div className="font-medium">Lock at first tee time</div>
                      <div className="mt-1 text-slate-500">No roster edits after official start. In production, this should be enforced server-side.</div>
                    </div>
                  </div>
                </div>
                <button onClick={simulateRefresh} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">
                  <Settings2 className="h-4 w-4" /> Run simulated sync
                </button>
              </SectionCard>

              <SectionCard title="Backend Contract" subtitle="The UI now talks to an async mock service, which is the bridge point for a real backend.">
                <CodeBlock>{`mockPoolService methods:
- loadSettings()
- saveSettings(settings)
- loadRoster(entryName, tournamentId)
- saveRoster({ entryName, tournamentId, playerIds })

current UI states:
- isBooting
- isRosterLoading
- isRosterSaving
- isSettingsSaving

next real implementation:
- replace localStorage reads/writes with API calls
- keep UI state and validation unchanged
- map these methods to Supabase queries/actions
- keep loading/saving indicators as-is`}</CodeBlock>
              </SectionCard>

              <SectionCard title="Data Model Scaffold" subtitle="These are the core entities this UI should map to in a real backend.">
                <CodeBlock>{JSON.stringify(DATA_MODEL, null, 2)}</CodeBlock>
                <div className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm text-sky-800">
                  The UI now builds tournament player cards from normalized sources: PLAYERS + TOURNAMENT_SALARIES + LIVE_PLAYER_STATS.
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {BACKEND_MAPPING_NOTES.map((note) => (
                    <div key={note} className="rounded-xl bg-slate-50 px-3 py-2">
                      {note}
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Suggested Tests" subtitle="Add these when the app moves into a real project.">
                <CodeBlock>{`test('validateRoster requires exactly 6 golfers')
test('validateRoster rejects cap over $50,000')
test('saveRoster blocks when locked')
test('mockPoolService.saveRoster persists roster by tournament key')
test('mockPoolService.loadSettings returns defaults when empty')
test('standings sort by lowest net score')
test('admin payout warning appears when total != 100')`}</CodeBlock>
              </SectionCard>
            </div>
          </div>
        )}

        <footer className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              MVP status: front-end prototype complete for a shareable golf pool site. To go live, connect this UI to authentication, a database, lineup storage, scheduled refresh jobs, and your unofficial leaderboard and odds ingestion services.
            </div>
            <div className="inline-flex items-center gap-2 font-medium text-slate-700">
              Next step: connect real APIs <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}