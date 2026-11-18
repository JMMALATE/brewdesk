import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { NAV } from '../lib/roles.js';

export default function Layout() {
  const { profile, role, logout } = useAuth();
  const links = NAV.filter((link) => link.roles.includes(role));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">☕</span> BrewDesk
        </div>

        <nav className="nav">
          {links.map((link) =>
            link.soon ? (
              <span key={link.label} className="nav-link disabled" title="Coming in a later phase">
                <span className="nav-icon">{link.icon}</span>
                {link.label}
                <span className="badge">Soon</span>
              </span>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{link.icon}</span>
                {link.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-name">{profile?.name}</div>
          <div className="user-role">{role}</div>
          <button className="btn btn-ghost btn-block" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
