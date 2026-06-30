export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import { getEspnId } from '@/app/lib/espn-player-season';

const SITE = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/athletes';
const BATCH = 8;

// Raw ESPN keys we care about for the six bio fields
const PROBE_KEYS = ['dateOfBirth', 'birthDate', 'dob', 'displayDOB', 'birthPlace', 'height',
  'displayHeight', 'weight', 'displayWeight', 'hand', 'handedness', 'college', 'collegeName'];

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch { return null; }
}

function presentKeys(obj: Record<string, unknown> | null | undefined): string[] {
  if (!obj) return [];
  return PROBE_KEYS.filter((k) => obj[k] != null && obj[k] !== '' &&
    !(typeof obj[k] === 'object' && obj[k] !== null && '$ref' in (obj[k] as object) && Object.keys(obj[k] as object).length === 1));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sampleLimit = parseInt(searchParams.get('sample') ?? '12');
  const players = PLAYER_POOL_WITH_PGA_IDS;

  type Diag = {
    name: string; pgaTourId: number; espnId: string | null;
    siteKeys: string[]; coreKeys: string[]; athleteObjKeys?: string[];
    rawDob?: unknown;
  };
  const diags: Diag[] = [];

  for (let i = 0; i < players.length; i += BATCH) {
    const batch = players.slice(i, i + BATCH);
    await Promise.all(batch.map(async (p) => {
      const espnId = await getEspnId(p.name).catch(() => null);
      const d: Diag = { name: p.name, pgaTourId: p.pgaTourId, espnId, siteKeys: [], coreKeys: [] };
      if (espnId) {
        const [site, core] = await Promise.all([getJson(`${SITE}/${espnId}`), getJson(`${CORE}/${espnId}`)]);
        const siteA = (site?.athlete ?? site) as Record<string, unknown> | undefined;
        d.siteKeys = presentKeys(siteA);
        d.coreKeys = presentKeys(core ?? undefined);
        d.rawDob = (siteA?.dateOfBirth ?? siteA?.birthDate ?? core?.dateOfBirth ?? core?.birthDate ?? null);
        if (diags.filter((x) => x.athleteObjKeys).length < sampleLimit) {
          d.athleteObjKeys = siteA ? Object.keys(siteA).slice(0, 40) : [];
        }
      }
      diags.push(d);
    }));
  }

  const resolved = diags.filter((d) => d.espnId);
  const failed = diags.filter((d) => !d.espnId);

  // How often each raw key is present among resolved players (site OR core)
  const rawPresence: Record<string, number> = {};
  for (const k of PROBE_KEYS) {
    rawPresence[k] = resolved.filter((d) => d.siteKeys.includes(k) || d.coreKeys.includes(k)).length;
  }

  // Sample of resolved players that have NO dob-related key in either endpoint
  const noDob = resolved.filter((d) =>
    !d.siteKeys.some((k) => ['dateOfBirth', 'birthDate', 'dob', 'displayDOB'].includes(k)) &&
    !d.coreKeys.some((k) => ['dateOfBirth', 'birthDate', 'dob', 'displayDOB'].includes(k)));

  return Response.json({
    activePool: players.length,
    espnIdResolved: resolved.length,
    espnIdFailed: failed.length,
    espnIdFailedNames: failed.map((d) => ({ name: d.name, pgaTourId: d.pgaTourId })),
    rawKeyPresenceAmongResolved: rawPresence,
    resolvedButNoDobCount: noDob.length,
    resolvedButNoDobSample: noDob.slice(0, 20).map((d) => ({ name: d.name, espnId: d.espnId, siteKeys: d.siteKeys, coreKeys: d.coreKeys })),
    athleteObjKeySamples: diags.filter((d) => d.athleteObjKeys).slice(0, sampleLimit).map((d) => ({ name: d.name, espnId: d.espnId, keys: d.athleteObjKeys })),
  });
}
