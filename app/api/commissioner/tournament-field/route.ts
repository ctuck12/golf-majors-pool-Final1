import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, SESSION_COOKIE_NAME } from '../../../lib/pool-store';
import { PLAYER_POOL_WITH_PGA_IDS } from '../../../lib/player-pool';
import { getDynamicPlayers, ensureDynamicPlayers, backfillDynamicPgaIds } from '../../../lib/dynamic-pool-store';
import { getPgaDirectoryResolver } from '../../../lib/pga-directory';
import { canonicalNameKey } from '../../../lib/name-match';

export const dynamic = 'force-dynamic';

const COMMISSIONER_EMAIL = 'ctuck12@gmail.com';
const COMMISSIONER_DISPLAY_NAME = 'Clayton Tucker';

async function requireCommissioner() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);
  if (!session.user) return { error: NextResponse.json({ error: 'Sign in to manage pool settings.' }, { status: 401 }) };
  if (
    session.user.email.trim().toLowerCase() !== COMMISSIONER_EMAIL ||
    session.user.displayName.trim() !== COMMISSIONER_DISPLAY_NAME
  ) {
    return { error: NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 }) };
  }
  return { session };
}

// Parse a pasted/uploaded full field. Each non-empty line is one player. An optional leading rank/number
// column is dropped; the remaining text is the player name. Header rows (no letters) are ignored.
function parseFieldNames(text: string): string[] {
  const names: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.replace(/\t/g, ' ').trim();
    if (!line) continue;
    // Drop a leading rank number ("12  Scottie Scheffler" or "12. Scottie Scheffler" or "12,Scottie...").
    line = line.replace(/^\s*\d+[.)]?\s*[,]?\s*/, '').trim();
    // Drop any trailing comma-separated columns (e.g. "Scottie Scheffler, USA" -> "Scottie Scheffler").
    if (line.includes(',')) line = line.split(',')[0].trim();
    if (!/[a-zA-Z]/.test(line)) continue; // no letters -> not a name (header/rank-only row)
    if (line.length < 2) continue;
    names.push(line);
  }
  return names;
}

const STATIC_CANON = new Set(PLAYER_POOL_WITH_PGA_IDS.map((p) => canonicalNameKey(p.name)));

export async function GET() {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  const dyn = await getDynamicPlayers();
  return NextResponse.json({ registered: dyn.length });
}

export async function POST(request: Request) {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  let body: { text?: string };
  try { body = (await request.json()) as { text?: string }; } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Paste the tournament field first.' }, { status: 400 });

  const names = parseFieldNames(text);
  if (names.length < 5) {
    return NextResponse.json({ error: `Only ${names.length} name(s) read — that doesn't look like a field. Use one player name per line.` }, { status: 400 });
  }

  // Only register names that aren't already in the static pool (those already resolve). The dynamic
  // store dedups by canonical name, so re-uploading the same field is safe (no duplicates, no salaries).
  const toRegister = names.filter((n) => !STATIC_CANON.has(canonicalNameKey(n)));
  // Auto-resolve each new player's PGA Tour id from the tour directory so their PGA/major stats load
  // with no manual step. Also retry any previously-unresolved dynamic players.
  const resolvePgaId = await getPgaDirectoryResolver();
  const { all, added } = await ensureDynamicPlayers(toRegister.map((name) => ({ name, worldRank: null })), resolvePgaId);
  await backfillDynamicPgaIds(resolvePgaId);
  const withPgaId = added.filter((p) => p.pgaTourId > 0).length;

  return NextResponse.json({
    ok: true,
    fieldCount: names.length,
    alreadyInPool: names.length - toRegister.length,
    registered: toRegister.length,
    newlyAdded: added.length,
    newlyAddedWithStats: withPgaId, // of the new adds, how many got a PGA Tour id (full stats)
    addedNames: added.map((p) => p.name).sort(),
    totalDynamic: all.length,
  });
}
