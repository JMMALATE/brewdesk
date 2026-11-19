// Staff can log in with a username instead of an email.
// Firebase Auth needs an email, so a username is stored as an internal address
// like "ana@staff.brewdesk.local". Nothing is ever sent to it.
// Keep this domain the same as USERNAME_DOMAIN in api/_lib/staff.js.
export const USERNAME_DOMAIN = 'staff.brewdesk.local';

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** "ana" → "ana@staff.brewdesk.local"; real emails are returned unchanged. */
export function toLoginEmail(input) {
  const value = input.trim().toLowerCase();
  return value.includes('@') ? value : `${value}@${USERNAME_DOMAIN}`;
}

/** What to show for a staff member's login: their username, or their real email. */
export function loginLabel(member) {
  if (member.username) return member.username;
  const email = member.email ?? '';
  return email.endsWith(`@${USERNAME_DOMAIN}`) ? email.split('@')[0] : email;
}