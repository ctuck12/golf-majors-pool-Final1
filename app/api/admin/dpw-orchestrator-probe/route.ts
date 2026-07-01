export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Throwaway probe (round 2): the orchestrator has a generalized "tourCup" family (FedEx Cup is one).
// Discover (a) the TourCode value for the DP World Tour, (b) the TourCupType values, and (c) the
// result-type field names for the cup queries, so we can pull the Race to Dubai standings.
// GET /api/admin/dpw-orchestrator-probe            -> enums + cup query return-type names
// GET /api/admin/dpw-orchestrator-probe?type=Name  -> dump that type's fields

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const headers = () => ({ 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' });

async function gql(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(PGA_GQL, { method: 'POST', headers: headers(), body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(12000) });
    if (!res.ok) return { __httpStatus: res.status };
    return await res.json();
  } catch (e) { return { __error: String(e).slice(0, 160) }; }
}

type TypeRef = { name?: string; kind?: string; ofType?: TypeRef };
const unwrap = (t?: TypeRef): string => (!t ? '?' : t.name ?? unwrap(t.ofType));

export async function GET(request: Request) {
  const typeName = new URL(request.url).searchParams.get('type');

  if (typeName) {
    // Introspect one or more comma-separated types, expanding referenced object types one level deep
    // so a single request reveals the full nested shape (e.g. the player-row type inside the standings).
    const introspectOne = async (n: string) => {
      const d = await gql(`query($n:String!){ __type(name:$n){ name kind enumValues{name} fields{ name type{ name kind ofType{ name kind ofType{ name kind ofType{ name } } } } } } }`, { n }) as {
        data?: { __type?: { name?: string; kind?: string; enumValues?: Array<{ name: string }>; fields?: Array<{ name: string; type?: TypeRef }> } };
      };
      const t = d?.data?.__type;
      if (!t) return { name: n, missing: true };
      return {
        name: t.name, kind: t.kind,
        enumValues: t.enumValues?.map((e) => e.name),
        fields: t.fields?.map((f) => ({ name: f.name, type: unwrap(f.type) })),
      };
    };
    const seed = typeName.split(',').map((s) => s.trim()).filter(Boolean);
    const first = await Promise.all(seed.map(introspectOne));
    // Collect referenced non-scalar type names from the first pass and expand them once.
    const scalars = new Set(['String', 'Int', 'Float', 'Boolean', 'ID', '?']);
    const seen = new Set(seed);
    const nested = new Set<string>();
    for (const t of first) for (const f of (t as { fields?: Array<{ type: string }> }).fields ?? []) {
      if (!scalars.has(f.type) && !seen.has(f.type)) nested.add(f.type);
    }
    const nestedResults = await Promise.all([...nested].slice(0, 20).map(introspectOne));
    return Response.json({ types: [...first, ...nestedResults] });
  }

  const d = await gql(`query {
    schema: __schema { queryType { fields { name type { name kind ofType { name kind ofType { name } } } } } }
    TourCode: __type(name:"TourCode"){ enumValues { name } }
    TourCupType: __type(name:"TourCupType"){ enumValues { name } }
  }`) as {
    data?: {
      schema?: { queryType?: { fields?: Array<{ name: string; type?: TypeRef }> } };
      TourCode?: { enumValues?: Array<{ name: string }> };
      TourCupType?: { enumValues?: Array<{ name: string }> };
    };
  };
  const fields = d?.data?.schema?.queryType?.fields ?? [];
  const want = new Set(['defaultTourCup', 'tourCups', 'tourCup', 'tourCupCombined', 'tourCupSplit']);
  const cupQueryReturnTypes: Record<string, string> = {};
  for (const f of fields) if (want.has(f.name)) cupQueryReturnTypes[f.name] = unwrap(f.type);

  return Response.json({
    tourCodeEnum: d?.data?.TourCode?.enumValues?.map((e) => e.name),
    tourCupTypeEnum: d?.data?.TourCupType?.enumValues?.map((e) => e.name),
    cupQueryReturnTypes,
  });
}
