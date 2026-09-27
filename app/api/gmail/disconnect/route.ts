import { assertSameOrigin, clearCookie, GMAIL_SESSION_COOKIE } from '@/lib/gmail-server';

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return Response.json({ error: 'Cross-origin request rejected.' }, { status: 403 }); }
  return Response.json({ disconnected: true }, { headers: { 'Set-Cookie': clearCookie(GMAIL_SESSION_COOKIE) } });
}
