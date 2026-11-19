import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin SDK for the server-side API routes.
 *
 * - Local dev (emulators): no credentials needed. vite.config.js sets FIRESTORE_EMULATOR_HOST.
 * - Vercel: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY
 *   (from Firebase console > Project settings > Service accounts > Generate new private key).
 */
/** Accepts the key with or without surrounding quotes and with "\n" or real line breaks. */
function normalizePrivateKey(raw) {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, '\n').replace(/\r/g, '');
  if (!key.includes('-----BEGIN PRIVATE KEY-----') || !key.includes('-----END PRIVATE KEY-----')) {
    throw new Error('FIREBASE_PRIVATE_KEY is incomplete: it must include the BEGIN and END PRIVATE KEY lines.');
  }
  return key;
}

function init() {
  if (getApps().length) return getApps()[0];

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-brewdesk' });
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
    );
  }

  return initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // Env vars store the key's line breaks as "\n" — turn them back into real ones.
      privateKey: normalizePrivateKey(FIREBASE_PRIVATE_KEY),
    }),
  });
}

const app = init();
export const db = getFirestore(app);
export const adminAuth = getAuth(app);
