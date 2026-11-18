import { useMemo, useState } from 'react';
import { collection, orderBy, query } from 'firebase/firestore';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { db } from '../firebase.js';
import { callApi } from '../lib/api.js';
import { useCollection } from '../hooks/useCollection.js';
import { formatDateTime } from '../lib/format.js';
import { ALL_STAFF } from '../lib/roles.js';

const createStaff = (data) => callApi('create-staff', data);
const updateStaff = (data) => callApi('update-staff', data);
const resetStaffPassword = (data) => callApi('reset-staff-password', data);

const ROLE_HELP = {
  owner: 'Everything, including staff accounts',
  manager: 'POS, menu, dashboard',
  barista: 'POS and orders only',
};

/** Readable temporary password, e.g. "brew-4821-latte". */
function generatePassword() {
  const words = ['brew', 'latte', 'mocha', 'bean', 'crema', 'roast', 'foam', 'shot'];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${pick()}-${digits}-${pick()}`;
}

export default function Staff() {
  const { user } = useAuth();
  const staffQuery = useMemo(() => query(collection(db, 'users'), orderBy('name')), []);
  const { docs: staff, loading, error: loadError } = useCollection(staffQuery);

  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function update(member, changes) {
    setError('');
    setBusyId(member.id);
    try {
      await updateStaff({ uid: member.id, ...changes });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function toggleActive(member) {
    const verb = member.active ? 'Deactivate' : 'Reactivate';
    const note = member.active ? ' They will be signed out and unable to log in.' : '';
    if (!window.confirm(`${verb} ${member.name}?${note}`)) return;
    update(member, { active: !member.active });
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Staff</h1>
          <p className="muted">Only the owner can create accounts. There is no public sign-up.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Add staff
        </button>
      </header>

      {(error || loadError) && <div className="alert">{error || loadError.message}</div>}

      <section className="card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => {
                const isMe = member.id === user?.uid;
                const busy = busyId === member.id;
                return (
                  <tr key={member.id} className={member.active ? '' : 'dimmed'}>
                    <td>
                      {member.name}
                      {isMe && <span className="muted small"> (you)</span>}
                    </td>
                    <td>{member.email}</td>
                    <td>
                      <select
                        className="input input-sm"
                        value={member.role}
                        disabled={isMe || busy}
                        onChange={(e) => update(member, { role: e.target.value })}
                        aria-label={`Role for ${member.name}`}
                      >
                        {ALL_STAFF.map((r) => (
                          <option key={r} value={r}>
                            {r[0].toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`pill ${member.active ? 'pill-cash' : 'pill-warn'}`}>
                        {member.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="muted small">{formatDateTime(member.createdAt)}</td>
                    <td className="actions">
                      <button
                        className="btn btn-ghost small"
                        disabled={busy}
                        onClick={() => setResetting(member)}
                      >
                        Reset password
                      </button>
                      {!isMe && (
                        <button
                          className={`btn btn-ghost small${member.active ? ' danger' : ''}`}
                          disabled={busy}
                          onClick={() => toggleActive(member)}
                        >
                          {member.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {adding && <AddStaffModal onClose={() => setAdding(false)} />}
      {resetting && <ResetPasswordModal member={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function AddStaffModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'barista', password: generatePassword() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e) {
    e.preventDefault();
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    setSaving(true);
    setError('');
    try {
      await createStaff({ ...form, name: form.name.trim(), email: form.email.trim() });
      setCreated(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <Modal
        title="Account created"
        onClose={onClose}
        footer={
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        }
      >
        <p>Give these login details to {created.name}:</p>
        <div className="credentials">
          <div>
            <span className="muted small">Email</span>
            <strong>{created.email}</strong>
          </div>
          <div>
            <span className="muted small">Temporary password</span>
            <strong>{created.password}</strong>
          </div>
        </div>
        <p className="muted small">The password won't be shown again. You can reset it later from the Staff page.</p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Add staff member"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="staff-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create account'}
          </button>
        </>
      }
    >
      <form id="staff-form" className="stack" onSubmit={submit}>
        <label className="field">
          <span>Full name</span>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>Email (used to log in)</span>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Role</span>
          <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
            {ALL_STAFF.map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)} — {ROLE_HELP[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Temporary password</span>
          <div className="row">
            <input
              className="input"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              minLength={8}
              required
            />
            <button type="button" className="btn btn-ghost" onClick={() => set('password', generatePassword())}>
              New
            </button>
          </div>
        </label>
        {error && <div className="alert">{error}</div>}
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ member, onClose }) {
  const [password, setPassword] = useState(generatePassword);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setSaving(true);
    setError('');
    try {
      await resetStaffPassword({ uid: member.id, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Reset password — ${member.name}`}
      onClose={onClose}
      footer={
        done ? (
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" form="reset-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Set password'}
            </button>
          </>
        )
      }
    >
      {done ? (
        <div className="credentials">
          <div>
            <span className="muted small">New password for {member.email}</span>
            <strong>{password}</strong>
          </div>
        </div>
      ) : (
        <form id="reset-form" className="stack" onSubmit={submit}>
          <label className="field">
            <span>New password</span>
            <div className="row">
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <button type="button" className="btn btn-ghost" onClick={() => setPassword(generatePassword())}>
                New
              </button>
            </div>
          </label>
          {error && <div className="alert">{error}</div>}
        </form>
      )}
    </Modal>
  );
}
