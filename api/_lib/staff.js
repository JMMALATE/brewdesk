import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, db } from './firebaseAdmin.js';
import { ApiError, STAFF_ROLES } from './http.js';

// Staff accounts — only the owner can create or change them (enforced in the route files).
// Accounts are created with the Admin SDK: no sign-up page and no verification email.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Username logins are stored as an internal email. Keep in sync with src/lib/username.js.
const USERNAME_DOMAIN = 'staff.brewdesk.local';
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** Returns { email, username } from either a username or a real email. */
function cleanLogin(data) {
  if (typeof data.username === 'string' && data.username.trim()) {
    const username = data.username.trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      throw new ApiError(400, 'Username must be 3–30 characters: letters, numbers, dot, dash or underscore.');
    }
    return { email: `${username}@${USERNAME_DOMAIN}`, username };
  }
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Enter a valid email address or a username.');
  return { email, username: null };
}

function cleanName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 80) throw new ApiError(400, 'Enter a name (up to 80 characters).');
  return name;
}

function cleanRole(value) {
  if (!STAFF_ROLES.includes(value)) throw new ApiError(400, 'Choose a valid role.');
  return value;
}

function cleanPassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters.');
  }
  return value;
}

function cleanUid(value) {
  if (typeof value !== 'string' || !value) throw new ApiError(400, 'Missing staff ID.');
  return value;
}

export async function createStaff({ user: owner, data }) {
  const name = cleanName(data.name);
  const role = cleanRole(data.role);
  const password = cleanPassword(data.password);
  const { email, username } = cleanLogin(data);

  let created;
  try {
    // emailVerified: true — the owner vouches for the account, so no verification email.
    created = await adminAuth.createUser({ email, password, displayName: name, emailVerified: true });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new ApiError(409, username ? 'That username is already taken.' : 'An account with this email already exists.');
    }
    throw err;
  }

  await db.doc(`users/${created.uid}`).set({
    name,
    email,
    username,
    role,
    active: true,
    createdBy: owner.id,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { uid: created.uid };
}

export async function updateStaff({ user: owner, data }) {
  const uid = cleanUid(data.uid);
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ApiError(404, 'Staff member not found.');

  const updates = {};
  if (data.name !== undefined) updates.name = cleanName(data.name);
  if (data.role !== undefined) updates.role = cleanRole(data.role);
  if (data.active !== undefined) updates.active = Boolean(data.active);

  // Stop the owner from locking themselves out.
  if (uid === owner.id && ((updates.role && updates.role !== 'owner') || updates.active === false)) {
    throw new ApiError(400, "You can't remove your own owner access.");
  }
  if (Object.keys(updates).length === 0) return { ok: true };

  const authUpdates = {};
  if (updates.name) authUpdates.displayName = updates.name;
  if (updates.active !== undefined) authUpdates.disabled = !updates.active;
  if (Object.keys(authUpdates).length) await adminAuth.updateUser(uid, authUpdates);
  if (updates.active === false) await adminAuth.revokeRefreshTokens(uid); // sign them out everywhere

  await ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
}

export async function resetStaffPassword({ data }) {
  const uid = cleanUid(data.uid);
  const password = cleanPassword(data.password);
  try {
    await adminAuth.updateUser(uid, { password });
  } catch (err) {
    if (err.code === 'auth/user-not-found') throw new ApiError(404, 'Staff member not found.');
    throw err;
  }
  return { ok: true };
}
