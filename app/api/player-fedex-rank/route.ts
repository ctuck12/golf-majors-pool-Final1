export const dynamic = 'force-dynamic';

import { getEspnId } from '@/app/lib/espn-player-season';
import { getActiveSeason } from '@/app/lib/tournament-config';
import { resolveChangedAt } from '@/app/lib/changed-at';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';

// Static DP World Tour Race to Dubai standings (updated June 2026)
const DP_WORLD_RANKINGS: Record<string, number> = {
  'Patrick Reed': 1,
  'Rory McIlroy': 2,
  'Jayden Schaper': 3,
  'Aaron Rai': 4,
  'Casey Jarvis': 5,
  'Eugenio Chacarra': 6,
  'Andy Sullivan': 7,
  'Dan Bradbury': 8,
  'Shaun Norris': 9,
  'Mikael Lindberg': 10,
  'Daniel Hillier': 11,
  'Bernd Wiesberger': 12,
  'Alex Fitzpatrick': 13,
  'Julien Guerrier': 14,
  'Kota Kaneko': 15,
  'Oliver Lindell': 16,
  'David Puig': 17,
  'Calum Hill': 18,
  'Marcus Armitage': 19,
  'Davis Bryant': 20,
  'Jorge Campillo': 21,
  'Nacho Elvira': 22,
  'Angel Ayora': 23,
  'Jacob Skov Olesen': 24,
  'Jon Rahm': 25,
  'Freddy Schott': 26,
  'Ricardo Gouveia': 27,
  'Hennie Du Plessis': 28,
  'Adrian Otaegui': 29,
  'Justin Rose': 30,
  'Tyrrell Hatton': 31,
  'Kristoffer Reitan': 32,
  'Richard Sterne': 33,
  'Jordan Gumberg': 34,
  'Wenyi Ding': 35,
  'Yurav Premlall': 36,
  'Ludvig Aberg': 37,
  'Ludvig Åberg': 37,
  'Nathan Kimsey': 38,
  'Daniel Rodrigues': 39,
  'Justin Thomas': 40,
  'Rasmus Neergaard-Petersen': 41,
  'Ewen Ferguson': 42,
  'Martin Couvra': 43,
  'Francesco Molinari': 44,
  'Darius Van Driel': 45,
  'Gregorio De Leo': 46,
  'Rafa Cabrera Bello': 47,
  'Ugo Coussaud': 48,
  'Francesco Laporta': 49,
  'Alejandro Del Rey': 50,
  'JC Ritchie': 51,
  'Guido Migliozzi': 52,
  'Frederic Lacroix': 53,
  'Antoine Rozner': 54,
  'John Parry': 55,
  'Ryan Gerard': 56,
  'Brandon Robinson Thompson': 57,
  'Nicolai Højgaard': 58,
  'Nicolai Hojgaard': 58,
  'Eddie Pepperell': 59,
  'Oihan Guillamoundeguy': 60,
  'David Ravetto': 61,
  'Maximilian Steinlechner': 62,
  'Johannes Veerman': 63,
  'Tom Vaillant': 64,
  'Joe Dean': 65,
  'Matt Fitzpatrick': 66,
  'Shane Lowry': 67,
  'Grant Forrest': 68,
  'Sebastian Soderberg': 69,
  'Sebastian Söderberg': 69,
  'Michael Hollick': 70,
  'Yanhan Zhou': 71,
  'Daniel Van Tonder': 72,
  'Zander Lombard': 73,
  'Manuel Elvira': 74,
  'Marcus Kinhult': 75,
  'Chris Gotterup': 76,
  'Dylan Frittelli': 77,
  'Kazuma Kobori': 78,
  'Christiaan Bezuidenhout': 79,
  'Tommy Fleetwood': 80,
  'Adam Scott': 81,
  'Si Woo Kim': 82,
  'Ryan Fox': 83,
  'Thriston Lawrence': 84,
  'Joost Luiten': 85,
  'Andreas Halvorsen': 86,
  'Jason Scrivener': 87,
  'Angel Hidalgo': 88,
  'Viktor Hovland': 89,
  'Jacques Kruyswijk': 90,
  'Min Woo Lee': 91,
  'Matthew Jordan': 92,
  'Kiradech Aphibarnrat': 93,
  'Thorbjorn Olesen': 94,
  'Thorbjørn Olesen': 94,
  'Matteo Manassero': 95,
  'Marcel Schneider': 96,
  'Romain Langasque': 97,
  'Rikuya Hoshino': 98,
  'Joakim Lagergren': 99,
  'Yuto Katsuragawa': 100,
};

