import { assertSameOrigin, cookieValue, gmailConfigured, GMAIL_SESSION_COOKIE, seal, secureCookie, sendGmail, unseal, verifyApprovalGrant, type GmailSession } from '@/lib/gmail-server';
import { validateEmailDraft } from '@/lib/communications';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!gmailConfigured()) return Response.json({ error: 'Gmail integration is not configured.' }, { status: 503 });
    const session = await unseal<GmailSession>(cookieValue(request, GMAIL_SESSION_COOKIE));
    if (!session) return Response.json({ error: 'Gmail is not connected.' }, { status: 401 });
    const body = await request.json() as { draft?: unknown; approvalToken?: string };
    const draft = validateEmailDraft(body.draft);
    await verifyApprovalGrant(String(body.approvalToken ?? ''), draft);
    const sent = await sendGmail(session, draft);
    return Response.json({ sent: true, messageId: sent.messageId }, { headers: { 'Set-Cookie': secureCookie(GMAIL_SESSION_COOKIE, await seal(sent.session), 60 * 60 * 24 * 30) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gmail send failed.';
    const status = message.includes('approval') ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
