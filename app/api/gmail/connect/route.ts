import { gmailConfig, gmailConfigured, GMAIL_STATE_COOKIE, seal, secureCookie } from '@/lib/gmail-server';

export async function GET() {
  if (!gmailConfigured()) return Response.json({ error: 'Gmail integration is not configured.' }, { status: 503 });
  const config = gmailConfig();
  const state = crypto.randomUUID();
  const stateCookie = await seal({ state, expiresAt: Date.now() + 10 * 60_000 });
  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.search = new URLSearchParams({ client_id: config.clientId!, redirect_uri: config.redirectUri!, response_type: 'code', scope: 'https://www.googleapis.com/auth/gmail.send openid email', access_type: 'offline', prompt: 'consent', state }).toString();
  return new Response(null, { status: 302, headers: { Location: authorization.toString(), 'Set-Cookie': secureCookie(GMAIL_STATE_COOKIE, stateCookie, 600), 'Cache-Control': 'no-store' } });
}
