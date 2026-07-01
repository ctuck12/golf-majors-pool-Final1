export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Throwaway probe: ask the PGA Tour orchestrator (same GraphQL API the app already uses) whether it
// exposes a DP World Tour "Race to Dubai" standings/points list. Introspection + enum dump only —
// a couple of single queries, no loops. GET /api/admin/dpw-orchestrator-probe
// Add ?enum=TourCode to dump a specific enum's values.

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

function headers() {
  return { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' };
}

async function gql(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(PGA_GQL, { method: 'POST', headers: headers(), body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(12000) });
    if (!res.ok) return { __httpStatus: res.status };
    return await res.json();
  } catch (e) { return { __error: String(e).slice(0, 160) }; }
}

export async function GET(request: Request) {
  const enumName = new URL(request.url).searchParams.get('enum');
  const out: Record<string, unknown> = {};

  // 1) All root query field names — filter for anything standings/cup/rank/race/points/eligibility related.
  const schema = await gql(`query { __schema { queryType { fields { name args { name type { name kind ofType { name } } } } } } }`) as {
    data?: { __schema?: { queryType?: { fields?: Array<{ name: string; args?: Array<{ name: string; type?: { name?: string; kind?: string; ofType?: { name?: string } } }> }> } } };
  };
  const fields = schema?.data?.__schema?.queryType?.fields ?? [];
  const rx = /stand|cup|rank|race|dubai|points|eligib|order.?of.?merit|money/i;
  out.matchingQueries = fields.filter((f) => rx.test(f.name)).map((f) => ({
    name: f.name,
    args: (f.args ?? []).map((a) => ({ name: a.name, type: a.type?.name ?? a.type?.ofType?.name ?? a.type?.kind })),
  }));
  out.totalQueryFields = fields.length;
  if (!enumName) out.allQueryNames = fields.map((f) => f.name);

  // 2) Optionally dump an enum's values (e.g. TourCode) to find the DP World Tour code.
  if (enumName) {
    const en = await gql(`query($n:String!){ __type(name:$n){ name enumValues { name } inputFields { name } } }`, { n: enumName }) as {
      data?: { __type?: { name?: string; enumValues?: Array<{ name: string }>; inputFields?: Array<{ name: string }> } };
    };
    out.enum = en?.data?.__type;
  }

  return Response.json(out);
}
