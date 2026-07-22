import redis from './redis';
import type { TournamentId } from './pool-store';

// Commissioner-set "show the next-season pre-tournament card" overrides. When true for a
// tournament, its Standings tab flips from its most recent completed results to its upcoming
// (UP NEXT) pre-tournament preview. This only controls the pre-event waiting view: the automatic
// start-time logic still turns the tab over to live standings on its own once the event tees off.

const KEY = 'pool-pre-tournament-view:v1';

export type PreTournamentOverrides = Partial<Record<TournamentId, boolean>>;

export async function getPreTournamentOverrides(): Promise<PreTournamentOverrides> {
  try {
    const raw = await redis.get(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw as string) as PreTournamentOverrides;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function setPreTournamentOverride(tournamentId: TournamentId, show: boolean): Promise<PreTournamentOverrides> {
  const current = await getPreTournamentOverrides();
  if (show) {
    current[tournamentId] = true;
  } else {
    delete current[tournamentId];
  }
  await redis.set(KEY, JSON.stringify(current));
  return current;
}
