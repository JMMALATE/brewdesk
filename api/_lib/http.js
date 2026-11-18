import { adminAuth, db } from './firebaseAdmin.js';

export const STAFF_ROLES = ['owner', 'manager', 'barista'];

/** An error whose message is safe to show to the user. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  // Vercel parses JSON bodies for us; the local Vite dev server doesn't.
  try {
    if (req.body !== undefined) {
      return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    }
  } catch {
    throw new ApiError(400, 'Invalid request.');
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new ApiError(400, 'Invalid request.');
  }
}

/** Checks the Firebase ID token and the staff profile. Returns the staff member. */
async function requireStaff(req, roles) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Please sign in.');

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token, true); // true = reject signed-out / disabled users
  } catch {
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  const snap = await db.doc(`users/${decoded.uid}`).get();
  const profile = snap.data();
  if (!profile?.active || !roles.includes(profile.role)) {
    throw new ApiError(403, 'Your account is not allowed to do this.');
  }
  return { id: snap.id, ...profile };
}

/**
 * Wraps an API route: POST only, signed-in staff with one of `roles`, JSON in and out.
 * The route function receives { user, data } and returns a JSON-able result.
 */
export function route(fn, { roles = STAFF_ROLES } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
    try {
      const user = await requireStaff(req, roles);
      const data = await readBody(req);
      const result = await fn({ user, data: data && typeof data === 'object' ? data : {} });
      send(res, 200, result ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) return send(res, err.status, { error: err.message });
      console.error(err);
      send(res, 500, { error: 'Something went wrong on the server.' });
    }
  };
}
