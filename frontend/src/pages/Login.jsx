import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.login({ email, password });
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div style={{ textAlign: 'center', padding: '2rem 0 1rem' }}>
        <i className="ti ti-flame" style={{ fontSize: 36, color: 'var(--text-accent)' }} aria-hidden="true" />
        <p style={{ fontWeight: 600, fontSize: 20, marginTop: 8 }}>Log in to Roomless</p>
      </div>
      <form onSubmit={onSubmit}>
        <div>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div>
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: '1rem' }}>
        No account? <Link to="/signup">Sign up</Link>
      </p>
      <p className="muted" style={{ marginTop: '1rem' }}>
        Seed test users: alice@test.dev / bob@test.dev / carla@test.dev / dev@test.dev / ellen@test.dev / frank@test.dev — password: password123
      </p>
    </div>
  );
}
