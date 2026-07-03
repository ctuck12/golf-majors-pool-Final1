import { NextResponse } from 'next/server';
import { getPlayerTags } from '../../lib/player-tags-store';

export const dynamic = 'force-dynamic';

// Public read of the amateur / club-pro flags (canonical name keys) so the bio popup can show an
// "Amateur" badge and the PGA seal for players the commissioner's uploads flagged.
export async function GET() {
  const tags = await getPlayerTags();
  return NextResponse.json(tags);
}