// Fallback FedEx Cup rank straight from the PGA Tour's own standings (statDetails 02671 =
// FedExCup Season Points) — used when ESPN's leaders feed is down (it 500'd during Open week
// 2026). Matches by pgaTourId when known, else by normalized name.
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const normPga = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().replace(/[^a-z ]/g, '').trim();

async function fedexRankFromPgaTour(pgaTourId: string, name: string): Promise<number | null> {
  try {
    const query = `
      query StatDetails($statId: String!) {
        statDetails(tourCode: R, statId: $statId) {
          rows {
            ... on StatDetailsPlayer {
              playerId
              playerName
              rank
            }
          }
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { statId: '02671' } }),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      data?: { statDetails?: { rows?: Array<{ playerId?: string; playerName?: string; rank?: number | string }> } };
    };
    const rows = data?.data?.statDetails?.rows ?? [];
    const want = normPga(name);
    const hit = rows.find((r) => (pgaTourId && String(r.playerId ?? '') === pgaTourId) || (r.playerName && normPga(r.playerName) === want));
    if (!hit) return null;
    const rank = Number(hit.rank);
    return Number.isFinite(rank) && rank > 0 ? rank : null;
  } catch {
    return null;
  }
}

async function getRankFromLeaders(
  standingsRes: Response,
  espnId: string,
  categoryName: string,
): Promise<number | null> {
  if (!standingsRes.ok) return null;
  const data = await standingsRes.json();
  const cat = (data.categories as Array<{ name: string; leaders: unknown[] }> | undefined)?.find(
    (c) => c.name === categoryName,
  );
  if (!cat) return null;
  const leaders = cat.leaders as Array<{ value?: number; athlete: Record<string, string> }>;
  const idx = leaders.findIndex((l) => {
    const ref = Object.values(l.athlete)[0] ?? '';
    return ref.match(/athletes\/(\d+)/)?.[1] === espnId;
  });
  if (idx === -1) return null;
  // A player with 0 FedEx Cup points has no meaningful ranking — e.g. a past champion who played
  // one event (the Masters) and missed the cut still appears in the tail of ESPN's leaders list,
  // producing a bogus "rank". Only report a rank when the player has actually earned points.
  const value = leaders[idx].value;
  if (typeof value === 'number' && value <= 0) return null;
  return idx + 1;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const pgaTourId = searchParams.get('pgaTourId') ?? '';
  if (!name) return Response.json({ rank: null, dpWorldRank: null });

  try {
    const season = getActiveSeason();
    const [espnId, fedexRes] = await Promise.all([
      getEspnId(name),
      fetch(
        `${ESPN_CORE}/pga/seasons/${season}/types/2/leaders?limit=336`,
        { next: { revalidate: 3600 } },
      ),
    ]);

    const fedexFromEspn = espnId ? await getRankFromLeaders(fedexRes, espnId, 'cupPoints') : null;
    // ESPN's leaders feed has been unreliable — fall back to the PGA Tour's own standings.
    const fedexRank = fedexFromEspn ?? await fedexRankFromPgaTour(pgaTourId !== '0' ? pgaTourId : '', name);
    const dpWorldRank = DP_WORLD_RANKINGS[name] ?? null;

    const updatedAt = await resolveChangedAt(`rank-changed:fedex:${name}`, String(fedexRank ?? ''));
    return Response.json({ rank: fedexRank, dpWorldRank, updatedAt });
  } catch {
    const fallback = await fedexRankFromPgaTour(pgaTourId !== '0' ? pgaTourId : '', name).catch(() => null);
    return Response.json({ rank: fallback, dpWorldRank: DP_WORLD_RANKINGS[name] ?? null });
  }
}
