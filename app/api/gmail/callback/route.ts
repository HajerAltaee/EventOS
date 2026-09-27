import { clearCookie, cookieValue, exchangeAuthorizationCode, GMAIL_SESSION_COOKIE, GMAIL_STATE_COOKIE, seal, secureCookie, unseal } from '@/lib/gmail-server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const saved = await unseal<{ state: string; expiresAt: number }>(cookieValue(request, GMAIL_STATE_COOKIE));
  const redirect = new URL('/', url.origin);
  if (!code || !returnedState || !saved || saved.expiresAt < Date.now() || saved.state !== returnedState) {
    redirect.searchParams.set('gmail', 'error');
    return new Response(null, { status: 302, headers: { Location: redirect.toString(), 'Set-Cookie': clearCookie(GMAIL_STATE_COOKIE) } });
  }
  try {
    const session = await exchangeAuthorizationCode(code);
    redirect.searchParams.set('gmail', 'connected');
    const headers = new Headers({ Location: redirect.toString(), 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', secureCookie(GMAIL_SESSION_COOKIE, await seal(session), 60 * 60 * 24 * 30));
    headers.append('Set-Cookie', clearCookie(GMAIL_STATE_COOKIE));
    return new Response(null, { status: 302, headers });
  } catch {
    redirect.searchParams.set('gmail', 'error');
    return new Response(null, { status: 302, headers: { Location: redirect.toString(), 'Set-Cookie': clearCookie(GMAIL_STATE_COOKIE) } });
  }
}
