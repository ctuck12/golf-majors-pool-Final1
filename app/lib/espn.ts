import type { SlashGolfLeaderboardRow } from './slashgolf';
import type { StoredPlayerScorecards } from './scorecard-store';

// ── ESPN response types ────────────────────────────────────────────────────

type EspnHoleLinescore = {
  value: number;           // strokes on hole
  period: number;          // hole number 1-18
  scoreType?: { displayValue: string }; // "E" | "+1" | "-1" | "+2" | "-2" etc.
};

type EspnRoundLinescore = {
  value: number;           // total strokes for round
  displayValue: string;    // round to-par: "-5", "E", "+2"
  period: number;          // round number 1-4
  linescores?: EspnHoleLinescore[];
  // ESPN buries tee time as the last stat entry (no "value" key, only "displayValue")
  // e.g. "Thu May 14 14:27:00 PDT 2026"
  statistics?: {
    categories?: Array<{
      stats?: Array<{ value?: number; displayValue?: string }>;
    }>;
  };
};

type EspnStatus = {
  period?: number;
  type?: { name: string; state: string; completed: boolean };
};

type EspnCompetitor = {
  id: string;
  order: number;           // leaderboard rank (1 = leader)
  athlete: { displayName?: string; fullName?: string };
  score?: string;          // "-12" | "E" | "+4" | "CUT" | "WD" | "DQ" | "MDF" | "MC"
  status?: { period?: number; type?: { name?: string; state?: string; completed?: boolean } };
  linescores?: EspnRoundLinescore[];
};

type EspnScoreboardResponse = {
  events?: Array<{
    id: string;
    competitions?: Array<{
      competitors?: EspnCompetitor[];
      status?: EspnStatus;
    }>;
    status?: EspnStatus;
  }>;
};

// ── Public result type ─────────────────────────────────────────────────────

export type ESPNTournamentResult = {
  leaderboardRows: SlashGolfLeaderboardRow[];
  currentRound: number;
  roundStatus: string;
  projectedCut: string | null;
  playerScorecards: Record<string, StoredPlayerScorecards>;
};

// ── Private helpers ────────────────────────────────────────────────────────

const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);

// Map ESPN competitor status.type.name values → our canonical score strings
const ESPN_STATUS_NAME_TO_SCORE: Record<string, string> = {
  STATUS_CUT: 'CUT',
  STATUS_MC: 'CUT',
  STATUS_WD: 'WD',
  STATUS_DQ: 'DQ',
  STATUS_MDF: 'MDF',
};

function parseRelScore(displayValue: string | undefined): number {
  if (!displayValue || displayValue === 'E') return 0;
  return parseInt(displayValue, 10) || 0;
}

function mapRoundStatus(status: EspnStatus | undefined): string {
  const state = status?.type?.state ?? '';
  const name = status?.type?.name ?? '';
  if (state === 'post') return 'Official';
  if (state === 'in' || name === 'STATUS_IN_PROGRESS') return 'In Progress';
  return '';
}

function deriveCurrentRound(
  competitors: EspnCompetitor[],
  statusPeriod: number | undefined,
): number {
  if (statusPeriod && statusPeriod > 0) return statusPeriod;
  let max = 0;
  for (const c of competitors) {
    for (const r of c.linescores ?? []) {
      if ((r.linescores?.length ?? 0) > 0) max = Math.max(max, r.period);
    }
  }
  return max || 1;
}

// Tee time lives in the last stats entry of the current round's linescore.
// That entry has no "value" key and contains a string like "Thu May 14 14:27:00 PDT 2026".
function extractTeeTime(linescores: EspnRoundLinescore[] | undefined, currentRound: number): string | null {
  const round = (linescores ?? []).find((r) => r.period === currentRound);
  const stats = round?.statistics?.categories?.[0]?.stats;
  if (!stats?.length) return null;
  const last = stats[stats.length - 1];
  if (!('value' in last) && last.displayValue?.includes(':')) return last.displayValue;
  return null;
}

function deriveThru(
  linescores: EspnRoundLinescore[] | undefined,
  currentRound: number,
): string {
  const round = (linescores ?? []).find((r) => r.period === currentRound);
  const count = round?.linescores?.length ?? 0;
  if (count === 0) return '--';
  if (count >= 18) return 'F';
  return String(count);
}

function buildPositionStrings(competitors: EspnCompetitor[]): Map<string, string> {
  const result = new Map<string, string>();

  // Sort active (non-cut) players by ESPN order then group ties by equal score
  const active = competitors
    .filter((c) => !CUT_STATUSES.has((c.score ?? '').toUpperCase()))
    .sort((a, b) => a.order - b.order);

  let rank = 1;
  let i = 0;
  while (i < active.length) {
    const score = active[i].score ?? '';
    let j = i;
    while (j < active.length && active[j].score === score) j++;
    const pos = j - i > 1 ? `T${rank}` : String(rank);
    for (let k = i; k < j; k++) result.set(active[k].id, pos);
    rank += j - i;
    i = j;
  }

  for (const c of competitors) {
    const s = (c.score ?? '').toUpperCase();
    if (CUT_STATUSES.has(s)) result.set(c.id, s);
  }

  return result;
}

