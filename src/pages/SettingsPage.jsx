import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, linkGoogleAccount } from '../api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { GoogleLogin } from '@react-oauth/google';
import { Card, ErrorMessage, Page } from '../components/UI.jsx';

export default function SettingsPage() {
  const [animations, setAnimations] = useState(() => localStorage.getItem('animations') !== 'off');
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'English');
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('primaryColor') || '#7c3aed');
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });
  const [linkError, setLinkError] = useState('');
  const [linkMessage, setLinkMessage] = useState('');
  const [linking, setLinking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getProfile()
      .then((data) => {
        const user = data?.user || data;
        setProfile(user);
        localStorage.setItem('user', JSON.stringify(user));
      })
      .catch((error) => {
        setLinkError(error.response?.data?.message || error.message);
      });
  }, []);

  const updateAnimations = (enabled) => {
    setAnimations(enabled);
    localStorage.setItem('animations', enabled ? 'on' : 'off');
    document.documentElement.dataset.animations = enabled ? 'on' : 'off';
  };

  const updateLanguage = (value) => {
    setLanguage(value);
    localStorage.setItem('language', value);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const handleGoogleLink = async ({ credential }) => {
    if (!credential) {
      setLinkError('Google did not provide a credential. Please try again.');
      return;
    }
    setLinking(true);
    setLinkError('');
    setLinkMessage('');
    try {
      const result = await linkGoogleAccount(credential);
      if (result?.token) localStorage.setItem('token', result.token);
      if (result?.user) {
        localStorage.setItem('user', JSON.stringify(result.user));
        setProfile(result.user);
      }
      setLinkMessage('Google account linked successfully.');
    } catch (error) {
      setLinkError(error.response?.data?.error || error.response?.data?.message || error.message);
    } finally {
      setLinking(false);
    }
  };

  return (
    <Page title="Settings" eyebrow="MAKE MESO YOURS">
      <Card title="Link Google Account">
        {profile?.googleId
          ? <p className="success-message">Google account linked</p>
          : (
            <>
              <p className="muted">Link Google to sign in to this account with Google.</p>
              <div className="google-button">
                <GoogleLogin
                  onSuccess={handleGoogleLink}
                  onError={() => setLinkError('Google account linking could not be started. Please try again.')}
                  text="continue_with"
                  shape="pill"
                  width="320"
                />
              </div>
              {linking && <p className="muted" role="status">Linking Google account…</p>}
              {linkMessage && <p className="success-message" role="status">{linkMessage}</p>}
              <ErrorMessage>{linkError}</ErrorMessage>
            </>
          )}
      </Card>
      <Card title="Appearance" className="settings-card">
        <div className="setting-row"><div><h3>Theme</h3><p className="muted">Choose light or dark mode</p></div><ThemeToggle /></div>
        <label className="setting-row">
          <div><h3>Primary color</h3><p className="muted">Your interface accent</p></div>
          <input className="color-input" type="color" value={primaryColor} onChange={(event) => {
            setPrimaryColor(event.target.value);
            document.documentElement.style.setProperty('--accent', event.target.value);
            localStorage.setItem('primaryColor', event.target.value);
          }} />
        </label>
        <label className="setting-row">
          <div><h3>Animations</h3><p className="muted">Enable subtle motion effects</p></div>
          <input type="checkbox" checked={animations} onChange={(event) => updateAnimations(event.target.checked)} />
        </label>
        <label className="setting-row">
          <div><h3>Language</h3><p className="muted">Choose your display language</p></div>
          <select value={language} onChange={(event) => updateLanguage(event.target.value)}>
            <option>English</option><option>Amharic</option><option>Oromo</option>
          </select>
        </label>
      </Card>
      <button className="button button-danger button-full" type="button" onClick={logout}>Log out</button>
    </Page>
  );
}
