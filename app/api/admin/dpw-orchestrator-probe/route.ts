export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Throwaway probe (round 3): call the REAL cup query for the DP World Tour (tourCode E) and confirm it
// returns the Race to Dubai standings (title + ranked player list). One query.
// GET /api/admin/dpw-orchestrator-probe?tour=E&year=2026

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
  const tour = sp.get('tour') ?? 'E';
  const year = parseInt(sp.get('year') ?? '2026', 10);

  const query = `
    query DpwCup($tour: TourCode!, $year: Int!) {
      defaultTourCup(tour: $tour, year: $year) {
        id
        title
        rankings {
          __typename
          ... on CupRankingPlayer { position id name playerCountry total }
        }
        standings {
          __typename
          ... on StandardCupRanking {
            rankings { position id name playerCountry total }
          }
        }
      }
    }
  `;
  const resp = await gql(query, { tour, year }) as {
    data?: { defaultTourCup?: {
      id?: string; title?: string;
      rankings?: Array<{ __typename?: string; position?: string; name?: string; playerCountry?: string; total?: string }>;
      standings?: { __typename?: string; rankings?: Array<{ position?: string; name?: string; playerCountry?: string; total?: string }> };
    } };
    errors?: unknown;
  };

  const cup = resp?.data?.defaultTourCup;
  const rk = (cup?.rankings ?? []).filter((r) => r.__typename === 'CupRankingPlayer');
  const stRk = cup?.standings?.rankings ?? [];
  const chosen = rk.length ? rk : stRk;

  return Response.json({
    tour, year,
    errors: resp?.errors ?? null,
    cupId: cup?.id ?? null,
    title: cup?.title ?? null,
    source: rk.length ? 'rankings' : (stRk.length ? 'standings' : 'none'),
    count: chosen.length,
    top15: chosen.slice(0, 15).map((r) => ({ position: r.position, name: r.name, country: r.playerCountry, total: r.total })),
  });
}
