import { assertSameOrigin, createApprovalGrant } from '@/lib/gmail-server';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { draft?: unknown };
    return Response.json({ approvalToken: await createApprovalGrant(body.draft) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Email approval failed.' }, { status: 400 });
  }
}
