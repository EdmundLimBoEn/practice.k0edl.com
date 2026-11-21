interface Env {
  OPENAI_API_KEY: string
  LIMIT: { limit(input: { key: string }): Promise<{ success: boolean }> }
}
const origin = 'https://practice.k0edl.com'
const headers = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
  Vary: 'Origin',
}
export default {
  async fetch(request: Request, env: Env) {
    if (request.headers.get('Origin') !== origin)
      return new Response(null, { status: 403 })
    if (new URL(request.url).pathname !== '/session')
      return new Response(null, { status: 404, headers })
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers })
    if (request.method !== 'POST')
      return new Response(null, { status: 405, headers })
    const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
    if (!(await env.LIMIT.limit({ key: ip })).success)
      return new Response(null, { status: 429, headers })
    const result = await fetch(
      'https://api.openai.com/v1/realtime/client_secrets',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + env.OPENAI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_after: { anchor: 'created_at', seconds: 60 },
          session: {
            type: 'realtime',
            model: 'gpt-realtime',
            instructions:
              'Provide brief simulated amateur radio conversations for receive-only training.',
          },
        }),
      },
    )
    if (!result.ok) return new Response(null, { status: 502, headers })
    const { value, expires_at } = (await result.json()) as {
      value: string
      expires_at: number
    }
    return Response.json({ value, expires_at }, { headers })
  },
}
