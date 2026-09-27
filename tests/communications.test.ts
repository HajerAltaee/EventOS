import test from 'node:test';
import assert from 'node:assert/strict';
import { draftFingerprint, encodeMimeMessage, isValidEmail, validateEmailDraft } from '../lib/communications.ts';

const draft = {
  to: 'vendor.demo@example.com',
  subject: 'Urgent ETA',
  body: 'Please confirm the updated delivery time.',
  reason: 'Active vendor delay',
  eventId: 'hackathon',
  incidentId: 'incident-vendor-1',
};

void test('validates an operational email draft', () => {
  assert.equal(validateEmailDraft(draft).to, draft.to);
  assert.equal(isValidEmail('bad-address'), false);
  assert.throws(() => validateEmailDraft({ ...draft, to: 'bad-address' }), /valid recipient/);
});

void test('fingerprint changes when approved content changes', () => {
  assert.notEqual(draftFingerprint(draft), draftFingerprint({ ...draft, subject: 'Changed' }));
});

void test('encodes a Gmail-compatible raw MIME message', () => {
  const raw = encodeMimeMessage(draft, 'organizer@example.com');
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  assert.match(decoded, /To: vendor\.demo@example\.com/);
  assert.match(decoded, /Please confirm the updated delivery time/);
});
