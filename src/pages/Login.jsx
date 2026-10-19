import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api.js';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';
import { ErrorMessage, Field } from '../components/UI.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const finishLogin = (data) => {
    const token = data?.token || data?.accessToken;
    if (!token) throw new Error('The server did not return an authentication token.');
    localStorage.setItem('token', token);
    navigate(data?.user?.profileComplete ? '/' : '/profile-setup', { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      finishLogin(await login({ email, password }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/" className="brand auth-brand">Meso <span>Live</span></Link>
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Log in to your account</h1>
        <form className="form-stack" onSubmit={submit}>
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          <ErrorMessage>{error}</ErrorMessage>
          <button className="button button-primary button-full" type="submit" disabled={busy}>
            {busy ? 'Logging in…' : 'Login'}
          </button>
        </form>
        <div className="auth-divider"><span>or</span></div>
        <GoogleAuthButton
          onSuccess={(data) => navigate(data?.user?.profileComplete ? '/' : '/profile-setup', { replace: true })}
          onError={setError}
          onLoading={setBusy}
        />
        <p className="auth-switch">New to Meso Live? <Link to="/register">Sign Up</Link></p>
      </section>
    </main>
  );
}
