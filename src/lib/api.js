import { auth } from '../firebase.js';

/**
 * Calls one of the server routes in /api with the signed-in user's Firebase ID token.
 * Returns the JSON result, or throws an Error with a message that's safe to show.
 */
export async function callApi(name, data = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in.');
  const token = await user.getIdToken();

  let res;
  try {
    res = await fetch(`/api/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status}).`);
  return body;
}
