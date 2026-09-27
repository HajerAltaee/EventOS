export type CommunicationStatus = 'pending' | 'sent' | 'failed' | 'rejected';

export type EmailDraft = {
  to: string;
  subject: string;
  body: string;
  reason: string;
  eventId: string;
  incidentId: string;
};

export type CommunicationRecord = EmailDraft & {
  id: string;
  channel: 'email';
  status: CommunicationStatus;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  providerMessageId?: string;
  error?: string;
};

export type GmailStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  message: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function validateEmailDraft(value: unknown): EmailDraft {
  if (!value || typeof value !== 'object') throw new Error('Email draft is required.');
  const draft = value as Record<string, unknown>;
  const result: EmailDraft = {
    to: String(draft.to ?? '').trim().toLowerCase(),
    subject: String(draft.subject ?? '').trim(),
    body: String(draft.body ?? '').trim(),
    reason: String(draft.reason ?? '').trim(),
    eventId: String(draft.eventId ?? '').trim(),
    incidentId: String(draft.incidentId ?? '').trim(),
  };
  if (!isValidEmail(result.to)) throw new Error('A valid recipient email is required.');
  if (!result.subject || result.subject.length > 180) throw new Error('Subject must be between 1 and 180 characters.');
  if (!result.body || result.body.length > 10_000) throw new Error('Message must be between 1 and 10,000 characters.');
  if (!result.reason || result.reason.length > 1_000) throw new Error('A concise operational reason is required.');
  if (!result.eventId || !result.incidentId) throw new Error('The related event and incident are required.');
  return result;
}

export function draftFingerprint(draft: EmailDraft): string {
  return [draft.to, draft.subject, draft.body, draft.reason, draft.eventId, draft.incidentId].join('\u001f');
}

export function encodeMimeMessage(draft: EmailDraft, from?: string): string {
  const headers = [
    ...(from ? [`From: ${from}`] : []),
    `To: ${draft.to}`,
    `Subject: =?UTF-8?B?${toBase64(draft.subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];
  return toBase64Url(`${headers.join('\r\n')}\r\n\r\n${draft.body}`);
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toBase64Url(value: string): string {
  return toBase64(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
