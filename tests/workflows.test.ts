import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEvaActions,
  createDemoDatabase,
  simulateCheckinQueue,
  simulateMealShortage,
  simulateVendorDelay,
  updateIncidentLifecycle,
  verifyOperationalIncidents,
} from '../lib/demo-database.ts';
import type { CommunicationRecord } from '../lib/communications.ts';
import type { EvaAction } from '../lib/eva-agent.ts';
import { vendorDelayRecoveryActions } from '../lib/vendor-delay-recovery.ts';

void test('vendor delay requires grounded email approval before resolving', () => {
  const detected = simulateVendorDelay(createDemoDatabase());
  const actions = vendorDelayRecoveryActions(detected, 'test');
  const email = actions.find((action) => action.type === 'send_email');
  assert.ok(email?.emailDraft);
  assert.equal(email.approvalRequired, true);
  assert.equal(actions.some((action) => action.type === 'update_vendor'), false);

  let recovered = applyEvaActions(
    detected,
    actions
      .filter((action) => action.type !== 'send_email')
      .map((action) => action.type === 'assign_catering_staff' ? { ...action, staffIds: ['staff-noor'] } : action),
  );
  assert.equal(verifyOperationalIncidents(recovered).incidents[0].status, 'Escalated');

  const communication: CommunicationRecord = {
    id: email.id,
    channel: 'email',
    status: 'failed',
    approvalStatus: 'approved',
    ...email.emailDraft,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    error: 'Gmail integration is not configured.',
  };
  recovered = updateIncidentLifecycle(
    { ...recovered, communications: [communication] },
    'VERIFYING',
  );
  const verified = verifyOperationalIncidents(recovered);
  assert.equal(verified.incidents[0].status, 'Resolved');
  assert.match(verified.incidents[0].verificationResult ?? '', /approved \(failed\)/);
});

void test('meal shortage recovery still resolves', () => {
  const detected = simulateMealShortage(createDemoDatabase());
  const action = (value: Partial<EvaAction> & Pick<EvaAction, 'id' | 'type' | 'target' | 'to'>): EvaAction => ({
    from: null, quantity: null, estimatedCost: 0, reason: 'test', approvalRequired: false, approvalReason: null, ...value,
  });
  const recovered = applyEvaActions(detected, [
    action({ id: 'meals', type: 'update_meals', target: 'meals', to: '120', quantity: 2, dietaryBreakdown: { standard: 60, vegetarian: 12, vegan: 12, halal: 24, allergySensitive: 12 } }),
    action({ id: 'staff', type: 'assign_catering_staff', target: 'Catering', to: 'Meal preparation', quantity: 1, staffIds: ['staff-noor'] }),
  ]);
  assert.equal(verifyOperationalIncidents(recovered).incidents[0].status, 'Resolved');
});

void test('check-in congestion recovery still resolves', () => {
  const detected = simulateCheckinQueue(createDemoDatabase());
  const action = (value: Partial<EvaAction> & Pick<EvaAction, 'id' | 'type' | 'target' | 'to'>): EvaAction => ({
    from: null, quantity: null, estimatedCost: 0, reason: 'test', approvalRequired: false, approvalReason: null, ...value,
  });
  const recovered = applyEvaActions(detected, [
    action({ id: 'lanes', type: 'set_checkin_lanes', target: 'north-entrance', from: '2', to: '4', quantity: 4 }),
    action({ id: 'staff', type: 'reassign_staff', target: 'north-entrance', from: 'staff-pool', to: 'north-entrance', quantity: 2, staffIds: ['staff-lina', 'staff-yusuf'] }),
    action({ id: 'redirect', type: 'redirect_arrivals', target: 'east-entrance', from: 'north-entrance', to: '25%', quantity: 25 }),
  ]);
  assert.equal(verifyOperationalIncidents(recovered).incidents[0].status, 'Resolved');
});
