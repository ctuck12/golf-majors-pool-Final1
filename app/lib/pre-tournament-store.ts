import redis from './redis';
import type { TournamentId } from './pool-store';

// Commissioner-set "show the next-season pre-tournament card" overrides. `overrides` holds the
// manual value per tournament (true = pre-tournament card, false = results); `manualAt` holds when
// each was last set. The client honors a manual value only until the next automatic reset point
// (that tournament's next start, or the next Jan 1), then falls back to the date-driven default —
// so the tab still flips to live standings on its own once the event tees off, and back to
// pre-tournament for every tournament on Jan 1.

const KEY = 'pool-pre-tournament-view:v1';

export type PreTournamentState = {
  overrides: Partial<Record<TournamentId, boolean>>;
  manualAt: Partial<Record<TournamentId, string>>;
};

export async function getPreTournamentState(): Promise<PreTournamentState> {
  try {
    const raw = await redis.get(KEY);
    if (!raw) return { overrides: {}, manualAt: {} };
    const parsed = JSON.parse(raw as string) as unknown;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      // New shape.
      if ('overrides' in obj && obj.overrides && typeof obj.overrides === 'object') {
        return {
          overrides: obj.overrides as Partial<Record<TournamentId, boolean>>,
          manualAt: (obj.manualAt && typeof obj.manualAt === 'object' ? obj.manualAt : {}) as Partial<Record<TournamentId, string>>,
        };
      }
      // Legacy flat shape ({ players: true }) — migrate to overrides, no timestamps (treated as fresh).
      const flat: Partial<Record<TournamentId, boolean>> = {};
      for (const [k, v] of Object.entries(obj)) if (typeof v === 'boolean') flat[k as TournamentId] = v;
      return { overrides: flat, manualAt: {} };
    }
    return { overrides: {}, manualAt: {} };
  } catch {
    return { overrides: {}, manualAt: {} };
  }
}

export async function setPreTournamentOverride(tournamentId: TournamentId, show: boolean, atIso: string): Promise<PreTournamentState> {
  const state = await getPreTournamentState();
  state.overrides[tournamentId] = show;
  state.manualAt[tournamentId] = atIso;
  await redis.set(KEY, JSON.stringify(state));
  return state;
}
