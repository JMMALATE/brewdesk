import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function NoAccess() {
  const { logout } = useAuth();
  return (
    <div className="center-screen">
      <div className="card narrow">
        <h1>No staff access</h1>
        <p className="muted">
          You're signed in, but this account has no active staff profile. Ask the shop owner to add you.
        </p>
        <button className="btn btn-primary" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
}

/**
 * Guards a group of routes.
 * - Not signed in → /login
 * - Signed in without an active staff profile → "No staff access"
 * - `roles` given and the user's role isn't in it → home page for their role
 */
export default function ProtectedRoute({ roles }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="center-screen muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!role) return <NoAccess />;
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />;

  return <Outlet />;
}
