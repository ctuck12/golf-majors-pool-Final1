export const dynamic = 'force-dynamic';

import { resolvePgaTourIdByName, debugDirectorySize } from '@/app/lib/pga-id-resolver';

export async function GET(request: Request) {
  const names = (new URL(request.url).searchParams.get('names')
    ?? 'Tom Hoge,Tony Finau,Seamus Power,Austin Eckroat,Peter Malnati,Mackenzie Hughes').split(',');
  const dirSize = await debugDirectorySize();
  const out: Record<string, string | null> = {};
  for (const n of names) out[n.trim()] = await resolvePgaTourIdByName(n.trim());
  return Response.json({ dirSize, resolved: out });
}
