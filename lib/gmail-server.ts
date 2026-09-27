import { env } from 'cloudflare:workers';
import { draftFingerprint, encodeMimeMessage, validateEmailDraft, type EmailDraft } from './communications';

type RuntimeBindings = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  GMAIL_SESSION_SECRET?: string;
};

export type GmailSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email: string;
};

type ApprovalGrant = { fingerprint: string; expiresAt: number; nonce: string };

export const GMAIL_SESSION_COOKIE = 'eventos_gmail_session';
export const GMAIL_STATE_COOKIE = 'eventos_gmail_state';

const clean = (value?: string) => value?.trim().replace(/^['"]|['"]$/g, '') || undefined;

export function gmailConfig() {
  let runtime: RuntimeBindings = {};
  try { runtime = env as RuntimeBindings; } catch { /* Node fallback */ }
  const read = (key: keyof RuntimeBindings) => clean(runtime[key]) ?? clean(process.env[key]);
  return {
    clientId: read('GOOGLE_CLIENT_ID'),
    clientSecret: read('GOOGLE_CLIENT_SECRET'),
    redirectUri: read('GOOGLE_REDIRECT_URI'),
    sessionSecret: read('GMAIL_SESSION_SECRET'),
  };
}

export function gmailConfigured() {
  const config = gmailConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri && config.sessionSecret && config.sessionSecret.length >= 32);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function encryptionKey() {
  const secret = gmailConfig().sessionSecret;
  if (!secret || secret.length < 32) throw new Error('Gmail session encryption is not configured.');
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function seal(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), new TextEncoder().encode(JSON.stringify(value)));
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`;
}

export async function unseal<T>(value?: string): Promise<T | null> {
  if (!value) return null;
  try {
    const [iv, payload] = value.split('.');
    if (!iv || !payload) return null;
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64UrlDecode(iv) }, await encryptionKey(), base64UrlDecode(payload));
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  } catch { return null; }
}

export function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get('cookie') ?? '';
  return cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function secureCookie(name: string, value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new Error('Cross-origin request rejected.');
}

export async function createApprovalGrant(value: unknown): Promise<string> {
  const draft = validateEmailDraft(value);
  return seal({ fingerprint: draftFingerprint(draft), expiresAt: Date.now() + 10 * 60_000, nonce: crypto.randomUUID() } satisfies ApprovalGrant);
}

export async function verifyApprovalGrant(token: string, draft: EmailDraft) {
  const grant = await unseal<ApprovalGrant>(token);
  if (!grant || grant.expiresAt < Date.now() || grant.fingerprint !== draftFingerprint(draft)) throw new Error('Email approval is missing, expired, or does not match this draft.');
}

export async function exchangeAuthorizationCode(code: string): Promise<GmailSession> {
  const config = gmailConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) throw new Error('Gmail OAuth is not configured.');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code' }) });
  if (!response.ok) throw new Error('Google rejected the OAuth token exchange.');
  const token = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!profileResponse.ok) throw new Error('Google profile lookup failed.');
  const profile = await profileResponse.json() as { email: string };
  return { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000 - 60_000, email: profile.email };
}

export async function refreshSession(session: GmailSession): Promise<GmailSession> {
  if (session.expiresAt > Date.now()) return session;
  const config = gmailConfig();
  if (!session.refreshToken || !config.clientId || !config.clientSecret) throw new Error('Gmail authorization expired. Reconnect Gmail.');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: session.refreshToken, client_id: config.clientId, client_secret: config.clientSecret, grant_type: 'refresh_token' }) });
  if (!response.ok) throw new Error('Gmail authorization could not be refreshed.');
  const token = await response.json() as { access_token: string; expires_in: number };
  return { ...session, accessToken: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 - 60_000 };
}

export async function sendGmail(session: GmailSession, value: unknown) {
  const draft = validateEmailDraft(value);
  const activeSession = await refreshSession(session);
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${activeSession.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: encodeMimeMessage(draft, activeSession.email) }) });
  if (!response.ok) throw new Error(`Gmail send failed (${response.status}).`);
  const sent = await response.json() as { id: string; threadId?: string };
  return { session: activeSession, messageId: sent.id };
}
