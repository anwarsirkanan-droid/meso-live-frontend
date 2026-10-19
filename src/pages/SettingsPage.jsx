import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { Card, Page } from '../components/UI.jsx';

export default function SettingsPage() {
  const [animations, setAnimations] = useState(() => localStorage.getItem('animations') !== 'off');
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'English');
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('primaryColor') || '#7c3aed');
  const navigate = useNavigate();

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
    navigate('/login', { replace: true });
  };

  return (
    <Page title="Settings" eyebrow="MAKE MESO YOURS">
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