function computeTotalStrokes(linescores: EspnRoundLinescore[] | undefined): string {
  const sum = (linescores ?? [])
    .filter((r) => (r.linescores?.length ?? 0) > 0)
    .reduce((acc, r) => acc + Math.round(r.value), 0);
  return sum > 0 ? String(sum) : '--';
}

// ESPN hole: value=strokes, scoreType.displayValue=relative-to-par for that hole
// par formula: strokes - relScore  e.g. (4 strokes, "-1" birdie) → par = 4-(-1) = 5
function parseStoredRounds(linescores: EspnRoundLinescore[] | undefined) {
  return (linescores ?? [])
    .filter((r) => (r.linescores?.length ?? 0) > 0)
    .map((r) => ({
      roundId: r.period,
      holes: (r.linescores ?? [])
        .map((h) => {
          const score = Math.round(h.value);
          const par = score - parseRelScore(h.scoreType?.displayValue);
          return { holeNumber: h.period, par, score };
        })
        .filter((h) => h.par > 0 && h.score > 0),
    }))
    .filter((r) => r.holes.length > 0);
}

// ── Main fetch ─────────────────────────────────────────────────────────────

export async function fetchESPNTournament(espnEventId: string): Promise<ESPNTournamentResult> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${today}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as EspnScoreboardResponse;
  const event = data.events?.find((e) => e.id === espnEventId);
  if (!event) throw new Error(`400: event ${espnEventId} not in ESPN scoreboard for ${today}`);

  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const eventStatus = competition?.status ?? event.status;

  // Tournament not yet started
  if ((eventStatus?.type?.state ?? '') === 'pre') {
    throw new Error('400: tournament not started (STATUS_SCHEDULED)');
  }

  // Normalize: if ESPN's competitor status.type.name indicates a cut/wd/dq but c.score
  // shows a numeric score, override c.score to the canonical cut string so all downstream
  // logic (CUT_STATUSES checks, buildPositionStrings, scoring) handles it uniformly.
  for (const c of competitors) {
    const scoreSanitized = (c.score ?? '').toUpperCase();
    if (!CUT_STATUSES.has(scoreSanitized)) {
      const statusName = (c.status?.type?.name ?? '').toUpperCase();
      const mapped = ESPN_STATUS_NAME_TO_SCORE[statusName];
      if (mapped) c.score = mapped;
    }
  }

  const currentRound = deriveCurrentRound(competitors, eventStatus?.period);
  const roundStatus = mapRoundStatus(eventStatus);
  const posStrings = buildPositionStrings(competitors);

  const leaderboardRows: SlashGolfLeaderboardRow[] = [];
  const playerScorecards: Record<string, StoredPlayerScorecards> = {};

  for (const c of competitors) {
    const displayName = c.athlete?.displayName ?? c.athlete?.fullName ?? '';
    if (!displayName) continue;

    const spaceIdx = displayName.indexOf(' ');
    const firstName = spaceIdx >= 0 ? displayName.slice(0, spaceIdx) : displayName;
    const lastName = spaceIdx >= 0 ? displayName.slice(spaceIdx + 1) : '';

    // Treat MC (missed cut) identically to CUT for all downstream logic
    const rawScore = c.score ?? '--';
    const score = rawScore.toUpperCase() === 'MC' ? 'CUT' : rawScore;
    const isCut = CUT_STATUSES.has(score.toUpperCase());
    const position = posStrings.get(c.id) ?? '--';
    const thru = deriveThru(c.linescores, currentRound);
    const status = isCut ? score.toLowerCase() : 'active';

    const rounds: SlashGolfLeaderboardRow['rounds'] = (c.linescores ?? []).map((r) => ({
      roundId: r.period,
      scoreToPar: r.displayValue,
      strokes: Math.round(r.value),
    }));

    leaderboardRows.push({
      playerId: c.id,
      firstName,
      lastName,
      position,
      total: score,
      thru,
      status,
      currentRound,
      totalStrokesFromCompletedRounds: computeTotalStrokes(c.linescores),
      rounds,
      roundComplete: false,
      teeTime: extractTeeTime(c.linescores, currentRound),
    });

    const storedRounds = parseStoredRounds(c.linescores);
    if (storedRounds.length > 0) {
      playerScorecards[c.id] = {
        playerId: c.id,
        playerName: displayName,
        rounds: storedRounds,
        refreshedAt: new Date().toISOString(),
      };
    }
  }

  return { leaderboardRows, currentRound, roundStatus, projectedCut: null, playerScorecards };
}
