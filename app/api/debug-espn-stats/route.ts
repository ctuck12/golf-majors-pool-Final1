export const dynamic = 'force-dynamic';

// Debug: introspect PGA Tour GQL schema to find available query fields.
// /api/debug-espn-stats

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

function gqlHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': PGA_API_KEY,
    'Referer': 'https://www.pgatour.com/',
    'Origin': 'https://www.pgatour.com',
  };
}

export async function GET() {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({
        query: `query { __schema { queryType { fields { name description } } } }`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json() as {
      data?: { __schema?: { queryType?: { fields?: Array<{ name: string; description?: string }> } } };
    };
    const fields = data?.data?.__schema?.queryType?.fields ?? [];
    const statRelated = fields.filter((f) =>
      /stat|score|lead|rank|player|tour/i.test(f.name)
    );
    return Response.json({
      totalQueryFields: fields.length,
      allNames: fields.map((f) => f.name).sort(),
      statRelated,
    });
  } catch (e) {
    return Response.json({ error: String(e) });
  }
}
