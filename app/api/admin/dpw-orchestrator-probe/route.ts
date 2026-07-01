export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Throwaway probe (round 5): pull the actual "Race to Dubai Rankings" cup (id R-2700-2026, on tour R)
// and confirm it's the full ranked standings. GET /api/admin/dpw-orchestrator-probe?id=R-2700-2026

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

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const id = sp.get('id') ?? 'R-2700-2026';
  const type = sp.get('type') ?? 'OFFICIAL';

  const query = `
    query Cup($id: ID!, $type: TourCupType) {
      tourCup(id: $id, type: $type) {
        id
        title
        rankings {
          __typename
          ... on CupRankingPlayer { position id name playerCountry total }
        }
        standings {
          __typename
          ... on StandardCupRanking { rankings { position id name playerCountry total } }
        }
      }
    }
  `;
  const resp = await gql(query, { id, type }) as {
    data?: { tourCup?: {
      id?: string; title?: string;
      rankings?: Array<{ __typename?: string; position?: string; name?: string; playerCountry?: string; total?: string }>;
      standings?: { __typename?: string; rankings?: Array<{ position?: string; name?: string; playerCountry?: string; total?: string }> };
    } };
    errors?: Array<{ message?: string }>;
  };

  const cup = resp?.data?.tourCup;
  const rk = (cup?.rankings ?? []).filter((r) => r.__typename === 'CupRankingPlayer');
  const stRk = cup?.standings?.rankings ?? [];
  const chosen = rk.length ? rk : stRk;

  // Also surface where key players land, to sanity-check against the known manual list.
  const findRank = (needle: string) => {
    const hit = chosen.find((r) => (r.name ?? '').toLowerCase().includes(needle));
    return hit ? { name: hit.name, position: hit.position } : null;
  };

  return Response.json({
    id, type,
    errors: resp?.errors?.map((e) => e.message) ?? null,
    title: cup?.title ?? null,
    source: rk.length ? 'rankings' : (stRk.length ? 'standings' : 'none'),
    count: chosen.length,
    top10: chosen.slice(0, 10).map((r) => ({ position: r.position, name: r.name, total: r.total })),
    spotChecks: { mcilroy: findRank('mcilroy'), fitzpatrick: findRank('fitzpatrick'), rahm: findRank('rahm'), fleetwood: findRank('fleetwood') },
  });
}
