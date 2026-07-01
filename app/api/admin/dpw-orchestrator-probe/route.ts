export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Throwaway probe (round 4): discover where the DP World Tour (tourCode E) cup data lives —
// list tourCups across years, and sanity-check defaultTourCup on the PGA tour (R). Separate calls so
// a null on one doesn't blank the others. GET /api/admin/dpw-orchestrator-probe

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

const tourCupsQ = `query($tour: TourCode!, $year: Int!){ tourCups(tour:$tour, year:$year){ id title } }`;
const defaultQ = `query($tour: TourCode!, $year: Int!){ defaultTourCup(tour:$tour, year:$year){ id title } }`;

function summarize(r: unknown): unknown {
  const rr = r as { data?: Record<string, unknown>; errors?: Array<{ message?: string }> };
  return { data: rr?.data ?? null, error: rr?.errors?.map((e) => e.message).slice(0, 2) ?? null };
}

export async function GET() {
  const [cupsE2026, cupsE2025, cupsE2024, defR2026, defE2025, cupsR2026] = await Promise.all([
    gql(tourCupsQ, { tour: 'E', year: 2026 }),
    gql(tourCupsQ, { tour: 'E', year: 2025 }),
    gql(tourCupsQ, { tour: 'E', year: 2024 }),
    gql(defaultQ, { tour: 'R', year: 2026 }),
    gql(defaultQ, { tour: 'E', year: 2025 }),
    gql(tourCupsQ, { tour: 'R', year: 2026 }),
  ]);

  return Response.json({
    tourCups_E_2026: summarize(cupsE2026),
    tourCups_E_2025: summarize(cupsE2025),
    tourCups_E_2024: summarize(cupsE2024),
    tourCups_R_2026: summarize(cupsR2026),
    defaultTourCup_R_2026: summarize(defR2026),
    defaultTourCup_E_2025: summarize(defE2025),
  });
}
