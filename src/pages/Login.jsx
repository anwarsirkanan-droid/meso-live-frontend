import { useState } from 'react';
import { ArrowLeft, Mail, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api.js';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';
import { ErrorMessage, Field } from '../components/UI.jsx';

export default function Login() {
  const [method, setMethod] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const finishLogin = (data) => {
    const token = data?.token || data?.accessToken;
    if (!token) throw new Error('The server did not return an authentication token.');
    localStorage.setItem('token', token);
    if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));
    navigate(data?.user?.profileComplete ? '/' : '/profile-setup', { replace: true });
  };

  const selectMethod = (nextMethod) => {
    setMethod(nextMethod);
    setIdentifier('');
    setPassword('');
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const credentials = method === 'mail'
        ? { email: identifier, password }
        : { username: identifier, password };
      finishLogin(await login(credentials));
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card login-auth-card">
        <Link to="/" className="brand auth-brand">Meso <span>Live</span></Link>
        <p className="eyebrow">WELCOME BACK</p>
        <h1>{method ? (method === 'mail' ? 'Sign in with Mail' : 'Log in with account') : 'Sign in to Meso Live'}</h1>
        <p className="login-intro">
          {method ? 'Enter your details to continue.' : 'Choose how you would like to continue.'}
        </p>

        {method ? (
          <>
            <button
              className="login-back-button"
              type="button"
              onClick={() => selectMethod('')}
              disabled={busy}
            >
              <ArrowLeft size={17} aria-hidden="true" />
              Back to sign-in options
            </button>
            <form className="form-stack login-form" onSubmit={submit}>
              <Field
                label={method === 'mail' ? 'Email address' : 'User ID'}
                type={method === 'mail' ? 'email' : 'text'}
                autoComplete={method === 'mail' ? 'email' : 'username'}
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
              <Field
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <ErrorMessage>{error}</ErrorMessage>
              <button className="button button-primary button-full login-submit" type="submit" disabled={busy}>
                {busy ? 'Logging in…' : 'Log in'}
              </button>
            </form>
            <div className="login-switch-methods">
              {method === 'mail' ? (
                <button type="button" onClick={() => selectMethod('account')} disabled={busy}>
                  Use your User ID instead
                </button>
              ) : (
                <button type="button" onClick={() => selectMethod('mail')} disabled={busy}>
                  Sign in with Mail instead
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="login-methods">
            <div className="login-google">
              <GoogleAuthButton
                onSuccess={(data) => navigate(data?.user?.profileComplete ? '/' : '/profile-setup', { replace: true })}
                onError={setError}
                onLoading={setBusy}
              />
            </div>
            <button
              className="login-method-button"
              type="button"
              onClick={() => selectMethod('mail')}
              disabled={busy}
            >
              <Mail className="login-method-icon" size={20} aria-hidden="true" />
              <span>Sign in with Mail</span>
            </button>
            <button
              className="login-method-button"
              type="button"
              onClick={() => selectMethod('account')}
              disabled={busy}
            >
              <UserRound className="login-method-icon" size={20} aria-hidden="true" />
              <span>Log in with account</span>
            </button>
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}

        <p className="auth-switch">New to Meso Live? <Link to="/register">Sign Up</Link></p>
      </section>
    </main>
  );
}
