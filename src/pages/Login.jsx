import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { NoAccess } from '../components/ProtectedRoute.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Created by `npm run seed` (emulator only).
const DEMO_ACCOUNTS = [
  { label: 'Owner', email: 'owner@brewdesk.demo' },
  { label: 'Manager', email: 'manager@brewdesk.demo' },
  { label: 'Barista', email: 'barista@brewdesk.demo' },
];
const DEMO_PASSWORD = 'demo1234';
const showDemo = import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true';

function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return "Can't reach the server. Are the Firebase emulators running?";
    default:
      return 'Sign-in failed. Please try again.';
  }
}

export default function Login() {
  const { user, role, loading, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user && loading) return <div className="center-screen muted">Signing in…</div>;
  if (user && role) return <Navigate to={location.state?.from?.pathname || '/'} replace />;
  if (user && !role) return <NoAccess />;

  async function signIn(emailValue, passwordValue) {
    setError('');
    setBusy(true);
    try {
      await login(emailValue.trim(), passwordValue);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen login-bg">
      <div className="card narrow">
        <div className="brand brand-lg">
          <span className="brand-mark">☕</span> BrewDesk
        </div>
        <p className="muted">Coffee shop management — sign in to continue.</p>

        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            signIn(email, password);
          }}
        >
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="alert">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {showDemo && (
          <div className="demo-box">
            <div className="muted small">Try the demo as</div>
            <div className="row">
              {DEMO_ACCOUNTS.map((acct) => (
                <button
                  key={acct.email}
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => signIn(acct.email, DEMO_PASSWORD)}
                >
                  {acct.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
