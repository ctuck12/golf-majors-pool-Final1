export const dynamic = 'force-dynamic';

const PGA_GRAPHQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37wqyl4';

const QUERY = `
  query FedExCupStandings($year: Int, $tourCode: String) {
    fedExCupStandings(year: $year, tourCode: $tourCode) {
      standings {
        rank
        player {
          id
          displayName
        }
      }
    }
  }
`;

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z ]/g, '').trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const pgaTourId = searchParams.get('pgaTourId') ?? '';

  try {
    const res = await fetch(PGA_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PGA_API_KEY,
      },
      body: JSON.stringify({ query: QUERY, variables: { year: 2026, tourCode: 'R' } }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return Response.json({ rank: null });

    const data = await res.json();
    const standings: Array<{ rank: number; player: { id: string; displayName: string } }> =
      data?.data?.fedExCupStandings?.standings ?? [];

    const entry = standings.find(
      (s) => s.player.id === pgaTourId || norm(s.player.displayName) === norm(name),
    );

    return Response.json({ rank: entry?.rank ?? null });
  } catch {
    return Response.json({ rank: null });
  }
}
