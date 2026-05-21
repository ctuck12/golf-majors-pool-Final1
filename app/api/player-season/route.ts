export const dynamic = 'force-dynamic';

const PGA_GRAPHQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37wqyl4';

const QUERY = `
  query PlayerProfileScheduleResults($playerId: ID!, $year: Int, $tourCode: String) {
    playerProfileScheduleResults(playerId: $playerId, year: $year, tourCode: $tourCode) {
      completed {
        tournament {
          name
          startDate
        }
        position
        scoreToPar
        totalStrokesFromCompletedRounds
        earnings
      }
    }
  }
`;

function fmtEarnings(n: unknown): string {
  if (n == null || n === '') return '--';
  const num = typeof n === 'number' ? n : parseFloat(String(n));
  if (isNaN(num) || num === 0) return '--';
  return '$' + Math.round(num).toLocaleString();
}

function fmtDate(s: unknown): string {
  if (!s) return '';
  try {
    return new Date(String(s)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return String(s);
  }
}

export type SeasonResult = {
  tournament: string;
  date: string;
  position: string;
  score: string;
  earnings: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pgaTourId = searchParams.get('pgaTourId') ?? '';

  try {
    const res = await fetch(PGA_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PGA_API_KEY,
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { playerId: pgaTourId, year: 2026, tourCode: 'R' },
      }),
      cache: 'no-store',
    });

    if (!res.ok) return Response.json({ results: null });

    const data = await res.json();
    const completed: Array<{
      tournament?: { name?: string; startDate?: string };
      position?: string;
      scoreToPar?: string;
      earnings?: number;
    }> = data?.data?.playerProfileScheduleResults?.completed ?? [];

    if (completed.length === 0) return Response.json({ results: null });

    const results: SeasonResult[] = completed.map((r) => ({
      tournament: r.tournament?.name ?? '',
      date: fmtDate(r.tournament?.startDate),
      position: r.position ?? '--',
      score: r.scoreToPar ?? '--',
      earnings: fmtEarnings(r.earnings),
    }));

    return Response.json({ results });
  } catch {
    return Response.json({ results: null });
  }
}
