import { cookieValue, gmailConfigured, GMAIL_SESSION_COOKIE, unseal, type GmailSession } from '@/lib/gmail-server';

export async function GET(request: Request) {
  const configured = gmailConfigured();
  if (!configured) return Response.json({ configured: false, connected: false, email: null, message: 'Gmail integration is not configured.' });
  const session = await unseal<GmailSession>(cookieValue(request, GMAIL_SESSION_COOKIE));
  return Response.json({ configured: true, connected: Boolean(session), email: session?.email ?? null, message: session ? `Connected as ${session.email}` : 'Gmail is configured but not connected.' });
}
