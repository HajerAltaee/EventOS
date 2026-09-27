import type { DemoDatabase } from './demo-database';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function databaseFingerprint(database: DemoDatabase): string {
  return JSON.stringify(canonicalize(database));
}

export function buildDatabasePatch(
  previous: DemoDatabase,
  next: DemoDatabase,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof DemoDatabase)[]) {
    if (databaseFingerprintValue(previous[key]) !== databaseFingerprintValue(next[key])) {
      patch[`database.${key}`] = next[key];
    }
  }
  return patch;
}

function databaseFingerprintValue(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export class FirestoreSyncCoordinator {
  private persisted: DemoDatabase;
  private persistedFingerprint: string;
  private suppressedRemoteFingerprint: string | null = null;
  private pending: DemoDatabase | null = null;

  constructor(initial: DemoDatabase) {
    this.persisted = structuredClone(initial);
    this.persistedFingerprint = databaseFingerprint(initial);
  }

  acceptRemote(remote: DemoDatabase, current: DemoDatabase): boolean {
    const remoteFingerprint = databaseFingerprint(remote);
    this.persisted = structuredClone(remote);
    this.persistedFingerprint = remoteFingerprint;
    this.pending = null;
    if (remoteFingerprint === databaseFingerprint(current)) return false;
    this.suppressedRemoteFingerprint = remoteFingerprint;
    return true;
  }

  queueLocal(database: DemoDatabase): boolean {
    const fingerprint = databaseFingerprint(database);
    if (fingerprint === this.suppressedRemoteFingerprint) {
      this.suppressedRemoteFingerprint = null;
      return false;
    }
    if (fingerprint === this.persistedFingerprint) return false;
    if (this.pending && fingerprint === databaseFingerprint(this.pending)) return false;
    this.pending = structuredClone(database);
    return true;
  }

  takePending(): { database: DemoDatabase; patch: Record<string, unknown> } | null {
    const database = this.pending;
    this.pending = null;
    if (!database) return null;
    const patch = buildDatabasePatch(this.persisted, database);
    return Object.keys(patch).length ? { database, patch } : null;
  }

  markPersisted(database: DemoDatabase): void {
    this.persisted = structuredClone(database);
    this.persistedFingerprint = databaseFingerprint(database);
  }

  hasPending(): boolean {
    return this.pending !== null;
  }
}
