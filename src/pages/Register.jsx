import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, register } from '../api.js';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';
import { ErrorMessage, Field } from '../components/UI.jsx';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const saveToken = (data) => {
    const token = data?.token || data?.accessToken;
    if (!token) return false;
    localStorage.setItem('token', token);
    return true;
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await register({ username, email, password });
      if (!saveToken(result)) {
        const loginResult = await login({ email, password });
        if (!saveToken(loginResult)) {
          throw new Error('Registration succeeded but the server did not return an authentication token.');
        }
      }
      navigate('/', { replace: true });
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
        <p className="eyebrow">JOIN THE COMMUNITY</p>
        <h1>Create your account</h1>
        <form className="form-stack" onSubmit={submit}>
          <Field label="Username" type="text" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} />
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <Field label="Password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          <ErrorMessage>{error}</ErrorMessage>
          <button className="button button-primary button-full" type="submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>
        <div className="auth-divider"><span>or</span></div>
        <GoogleAuthButton
          onSuccess={() => navigate('/', { replace: true })}
          onError={setError}
          onLoading={setBusy}
        />
        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
      </section>
    </main>
  );
}
