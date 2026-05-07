// Debug endpoint for verifying Slash Golf API field names and tournIds.
// Usage (in browser or curl):
//   /api/admin/slash-golf-debug?endpoint=schedule&year=2026
//   /api/admin/slash-golf-debug?endpoint=leaderboard&tournId=R2026033&year=2026
//   /api/admin/slash-golf-debug?endpoint=scorecard&tournId=R2026033&year=2026&playerId=46046
//   /api/admin/slash-golf-debug?endpoint=tournament&tournId=R2026033&year=2026
// Returns the raw Slash Golf API response so you can verify field names and IDs.

export const dynamic = 'force-dynamic';

import { fetchLeaderboard, fetchScorecard, fetchSchedule, fetchTournament } from '@/app/lib/slashgolf';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') ?? 'schedule';
  const tournId = searchParams.get('tournId') ?? '';
  const year = searchParams.get('year') ?? '2026';
  const playerId = searchParams.get('playerId') ?? '';

  try {
    let data: unknown;

    switch (endpoint) {
      case 'schedule':
        data = await fetchSchedule(year);
        break;
      case 'leaderboard':
        if (!tournId) return Response.json({ error: 'tournId required' }, { status: 400 });
        data = await fetchLeaderboard(tournId, year);
        break;
      case 'scorecard':
        if (!tournId || !playerId)
          return Response.json({ error: 'tournId and playerId required' }, { status: 400 });
        data = await fetchScorecard(tournId, year, playerId);
        break;
      case 'tournament':
        if (!tournId) return Response.json({ error: 'tournId required' }, { status: 400 });
        data = await fetchTournament(tournId, year);
        break;
      default:
        return Response.json(
          { error: 'Unknown endpoint. Use: schedule, leaderboard, scorecard, tournament' },
          { status: 400 },
        );
    }

    return Response.json({ endpoint, params: { tournId, year, playerId }, data });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
