export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ v: process.env.VERCEL_DEPLOYMENT_ID ?? 'dev' });
}
