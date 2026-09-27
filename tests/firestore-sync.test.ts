import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDemoDatabase,
  normalizeDemoDatabase,
  simulateVendorDelay,
  updateIncidentLifecycle,
} from '../lib/demo-database.ts';
import {
  buildDatabasePatch,
  FirestoreSyncCoordinator,
} from '../lib/firestore-sync.ts';

void test('listener-originated state is not echoed back to Firestore', () => {
  const local = createDemoDatabase();
  const remote = updateIncidentLifecycle(simulateVendorDelay(local), 'INVESTIGATING');
  const coordinator = new FirestoreSyncCoordinator(local);
  assert.equal(coordinator.acceptRemote(remote, local), true);
  assert.equal(coordinator.queueLocal(remote), false);
  assert.equal(coordinator.takePending(), null);
});

void test('rapid lifecycle changes coalesce into one changed-section patch', () => {
  const seed = createDemoDatabase();
  const coordinator = new FirestoreSyncCoordinator(seed);
  const detected = simulateVendorDelay(seed);
  const investigating = updateIncidentLifecycle(detected, 'INVESTIGATING');
  const waiting = updateIncidentLifecycle(investigating, 'WAITING_FOR_APPROVAL');
  coordinator.queueLocal(detected);
  coordinator.queueLocal(investigating);
  coordinator.queueLocal(waiting);
  const write = coordinator.takePending();
  assert.ok(write);
  assert.equal(write.database.incidents[0].lifecycle, 'WAITING_FOR_APPROVAL');
  assert.deepEqual(Object.keys(write.patch).sort(), [
    'database.catering',
    'database.events',
    'database.incidents',
  ]);
  assert.equal(coordinator.takePending(), null);
});

void test('unchanged database creates no Firestore patch', () => {
  const seed = createDemoDatabase();
  assert.deepEqual(buildDatabasePatch(seed, structuredClone(seed)), {});
});

void test('legacy Firestore snapshots migrate once without losing operations', () => {
  const legacy = createDemoDatabase() as Partial<ReturnType<typeof createDemoDatabase>>;
  delete legacy.contacts;
  delete legacy.communications;
  const normalized = normalizeDemoDatabase(legacy);
  assert.equal(normalized.contacts[0].demo, true);
  assert.deepEqual(normalized.communications, []);
  const coordinator = new FirestoreSyncCoordinator(legacy as ReturnType<typeof createDemoDatabase>);
  coordinator.acceptRemote(legacy as ReturnType<typeof createDemoDatabase>, createDemoDatabase());
  assert.equal(coordinator.queueLocal(normalized), true);
  const migration = coordinator.takePending();
  assert.deepEqual(Object.keys(migration?.patch ?? {}).sort(), [
    'database.communications',
    'database.contacts',
  ]);
});
