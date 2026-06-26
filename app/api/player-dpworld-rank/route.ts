export const dynamic = 'force-dynamic';

// DP World Tour rankings (static snapshot provided by pool commissioner)
const DP_WORLD_RANKINGS: Record<string, number> = {
  'Patrick Reed': 1,
  'Rory McIlroy': 2,
  'Jayden Schaper': 3,
  'Jayden Trey Schaper': 3,
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
  'Nicolai Hojgaard': 58,
  'Nicolai Højgaard': 58,
  'Eddie Pepperell': 59,
  'Oihan Guillamoundeguy': 60,
  'David Ravetto': 61,
  'Maximilian Steinlechner': 62,
  'Johannes Veerman': 63,
  'Tom Vaillant': 64,
  'Joe Dean': 65,
  'Matt Fitzpatrick': 66,
  'Matthew Fitzpatrick': 66,
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

function normalize(name: string): string {
  return name.trim().toLowerCase()
    .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ø/g, 'o')
    .replace(/é/g, 'e').replace(/è/g, 'e').replace(/ë/g, 'e')
    .replace(/ü/g, 'u').replace(/ú/g, 'u')
    .replace(/ñ/g, 'n').replace(/ç/g, 'c');
}

const NORMALIZED_RANKINGS: Map<string, number> = new Map(
  Object.entries(DP_WORLD_RANKINGS).map(([k, v]) => [normalize(k), v])
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  if (!name) return Response.json({ rank: null });

  const rank = NORMALIZED_RANKINGS.get(normalize(name)) ?? null;
  return Response.json({ rank });
}
