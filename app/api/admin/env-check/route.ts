export const dynamic = 'force-dynamic';

export async function GET() {
  const key = process.env.SLASH_GOLF_API_KEY;
  return Response.json({
    SLASH_GOLF_API_KEY_set: !!key,
    SLASH_GOLF_API_KEY_length: key?.length ?? 0,
    SLASH_GOLF_API_KEY_preview: key ? `${key.slice(0, 6)}...${key.slice(-6)}` : null,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
