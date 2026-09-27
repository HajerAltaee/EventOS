'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase web configuration identifies the project and is intentionally public.
// Authentication and Firestore rules enforce access; no server secret is present.
const firebaseConfig = {
  apiKey: 'AIzaSyC14L6pNmw60Y34jYiOoTGmw47XJ_vNEuM',
  authDomain: 'eventos-5fabb.firebaseapp.com',
  projectId: 'eventos-5fabb',
  storageBucket: 'eventos-5fabb.firebasestorage.app',
  messagingSenderId: '459362580978',
  appId: '1:459362580978:web:fa5602d987b6d9aac7d36b',
  measurementId: 'G-0FPXR1939G',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
