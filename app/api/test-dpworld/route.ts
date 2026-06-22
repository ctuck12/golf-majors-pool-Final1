export const dynamic = 'force-dynamic';

const SLASH_BASE = 'https://live-golf-data.p.rapidapi.com';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';
const AARON_RAI_ESPN_ID = '10906';

function slashHeaders() {
  const key = process.env.SLASH_GOLF_API_KEY ?? '';
  return {
    'x-rapidapi-host': 'live-golf-data.p.rapidapi.com',
    'x-rapidapi-key': key,
  };
}

async function probe(label: string, url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store', ...init });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 500); }
    return { label, status: res.status, ok: res.ok, url, data };
  } catch (e) {
    return { label, url, error: String(e) };
  }
}

export async function GET() {
  const results = await Promise.allSettled([

    // SlashGolf: try common endpoint patterns for standings/rankings
    probe('slash_rankings_eur', `${SLASH_BASE}/rankings?tour=eur&year=2026`, { headers: slashHeaders() }),
    probe('slash_rankings_euro', `${SLASH_BASE}/rankings?tour=euro&year=2026`, { headers: slashHeaders() }),
    probe('slash_standings_eur', `${SLASH_BASE}/standings?tour=eur&year=2026`, { headers: slashHeaders() }),
    probe('slash_order_of_merit', `${SLASH_BASE}/order-of-merit?year=2026`, { headers: slashHeaders() }),
    probe('slash_race_to_dubai', `${SLASH_BASE}/race-to-dubai?year=2026`, { headers: slashHeaders() }),
    probe('slash_schedule_eur', `${SLASH_BASE}/schedule?tour=eur&year=2026`, { headers: slashHeaders() }),
    probe('slash_schedule_euro', `${SLASH_BASE}/schedule?tour=euro&year=2026`, { headers: slashHeaders() }),

    // ESPN EUR athlete overview — may contain Race to Dubai standing
    probe('espn_web_eur_overview',
      `https://site.web.api.espn.com/apis/common/v3/sports/golf/eur/athletes/${AARON_RAI_ESPN_ID}/overview`
    ),
    probe('espn_web_eur_overview_us',
      `https://site.web.api.espn.com/apis/common/v3/sports/golf/eur/athletes/${AARON_RAI_ESPN_ID}/overview?region=us&lang=en`
    ),

    // ESPN EUR season athlete (might have order of merit points)
    probe('espn_core_eur_season_athlete',
      `${ESPN_CORE}/eur/seasons/2026/athletes/${AARON_RAI_ESPN_ID}`
    ),

    // ESPN EUR athlete statistics
    probe('espn_core_eur_athlete_stats_no_season',
      `${ESPN_CORE}/eur/athletes/${AARON_RAI_ESPN_ID}/statistics`
    ),

    // ESPN EUR season type 2 standings with different limit
    probe('espn_core_eur_standings_limit200',
      `${ESPN_CORE}/eur/seasons/2026/types/2/standings?limit=200`
    ),

    // OWGR.com API
    probe('owgr_api_rankings', 'https://www.owgr.com/api/v2/rankings/world/2026?limit=10'),
    probe('owgr_api_v1', 'https://www.owgr.com/api/v1/rankings?limit=10'),

    // DP World Tour CDN
    probe('dpworldtour_cdn_v2', 'https://cdn.europeantour.com/api/stats/rankings?season=2026&type=rtd&page=1&pageSize=10'),
    probe('dpworldtour_cdn_v3', 'https://cdn.europeantour.com/api/v3/rankings?season=2026&type=rtd&pageSize=10'),

    // Golf stats RapidAPI
    probe('golf_leaderboard_rankings', 'https://golf-leaderboard-data.p.rapidapi.com/rankings/race-to-dubai', { headers: slashHeaders() }),

  ]);

  const output = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { error: String(r.reason) }
  );

  return Response.json({ results: output }, { headers: { 'Cache-Control': 'no-store' } });
}
