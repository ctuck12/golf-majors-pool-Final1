export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Throwaway probe: verify the PGA leaderboardV2 field shape (player ids + cut status) so we can
// build a FULL-FIELD scrambling leaderboard (statDetails EVENT_ONLY only returns made-cut players).
// GET /api/admin/scramble-probe?id=R2026033

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

function headers() {
  return { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? 'R2026033';

  const out: Record<string, unknown> = { id };

  // Introspect PlayerRowV2 to learn its real field names
  const introspect = `query { __type(name: "PlayerRowV2") { fields { name type { name kind ofType { name kind } } } } }`;
  try {
    const res = await fetch(PGA_GQL, { method: 'POST', headers: headers(), body: JSON.stringify({ query: introspect }), signal: AbortSignal.timeout(15000) });
    const json = await res.json();
    out.playerRowV2Fields = json?.data?.__type?.fields?.map((f: { name: string; type: { name?: string; kind?: string; ofType?: { name?: string; kind?: string } } }) => ({ name: f.name, type: f.type?.name ?? f.type?.ofType?.name ?? f.type?.kind }));
    if (json.errors) out.introspectErrors = json.errors;
  } catch (e) { out.introspectError = String(e); }

  return Response.json(out);
}
