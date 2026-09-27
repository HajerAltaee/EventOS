import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDatabase, simulateVendorDelay, updateIncidentLifecycle, verifyOperationalIncidents } from '../lib/demo-database.ts';

void test('vendor delay follows explicit lifecycle and remains unresolved before recovery', () => {
  const detected = simulateVendorDelay(createDemoDatabase());
  assert.equal(detected.incidents[0].lifecycle, 'DETECTED');
  const waiting = updateIncidentLifecycle(detected, 'WAITING_FOR_APPROVAL', ['Contact vendor']);
  assert.equal(waiting.incidents[0].lifecycle, 'WAITING_FOR_APPROVAL');
  assert.deepEqual(waiting.incidents[0].recoveryPlan, ['Contact vendor']);
  const verified = verifyOperationalIncidents(updateIncidentLifecycle(waiting, 'VERIFYING'));
  assert.equal(verified.incidents[0].lifecycle, 'FAILED');
});

void test('demo contact is centralized and clearly marked', () => {
  const db = createDemoDatabase();
  const catering = db.catering[0];
  const contact = db.contacts.find((item) => item.id === catering.vendorContactId);
  assert.equal(contact?.type, 'vendor');
  assert.equal(contact?.demo, true);
});
