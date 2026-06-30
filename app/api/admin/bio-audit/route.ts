export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min — iterates the full active pool through /api/player-bio

import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';

// The six personal-bio fields shown in the top block of the player Bio tab:
// DOB, Birthplace, Height, Weight, Swing, College.
const FIELDS = ['dob', 'birthPlace', 'height', 'weight', 'swing', 'college'] as const;
type Field = (typeof FIELDS)[number];

const BATCH_SIZE = 8;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const players = PLAYER_POOL_WITH_PGA_IDS;

  type Row = { name: string; blanks: Field[]; collegeDash: boolean } | { name: string; error: string };
  const rows: Row[] = [];

  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const batch = players.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (p) => {
        const q = new URLSearchParams({ name: p.name });
        if (p.pgaTourId) q.set('pgaTourId', String(p.pgaTourId));
        try {
          const res = await fetch(`${origin}/api/player-bio?${q.toString()}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(45000),
          });
          if (!res.ok) { rows.push({ name: p.name, error: `HTTP ${res.status}` }); return; }
          const json = await res.json() as { bio?: Record<string, unknown> | null };
          const bio = json.bio;
          if (!bio) { rows.push({ name: p.name, error: 'no bio' }); return; }
          const blanks = FIELDS.filter((f) => bio[f] == null);
          // College shows a bare "—" when it's null AND not confirmed-absent (the
          // "*Did not attend college" note only shows when collegeConfirmedAbsent is true).
          const collegeDash = bio.college == null && !bio.collegeConfirmedAbsent;
          rows.push({ name: p.name, blanks, collegeDash });
        } catch (e) {
          rows.push({ name: p.name, error: String(e).slice(0, 80) });
        }
      }),
    );
  }

  const resolved = rows.filter((r): r is { name: string; blanks: Field[]; collegeDash: boolean } => 'blanks' in r);
  const errors = rows.filter((r): r is { name: string; error: string } => 'error' in r);

  // Players whose College field renders a bare "—" (neither a college nor the
  // "*Did not attend college" note). These either attended (need a college value) or
  // didn't (need noCollege: true) in the override map.
  const collegeDashPlayers = resolved.filter((r) => r.collegeDash).map((r) => r.name);

  const fieldCounts = Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<Field, number>;
  for (const r of resolved) for (const f of r.blanks) fieldCounts[f]++;

  const missingAtLeastOne = resolved.filter((r) => r.blanks.length > 0);
  const missingAllSix = resolved.filter((r) => r.blanks.length === FIELDS.length);
  // College is frequently legitimately absent (player never attended), so also report the count
  // when college is ignored — i.e. missing DOB/Birthplace/Height/Weight/Swing.
  const missingAtLeastOneExclCollege = resolved.filter((r) =>
    r.blanks.some((b) => b !== 'college'),
  );

  return Response.json({
    activePool: players.length,
    biosResolved: resolved.length,
    errors: errors.length,
    summary: {
      missingAtLeastOneOfSix: missingAtLeastOne.length,
      missingAtLeastOneExcludingCollege: missingAtLeastOneExclCollege.length,
      missingAllSix: missingAllSix.length,
      complete: resolved.length - missingAtLeastOne.length,
    },
    perFieldBlankCounts: fieldCounts,
    collegeDashCount: collegeDashPlayers.length,
    collegeDashPlayers,
    playersMissingAtLeastOne: missingAtLeastOne
      .sort((a, b) => b.blanks.length - a.blanks.length)
      .map((r) => ({ name: r.name, missing: r.blanks })),
    errorPlayers: errors.map((r) => ({ name: r.name, error: r.error })),
  });
}
