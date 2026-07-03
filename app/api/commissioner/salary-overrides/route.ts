import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, SESSION_COOKIE_NAME } from '../../../lib/pool-store';
import {
  parseSalaryPaste,
  getManualSalaries,
  saveManualSalaries,
  clearManualSalaries,
} from '../../../lib/salary-overrides-store';
import { getDynamicPlayers, ensureDynamicPlayers } from '../../../lib/dynamic-pool-store';
import { getEspnId } from '../../../lib/espn-player-season';
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

export async function GET() {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  const current = await getManualSalaries();
  return NextResponse.json({ active: !!current, count: current?.count ?? 0, updatedAt: current?.updatedAt ?? null });
}

export async function POST(request: Request) {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  let body: { text?: string };
  try { body = (await request.json()) as { text?: string }; } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Paste the salary list first.' }, { status: 400 });

  // Match against the static pool AND any players auto-added on prior uploads, so re-uploads reuse
  // their existing dynamic ID instead of creating duplicates.
  const dynamicExisting = await getDynamicPlayers();
  const parsed = parseSalaryPaste(text, dynamicExisting.map((d) => ({ id: d.id, name: d.name })));
  if (parsed.matched.length < 5) {
    return NextResponse.json({
      error: `Only ${parsed.matched.length} player(s) matched the pool — that doesn't look right. Each line should be "Player Name  Salary", e.g. "Scottie Scheffler 11900".`,
      unmatched: parsed.unmatched.slice(0, 15),
      skipped: parsed.skipped.slice(0, 10),
    }, { status: 400 });
  }

  // Auto-add any still-unmatched names to the dynamic pool so they appear on the pick sheet with the
  // uploaded salary/rank. Resolve each one's ESPN id by name (best-effort) for their headshot.
  let autoAddedCount = 0;
  if (parsed.unmatched.length > 0) {
    const withEspn = await Promise.all(
      parsed.unmatched.map(async (u) => ({
        name: u.name,
        worldRank: u.worldRank,
        espnId: (await getEspnId(u.name).catch(() => null)) ?? undefined,
      })),
    );
    const { idByCanon } = await ensureDynamicPlayers(withEspn);
    for (const u of parsed.unmatched) {
      const id = idByCanon[canonicalNameKey(u.name)];
      if (id != null && !(id in parsed.map)) {
        parsed.map[id] = { salary: u.salary, worldRank: u.worldRank };
        autoAddedCount++;
      }
    }
  }

  const saved = await saveManualSalaries(parsed.map, new Date().toISOString());
  const withRank = parsed.matched.filter((m) => m.worldRank != null).length;
  return NextResponse.json({
    ok: true,
    count: saved.count,
    updatedAt: saved.updatedAt,
    matchedCount: parsed.matched.length,
    worldRankCount: withRank, // how many rows also carried a world rank
    autoAddedCount, // names not previously in the pool that were auto-added so they now appear
    autoAdded: parsed.unmatched.slice(0, 25).map((u) => u.name),
    unmatchedCount: 0, // all previously-unmatched names are now auto-added to the pool
    unmatched: [],
    skipped: parsed.skipped.slice(0, 10),
    preview: parsed.matched.slice().sort((a, b) => b.salary - a.salary),
  });
}

export async function DELETE() {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  await clearManualSalaries();
  return NextResponse.json({ ok: true, active: false });
}
