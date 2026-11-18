export const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  BARISTA: 'barista',
};

export const ALL_STAFF = [ROLES.OWNER, ROLES.MANAGER, ROLES.BARISTA];
export const MANAGERS = [ROLES.OWNER, ROLES.MANAGER];

// Sidebar navigation. Modules from later roadmap phases are listed with `soon: true`.
export const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', roles: MANAGERS },
  { to: '/pos', label: 'POS', icon: '🧾', roles: ALL_STAFF },
  { to: '/orders', label: 'Orders', icon: '📋', roles: ALL_STAFF },
  { to: '/menu', label: 'Menu', icon: '☕', roles: MANAGERS },
  { label: 'Inventory', icon: '📦', roles: MANAGERS, soon: true },
  { label: 'Customers', icon: '⭐', roles: MANAGERS, soon: true },
  { to: '/staff', label: 'Staff', icon: '👥', roles: [ROLES.OWNER] },
];

export const homePathFor = (role) => (MANAGERS.includes(role) ? '/dashboard' : '/pos');
