export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

// Test player: Scottie Scheffler
const TEST_PLAYER_NAME = 'Scottie Scheffler';
const TEST_PGA_TOUR_ID = '46046';
const TEST_ESPN_ID = '9478';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

const ESPN_EVENT_MASTERS = '401811941';
const ESPN_EVENT_USOPEN = '401811952';

function gqlHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': PGA_API_KEY,
    'Referer': 'https://www.pgatour.com/',
    'Origin': 'https://www.pgatour.com',
  };
}

async function tryGql(label: string, query: string, variables: Record<string, unknown>) {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text; }
    return { label, status: res.status, ok: res.ok, data: json };
  } catch (e) {
    return { label, error: String(e) };
  }
}

async function tryEspn(label: string, url: string) {
  try {
    const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) } as RequestInit);
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text; }
    return { label, status: res.status, ok: res.ok, url, data: json };
  } catch (e) {
    return { label, url, error: String(e) };
  }
}

export async function GET() {
  const results = await Promise.allSettled([

    // ── ESPN Core: direct competition stats (no recency window) ───────────────

    // 1. Masters stats for Scheffler via direct ESPN Core competitor endpoint
    tryEspn('espn_core_masters_competitor_stats',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_MASTERS}/competitions/${ESPN_EVENT_MASTERS}/competitors/${TEST_ESPN_ID}/statistics/0`
    ),

    // 2. US Open stats for Scheffler via direct ESPN Core competitor endpoint
    tryEspn('espn_core_usopen_competitor_stats',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_USOPEN}/competitions/${ESPN_EVENT_USOPEN}/competitors/${TEST_ESPN_ID}/statistics/0`
    ),

    // 3. Masters linescores for Scheffler
    tryEspn('espn_core_masters_linescores',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_MASTERS}/competitions/${ESPN_EVENT_MASTERS}/competitors/${TEST_ESPN_ID}/linescores`
    ),

    // 4. US Open linescores for Scheffler
    tryEspn('espn_core_usopen_linescores',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_USOPEN}/competitions/${ESPN_EVENT_USOPEN}/competitors/${TEST_ESPN_ID}/linescores`
    ),

    // 5. Masters competitors list — verify competitor ID format (is it the ESPN athlete ID?)
    tryEspn('espn_core_masters_competitors_list',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_MASTERS}/competitions/${ESPN_EVENT_MASTERS}/competitors?limit=5`
    ),

    // 6. Masters competition info
    tryEspn('espn_core_masters_competition',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_MASTERS}/competitions/${ESPN_EVENT_MASTERS}`
    ),

    // ── PGA Tour GQL: tournament-specific stats ───────────────────────────────

    // 7. Introspect the Query type — find playerProfileStats return type
    tryGql('pga_gql_introspect_query_type', `
      {
        __type(name: "Query") {
          fields {
            name
            type { name kind ofType { name kind ofType { name kind } } }
          }
        }
      }
    `, {}),

    // 8. Introspect PlayerProfileStatItem — find actual field names
    tryGql('pga_gql_introspect_statItem', `
      {
        __type(name: "PlayerProfileStatItem") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 9. Introspect PlayerProfileStats (wrapper type, has stats sub-field)
    tryGql('pga_gql_introspect_statWrapper', `
      {
        __type(name: "PlayerProfileStats") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 10. playerProfileStats with stats{} wrapper — minimal __typename only
    tryGql('pga_gql_stats_typename_only', `
      query StatsTypename($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats {
            __typename
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 11. playerProfileStats with stats{} wrapper — probe set A: statId, statTitle, statValue, rank
    tryGql('pga_gql_stats_probe_A', `
      query StatsProbeA($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats {
            statId
            statTitle
            statValue
            rank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 12. playerProfileStats with stats{} wrapper — probe set B: id, title, value, rank
    tryGql('pga_gql_stats_probe_B', `
      query StatsProbeB($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats {
            id
            title
            value
            rank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 13. playerProfileStats with stats{} wrapper — probe set C: statId, name, displayValue, statRank
    tryGql('pga_gql_stats_probe_C', `
      query StatsProbeC($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats {
            statId
            name
            displayValue
            statRank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 14. playerProfileStats without stats{} wrapper — direct list probe
    tryGql('pga_gql_stats_direct_probe', `
      query StatsDirectProbe($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          __typename
          statId
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 15. ESPN Core: season athlete statistics
    tryEspn('espn_core_season_stats',
      `${ESPN_CORE}/pga/seasons/2026/athletes/${TEST_ESPN_ID}/statistics`
    ),

    // ── US Open stats alternatives ────────────────────────────────────────────

    // 16. PGA Tour GQL introspect Query type — find tournament-related fields
    tryGql('pga_gql_introspect_all_queries', `
      {
        __type(name: "Query") {
          fields {
            name
            args { name type { name kind ofType { name kind } } }
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 17. PGA Tour GQL: playerEventStats — try common tournament stats query patterns
    tryGql('pga_gql_playerEventStats', `
      query PlayerEventStats($playerId: ID!, $eventId: ID!) {
        playerEventStats(playerId: $playerId, eventId: $eventId) {
          __typename
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID, eventId: '2026034' }),

    // 18. PGA Tour GQL: tournamentStats
    tryGql('pga_gql_tournamentStats', `
      query TournamentStats($tournamentId: ID!) {
        tournamentStats(tournamentId: $tournamentId) {
          __typename
        }
      }
    `, { tournamentId: '2026034' }),

    // 19. ESPN Core: athlete event stats via season log
    tryEspn('espn_core_usopen_athlete_log',
      `${ESPN_CORE}/pga/seasons/2026/athletes/${TEST_ESPN_ID}/eventlog`
    ),

    // 20. ESPN athlete overview — check summaryStatistics and nextTournament sections
    tryEspn('espn_overview_scheffler',
      `https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes/${TEST_ESPN_ID}/overview`
    ),

    // 21. USGA scoring API probe
    tryEspn('usga_player_stats',
      `https://www.usopen.com/api/v1/2026/player-stats/${TEST_ESPN_ID}.json`
    ),

    // 22. PGA Tour player scorecards for US Open (tournament ID R2026034)
    tryGql('pga_gql_playerScorecard', `
      query PlayerScorecard($playerId: ID!, $tournamentId: ID!) {
        playerScorecard(playerId: $playerId, tournamentId: $tournamentId) {
          __typename
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID, tournamentId: 'R2026034' }),

    // 23. ESPN Core: US Open event stats categories
    tryEspn('espn_core_usopen_event_stats',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_USOPEN}/statistics`
    ),

    // 24. ESPN Core: US Open competitor stats group 1 (alternative to /0)
    tryEspn('espn_core_usopen_stats_1',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_USOPEN}/competitions/${ESPN_EVENT_USOPEN}/competitors/${TEST_ESPN_ID}/statistics/1`
    ),

    // 25. ESPN Core: US Open competitor stats group 2
    tryEspn('espn_core_usopen_stats_2',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_USOPEN}/competitions/${ESPN_EVENT_USOPEN}/competitors/${TEST_ESPN_ID}/statistics/2`
    ),

    // 26. ESPN Core: competition-level statistics (all stat categories for event)
    tryEspn('espn_core_usopen_competition_stats',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_USOPEN}/competitions/${ESPN_EVENT_USOPEN}/statistics`
    ),

    // 27. DataGolf free endpoint — historical event-level summary for US Open
    tryEspn('datagolf_usopen_event',
      `https://feeds.datagolf.com/historical-raw-data/event-level-summary?tour=pga&event_id=026&year=2026&file_format=json&key=free`
    ),

    // 28. DataGolf free ranking endpoint (test if API is accessible at all)
    tryEspn('datagolf_rankings',
      `https://feeds.datagolf.com/preds/get-dg-rankings?file_format=json&key=free`
    ),

    // 29. SlashGolf: check if /stats endpoint exists (with auth headers)
    (async () => {
      const label = 'slashgolf_stats_endpoint';
      try {
        const key = process.env.SLASH_GOLF_API_KEY ?? '';
        const res = await fetch('https://live-golf-data.p.rapidapi.com/stats?tournId=026&year=2026', {
          cache: 'no-store',
          headers: { 'x-rapidapi-host': 'live-golf-data.p.rapidapi.com', 'x-rapidapi-key': key },
          signal: AbortSignal.timeout(8000),
        });
        const text = await res.text();
        let json: unknown; try { json = JSON.parse(text); } catch { json = text; }
        return { label, status: res.status, ok: res.ok, data: json };
      } catch (e) { return { label, error: String(e) }; }
    })(),

    // 30. PGA Tour GQL scorecardStatsV3 — US Open, try R2026026
    tryGql('pga_gql_scorecardStatsV3_R2026026', `
      query ScorecardStatsV3($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          __typename
        }
      }
    `, { id: 'R2026026', playerId: TEST_PGA_TOUR_ID }),

    // 31. PGA Tour GQL scorecardStatsV3 introspect return type
    tryGql('pga_gql_introspect_scorecardStatsV3_type', `
      {
        __type(name: "ScorecardStatsV3") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 32. PGA Tour GQL leaderboardStats — US Open R2026026
    tryGql('pga_gql_leaderboardStats_R2026026', `
      query LeaderboardStats($id: ID!) {
        leaderboardStats(id: $id) {
          __typename
        }
      }
    `, { id: 'R2026026' }),

    // 33. PGA Tour GQL fieldStats — US Open R2026026
    tryGql('pga_gql_fieldStats_R2026026', `
      query FieldStats($tournamentId: ID!) {
        fieldStats(tournamentId: $tournamentId) {
          __typename
        }
      }
    `, { tournamentId: 'R2026026' }),

    // 34. PGA Tour GQL scorecardStats (non-v3) — US Open R2026026
    tryGql('pga_gql_scorecardStats_R2026026', `
      query ScorecardStats($id: ID!, $playerId: ID!) {
        scorecardStats(id: $id, playerId: $playerId) {
          __typename
        }
      }
    `, { id: 'R2026026', playerId: TEST_PGA_TOUR_ID }),

    // 35. PGA Tour GQL scorecardStatsV3 — try without R prefix
    tryGql('pga_gql_scorecardStatsV3_2026026', `
      query ScorecardStatsV3b($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          __typename
        }
      }
    `, { id: '2026026', playerId: TEST_PGA_TOUR_ID }),

    // 36. PGA Tour GQL: introspect LeaderboardStatsType enum values
    tryGql('pga_gql_introspect_LeaderboardStatsType', `
      {
        __type(name: "LeaderboardStatsType") {
          name
          enumValues { name }
        }
      }
    `, {}),

    // 37. PGA Tour GQL: introspect FieldStatType enum values
    tryGql('pga_gql_introspect_FieldStatType', `
      {
        __type(name: "FieldStatType") {
          name
          enumValues { name }
        }
      }
    `, {}),

    // 38. PGA Tour GQL scorecardStatsV3 — try PGA Championship (known working tourn) for schema check
    tryGql('pga_gql_scorecardStatsV3_R2026033', `
      query ScorecardStatsV3pga($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          __typename
        }
      }
    `, { id: 'R2026033', playerId: TEST_PGA_TOUR_ID }),

    // 39. Introspect PlayerScorecardStats type fields
    tryGql('pga_gql_introspect_PlayerScorecardStats', `
      {
        __type(name: "PlayerScorecardStats") {
          name
          fields {
            name
            type { name kind ofType { name kind ofType { name kind } } }
          }
        }
      }
    `, {}),

    // 40. scorecardStatsV3 — US Open with all likely stat fields
    tryGql('pga_gql_scorecardStatsV3_full_R2026026', `
      query ScorecardStatsV3Full($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          __typename
          sgTotal
          sgOtt
          sgApp
          sgArg
          sgPutt
          sgTee
          drivingDistance
          drivingAccuracy
          gir
          scrambling
          puttsPerRound
          proximity
          scoringAverage
          totalStrokes
          toPar
        }
      }
    `, { id: 'R2026026', playerId: TEST_PGA_TOUR_ID }),

    // 41. leaderboardStats STROKES_GAINED — US Open
    tryGql('pga_gql_leaderboardStats_SG_R2026026', `
      query LeaderboardStatsSG($id: ID!) {
        leaderboardStats(id: $id, statsType: STROKES_GAINED) {
          __typename
        }
      }
    `, { id: 'R2026026' }),

    // 42. Introspect LeaderboardStats type
    tryGql('pga_gql_introspect_LeaderboardStats', `
      {
        __type(name: "LeaderboardStats") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 43. fieldStats — US Open with likely field names
    tryGql('pga_gql_fieldStats_full_R2026026', `
      query FieldStatsFull($tournamentId: ID!) {
        fieldStats(tournamentId: $tournamentId) {
          __typename
          players {
            __typename
          }
        }
      }
    `, { tournamentId: 'R2026026' }),

    // 44. Introspect FieldStats type
    tryGql('pga_gql_introspect_FieldStats', `
      {
        __type(name: "FieldStats") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 45. leaderboardStats STROKES_GAINED with players + __typename to find player type name
    tryGql('pga_gql_leaderboardStats_SG_players_typename', `
      query LeaderboardStatsSGPlayers($id: ID!) {
        leaderboardStats(id: $id, statsType: STROKES_GAINED) {
          id
          type
          titles
          statIds
          players {
            __typename
          }
          rounds
        }
      }
    `, { id: 'R2026026' }),

    // 46. Introspect all types containing "Stat" or "Leaderboard" player
    tryGql('pga_gql_introspect_LeaderboardStatPlayer', `
      {
        __type(name: "LeaderboardStatPlayer") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 47. Introspect ScorecardRound (likely type for PlayerScorecardStats.rounds items)
    tryGql('pga_gql_introspect_ScorecardRound', `
      {
        __type(name: "ScorecardRound") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 48. scorecardStatsV3 — query only rounds field with __typename
    tryGql('pga_gql_scorecardStatsV3_rounds_typename', `
      query ScorecardStatsRounds($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          id
          rounds {
            __typename
          }
        }
      }
    `, { id: 'R2026026', playerId: TEST_PGA_TOUR_ID }),

    // 49. Introspect PlayerScorecardRoundStats
    tryGql('pga_gql_introspect_PlayerScorecardRoundStats', `
      {
        __type(name: "PlayerScorecardRoundStats") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 50. scorecardStatsV3 — get actual round stats with all likely field names
    tryGql('pga_gql_scorecardStatsV3_rounds_full', `
      query ScorecardStatsRoundsFull($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          id
          rounds {
            __typename
            roundNumber
            roundId
            score
            toPar
            sgTotal
            sgOtt
            sgApp
            sgArg
            sgPutt
            drivingDistance
            drivingAccuracy
            gir
            scrambling
            puttsPerRound
            proximity
          }
        }
      }
    `, { id: 'R2026026', playerId: TEST_PGA_TOUR_ID }),

    // 51. leaderboardStats rounds with sub-selection
    tryGql('pga_gql_leaderboardStats_rounds', `
      query LeaderboardStatsRounds($id: ID!) {
        leaderboardStats(id: $id, statsType: STROKES_GAINED) {
          id
          type
          titles
          statIds
          players {
            __typename
          }
          rounds {
            __typename
          }
        }
      }
    `, { id: 'R2026026' }),

    // 52. scorecardStatsV3 with correct fields: round, strokesGained, performance, scoring
    tryGql('pga_gql_scorecardStatsV3_correct_fields', `
      query ScorecardStatsCorrect($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          id
          rounds {
            round
            displayName
            roundStatus
            strokesGained {
              __typename
            }
            performance {
              __typename
            }
            scoring {
              __typename
            }
          }
        }
      }
    `, { id: 'R2026026', playerId: TEST_PGA_TOUR_ID }),

    // 53. Introspect LeaderboardRoundStats
    tryGql('pga_gql_introspect_LeaderboardRoundStats', `
      {
        __type(name: "LeaderboardRoundStats") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 54. Introspect ScorecardStatsItem
    tryGql('pga_gql_introspect_ScorecardStatsItem', `
      {
        __type(name: "ScorecardStatsItem") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 55. scorecardStatsV3 scoring items with CORRECT fields
    tryGql('pga_gql_scorecardStatsV3_scoring_correct', `
      query ScorecardStatsScoringCorrect($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          id
          rounds {
            round
            displayName
            scoring {
              label
              total
              rank
              yearToDate
              statId
            }
          }
        }
      }
    `, { id: 'R2026026', playerId: TEST_PGA_TOUR_ID }),

    // 56. Dump ALL ESPN Core stat names for Masters (to find SG field names)
    tryEspn('espn_core_masters_all_stat_names',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_MASTERS}/competitions/${ESPN_EVENT_MASTERS}/competitors/${TEST_ESPN_ID}/statistics/0`
    ),

    // 59. EUR overall standings (id=0) - probe first 3 entries to see data shape
    tryEspn('espn_eur_standings_overall', `${ESPN_CORE}/eur/seasons/2026/types/2/standings/0?limit=5`),

    // 60. All-league rankings/1 — might be OWGR or Race to Dubai
    tryEspn('espn_all_rankings_1', `${ESPN_CORE}/all/seasons/2026/rankings/1?limit=5`),

    // 61. All-league rankings/2
    tryEspn('espn_all_rankings_2', `${ESPN_CORE}/all/seasons/2026/rankings/2?limit=5`),

    // 62. All-league rankings/3
    tryEspn('espn_all_rankings_3', `${ESPN_CORE}/all/seasons/2026/rankings/3?limit=5`),

    // 63. EUR June standings (most recent month) - standings/6
    tryEspn('espn_eur_standings_june', `${ESPN_CORE}/eur/seasons/2026/types/2/standings/6?limit=5`),

    // 57. scorecardStatsV3 for Masters — does strokesGained have data for PGA Tour events?
    tryGql('pga_gql_scorecardStatsV3_masters_sg', `
      query MastersSG($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          id
          rounds {
            round
            displayName
            strokesGained { label total rank statId }
            performance { label total rank statId }
          }
        }
      }
    `, { id: 'R2026014', playerId: TEST_PGA_TOUR_ID }),

    // 58. scorecardStatsV3 for PGA Championship
    tryGql('pga_gql_scorecardStatsV3_pga_sg', `
      query PgaSG($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          id
          rounds {
            round
            displayName
            strokesGained { label total rank statId }
            performance { label total rank statId }
          }
        }
      }
    `, { id: 'R2026033', playerId: TEST_PGA_TOUR_ID }),

  ]);

  const output = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { error: String(r.reason) }
  );

  redis.setex('golf-stats-test-results', 3600, JSON.stringify(output)).catch(() => {});

  return Response.json({
    testPlayer: TEST_PLAYER_NAME,
    pgaTourId: TEST_PGA_TOUR_ID,
    espnId: TEST_ESPN_ID,
    espnEventMasters: ESPN_EVENT_MASTERS,
    espnEventUsOpen: ESPN_EVENT_USOPEN,
    results: output,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
