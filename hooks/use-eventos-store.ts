'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { signInAnonymously } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentReference,
} from 'firebase/firestore';
import {
  createDemoDatabase,
  normalizeDemoDatabase,
  type DemoDatabase,
} from '@/lib/demo-database';
import { firebaseAuth, firestore } from '@/lib/firebase';
import { FirestoreSyncCoordinator } from '@/lib/firestore-sync';

const STORAGE_KEY = 'eventos-demo-database-v8-command-center';
const FIRESTORE_COLLECTION = 'eventos';
const FIRESTORE_DOCUMENT = 'live-operations';
const WRITE_DEBOUNCE_MS = 500;

export function useEventOSStore() {
  const initial = useRef(createDemoDatabase()).current;
  const [database, setDatabaseState] = useState<DemoDatabase>(initial);
  const [hydrated, setHydrated] = useState(false);
  const currentDatabase = useRef(initial);
  const coordinator = useRef(new FirestoreSyncCoordinator(initial));
  const syncEnabled = useRef(false);
  const mounted = useRef(true);
  const writeTimer = useRef<number | null>(null);
  const writeInFlight = useRef(false);
  const documentReference = useRef<DocumentReference | null>(null);

  const setDatabase: Dispatch<SetStateAction<DemoDatabase>> = useCallback(
    (value) => {
      setDatabaseState((previous) => {
        const next =
          typeof value === 'function'
            ? (value as (current: DemoDatabase) => DemoDatabase)(previous)
            : value;
        currentDatabase.current = next;
        return next;
      });
    },
    [],
  );

  const flushPending = useCallback(async () => {
    if (
      writeInFlight.current ||
      !syncEnabled.current ||
      !documentReference.current ||
      !firebaseAuth.currentUser
    )
      return;
    const job = coordinator.current.takePending();
    if (!job) return;
    writeInFlight.current = true;
    try {
      await updateDoc(documentReference.current, {
        ...job.patch,
        updatedAt: serverTimestamp(),
        updatedBy: firebaseAuth.currentUser.uid,
      });
      coordinator.current.markPersisted(job.database);
      if (process.env.NODE_ENV !== 'production')
        console.debug(
          `[EventOS Firestore] persisted changed sections: ${Object.keys(job.patch).join(', ')}`,
        );
    } catch (error) {
      console.warn(
        'Firestore write failed; the local EventOS state is preserved.',
        error,
      );
    } finally {
      writeInFlight.current = false;
      if (mounted.current && coordinator.current.hasPending()) {
        writeTimer.current = window.setTimeout(
          () => void flushPending(),
          100,
        );
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let localDatabase = createDemoDatabase();
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) localDatabase = normalizeDemoDatabase(JSON.parse(saved));
    } catch {
      // Use the deterministic seed when local storage is unavailable or stale.
    }
    currentDatabase.current = localDatabase;
    coordinator.current = new FirestoreSyncCoordinator(localDatabase);
    setDatabaseState(localDatabase);

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    const connect = async () => {
      try {
        const credential = firebaseAuth.currentUser
          ? { user: firebaseAuth.currentUser }
          : await signInAnonymously(firebaseAuth);
        if (cancelled) return;

        const reference = doc(
          firestore,
          FIRESTORE_COLLECTION,
          FIRESTORE_DOCUMENT,
        );
        documentReference.current = reference;
        const snapshot = await getDoc(reference);
        if (cancelled) return;

        if (snapshot.exists()) {
          const rawRemote = snapshot.data().database as DemoDatabase | undefined;
          const remote = rawRemote ? normalizeDemoDatabase(rawRemote) : undefined;
          if (
            rawRemote &&
            remote &&
            coordinator.current.acceptRemote(
              rawRemote,
              currentDatabase.current,
            )
          ) {
            currentDatabase.current = remote;
            setDatabaseState(remote);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
          }
        } else {
          await setDoc(reference, {
            database: localDatabase,
            updatedAt: serverTimestamp(),
            updatedBy: credential.user.uid,
          });
          if (cancelled) return;
          coordinator.current.markPersisted(localDatabase);
        }

        const stop = onSnapshot(
          reference,
          (nextSnapshot) => {
            if (cancelled || nextSnapshot.metadata.hasPendingWrites) return;
            const rawRemote = nextSnapshot.data()?.database as
              | DemoDatabase
              | undefined;
            const remote = rawRemote
              ? normalizeDemoDatabase(rawRemote)
              : undefined;
            if (
              !rawRemote ||
              !remote ||
              !coordinator.current.acceptRemote(
                rawRemote,
                currentDatabase.current,
              )
            )
              return;
            currentDatabase.current = remote;
            setDatabaseState(remote);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
          },
          (error) => {
            if (!cancelled)
              console.warn(
                'Firestore listener unavailable; EventOS is using local persistence.',
                error,
              );
          },
        );
        if (cancelled) {
          stop();
          return;
        }
        unsubscribe = stop;
        syncEnabled.current = true;
      } catch (error) {
        if (!cancelled)
          console.warn(
            'Firestore sync unavailable; EventOS is using local persistence.',
            error,
          );
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void connect();

    return () => {
      cancelled = true;
      mounted.current = false;
      syncEnabled.current = false;
      documentReference.current = null;
      if (writeTimer.current !== null)
        window.clearTimeout(writeTimer.current);
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
    if (
      !syncEnabled.current ||
      !firebaseAuth.currentUser ||
      !coordinator.current.queueLocal(database)
    )
      return;

    if (writeTimer.current !== null) window.clearTimeout(writeTimer.current);
    writeTimer.current = window.setTimeout(
      () => void flushPending(),
      WRITE_DEBOUNCE_MS,
    );
    return () => {
      if (writeTimer.current !== null) window.clearTimeout(writeTimer.current);
    };
  }, [database, flushPending, hydrated]);

  const resetDatabase = () => {
    const seed = createDemoDatabase();
    setDatabase(seed);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  };

  return { database, setDatabase, resetDatabase, hydrated };
}
