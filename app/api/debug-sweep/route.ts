export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import redis from '@/app/lib/redis';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';

// One-shot roster sweep: for every pool player, check whether they're present (by normalized name)
// in each warm stat-lb leaderboard — which is what determines whether their card shows that stat's
// rank/value. Also reports duplicate normalized names within each leaderboard (dedupe targets).
// Pure Redis reads, so it's fast and safe to run on demand.

const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().trim();

// The 12 stats shown on the player card (6 course + 6 strokes gained)
const CARD_STATS = [
  'drivingDistance', 'drivingAccuracy', 'gir', 'scrambling', 'sandSaves', 'puttAverage',
  'sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting',
];

export async function GET() {
  // Load all leaderboards once
  const raws = await Promise.all(CARD_STATS.map(k => redis.get(`stat-lb:v28:${k}`).catch(() => null)));

  const nameSets: Record<string, Set<string>> = {};
  const coldStats: string[] = [];
  const duplicatesByStat: Record<string, string[]> = {};

  for (let i = 0; i < CARD_STATS.length; i++) {
    const key = CARD_STATS[i];
    const raw = raws[i];
    if (!raw) { coldStats.push(key); nameSets[key] = new Set(); continue; }
    try {
      const parsed = JSON.parse(raw);
      const entries: Array<{ name: string }> = parsed.entries ?? parsed;
      const seen = new Map<string, string[]>(); // normalized -> original names
      for (const e of entries) {
        const n = normName(e.name);
        if (!seen.has(n)) seen.set(n, []);
        seen.get(n)!.push(e.name);
      }
      nameSets[key] = new Set(seen.keys());
      const dups = [...seen.entries()].filter(([, names]) => names.length > 1).map(([, names]) => names.join(' / '));
      if (dups.length > 0) duplicatesByStat[key] = dups;
    } catch { coldStats.push(key); nameSets[key] = new Set(); }
  }

  // Per-player membership
  const missingAll: string[] = [];          // not found in ANY leaderboard (no-PGA-data or name mismatch)
  const missingSome: Array<{ name: string; pgaTourId: number; missing: string[] }> = [];
  let fullyCovered = 0;

  for (const p of PLAYER_POOL_WITH_PGA_IDS) {
    const target = normName(p.name);
    const missing = CARD_STATS.filter(k => !coldStats.includes(k) && !nameSets[k].has(target));
    if (missing.length === CARD_STATS.length) {
      missingAll.push(p.name);
    } else if (missing.length > 0) {
      missingSome.push({ name: p.name, pgaTourId: p.pgaTourId, missing });
    } else {
      fullyCovered++;
    }
  }

  return Response.json({
    poolSize: PLAYER_POOL_WITH_PGA_IDS.length,
    coldStats,
    summary: {
      fullyCovered,
      missingSomeCount: missingSome.length,
      missingAllCount: missingAll.length,
    },
    missingAll,
    missingSome: missingSome.sort((a, b) => a.missing.length - b.missing.length),
    duplicatesByStat,
  });
}
