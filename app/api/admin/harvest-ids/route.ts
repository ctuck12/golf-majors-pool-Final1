export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Harvest PGA orchestrator player ids for LIV players (Sergio Garcia, Charl Schwartzel) from a
// past Masters leaderboard, since they're absent from every current player directory.
const GQL = 'https://orchestrator.pgatour.com/graphql';
const KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim();

async function gql(query: string, variables?: Record<string, unknown>): Promise<any> {
  try {
    const res = await fetch(GQL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(12000),
    });
    return await res.json();
  } catch (e) { return { error: String(e).slice(0, 150) }; }
}

export async function GET() {
  // 1) Discover leaderboard-ish query fields + their args.
  const intro = await gql(`{ __type(name:"Query"){ fields { name args { name type { name ofType { name } } } } } }`);
  const lbFields = (intro?.data?.__type?.fields ?? [])
    .filter((f: any) => /leaderboard|tournamentPastResults|fieldStrokePlay|tournament/i.test(f.name))
    .map((f: any) => ({ name: f.name, args: (f.args ?? []).map((a: any) => `${a.name}:${a.type?.name ?? a.type?.ofType?.name}`) }));

  // 2) Try to pull a past Masters leaderboard (Masters = tournament 014) across a few years/shapes.
  const targets = ['sergio garcia', 'charl schwartzel'];
  const attempts: Record<string, unknown> = {};
  const tryIds = ['R2022014', 'R2021014', 'R2019014', '2022014', '014'];
  for (const tid of tryIds) {
    const j = await gql(`query L($id: ID!){ leaderboardV2(id:$id){ players { ... on PlayerRowV2 { id player { id displayName } } } } }`, { id: tid });
    const players = j?.data?.leaderboardV2?.players ?? [];
    if (players.length) {
      const hits: Record<string, string> = {};
      for (const p of players) {
        const nm = norm(p?.player?.displayName ?? '');
        if (targets.includes(nm)) hits[nm] = p?.player?.id;
      }
      attempts[tid] = { count: players.length, hits };
      if (Object.keys(hits).length) break;
    } else {
      attempts[tid] = { error: j?.errors?.[0]?.message?.slice(0, 100) ?? 'no players', count: 0 };
    }
  }

  return Response.json({ lbFields, attempts });
}
