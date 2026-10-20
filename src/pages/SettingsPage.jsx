import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword, getProfile, linkGoogleAccount, updateAccountDetails } from '../api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { GoogleLogin } from '@react-oauth/google';
import { Card, ErrorMessage, Page } from '../components/UI.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
};

export default function SettingsPage() {
  const [animations, setAnimations] = useState(() => localStorage.getItem('animations') !== 'off');
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'English');
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('primaryColor') || '#7c3aed');
  const [profile, setProfile] = useState(() => readJson('user', null));
  const [privacy, setPrivacy] = useState(() => readJson('privacySettings', { profileVisible: true, showOnline: true }));
  const [blockedUsers, setBlockedUsers] = useState(() => readJson('blockedUsers', []));
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '', email: '', phoneNumber: '', blockEntry: '' });
  const [status, setStatus] = useState({ error: '', message: '', saving: false });
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    getProfile().then((user) => { setProfile(user); localStorage.setItem('user', JSON.stringify(user)); }).catch((error) => setStatus((current) => ({ ...current, error: error.response?.data?.message || error.message })));
  }, []);

  const closeModal = () => { setModal(null); setStatus({ error: '', message: '', saving: false }); };
  const updateAnimations = (enabled) => { setAnimations(enabled); localStorage.setItem('animations', enabled ? 'on' : 'off'); document.documentElement.dataset.animations = enabled ? 'on' : 'off'; };
  const updateLanguage = (value) => { setLanguage(value); localStorage.setItem('language', value); };
  const updatePrivacy = (key, value) => { const next = { ...privacy, [key]: value }; setPrivacy(next); localStorage.setItem('privacySettings', JSON.stringify(next)); };
  const openPassword = () => { setForm({ currentPassword: '', newPassword: '', confirmPassword: '', email: '', phoneNumber: '', blockEntry: '' }); setStatus({ error: '', message: '', saving: false }); setModal('password'); };
  const savePassword = async (event) => { event.preventDefault(); if (form.newPassword !== form.confirmPassword) return setStatus((current) => ({ ...current, error: 'Passwords do not match.' })); setStatus({ error: '', message: '', saving: true }); try { await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }); setStatus({ error: '', message: 'Password updated successfully.', saving: false }); setForm((current) => ({ ...current, currentPassword: '', newPassword: '', confirmPassword: '' })); } catch (error) { setStatus({ error: error.response?.data?.error || error.response?.data?.message || 'Could not update your password.', message: '', saving: false }); } };
  const openAccount = () => { setForm((current) => ({ ...current, email: profile?.email || '', phoneNumber: profile?.phoneNumber || '' })); setStatus({ error: '', message: '', saving: false }); setModal('account'); };
  const saveAccount = async (event) => { event.preventDefault(); setStatus({ error: '', message: '', saving: true }); try { const result = await updateAccountDetails({ email: form.email, phoneNumber: form.phoneNumber }); const user = result.user || result; setProfile(user); localStorage.setItem('user', JSON.stringify(user)); setStatus({ error: '', message: 'Account details updated successfully.', saving: false }); } catch (error) { setStatus({ error: error.response?.data?.message || 'Could not update your account details.', message: '', saving: false }); } };
  const addBlockedUser = (event) => { event.preventDefault(); const value = form.blockEntry.trim(); if (!value || blockedUsers.includes(value)) return; const next = [...blockedUsers, value]; setBlockedUsers(next); localStorage.setItem('blockedUsers', JSON.stringify(next)); setForm((current) => ({ ...current, blockEntry: '' })); };
  const removeBlockedUser = (value) => { const next = blockedUsers.filter((entry) => entry !== value); setBlockedUsers(next); localStorage.setItem('blockedUsers', JSON.stringify(next)); };
  const clearCache = () => { Object.keys(localStorage).filter((key) => key.startsWith('cache:')).forEach((key) => localStorage.removeItem(key)); sessionStorage.clear(); setStatus({ error: '', message: 'Cached app data cleared. Your account and preferences were kept.', saving: false }); };
  const handleLogout = () => { if (window.confirm('Sign out of Meso Live?')) { logout(); navigate('/login', { replace: true }); } };
  const handleGoogleLink = async ({ credential }) => { if (!credential) return setStatus((current) => ({ ...current, error: 'Google did not provide a credential. Please try again.' })); setStatus({ error: '', message: '', saving: true }); try { const result = await linkGoogleAccount(credential); if (result?.token) localStorage.setItem('token', result.token); if (result?.user) { localStorage.setItem('user', JSON.stringify(result.user)); setProfile(result.user); } setStatus({ error: '', message: 'Google account linked successfully.', saving: false }); } catch (error) { setStatus({ error: error.response?.data?.error || error.message, message: '', saving: false }); } };

  return (<Page title="Settings" eyebrow="MAKE MESO YOURS">
    <Card title="Account Management" className="settings-card">
      <button className="settings-action-row" type="button" onClick={openPassword}><span><strong>Set / Change Password</strong><small>Keep your account secure</small></span><span aria-hidden="true">›</span></button>
      <button className="settings-action-row" type="button" onClick={openAccount}><span><strong>Bind Phone Number / Email</strong><small>{profile?.email || 'Add an email'} · {profile?.phoneNumber || 'Add a phone number'}</small></span><span aria-hidden="true">›</span></button>
      <div className="settings-action-row settings-action-row-static"><span><strong>Linked Social Accounts</strong><small>{profile?.googleId ? 'Google account linked' : 'No social accounts linked'}</small></span>{profile?.googleId ? <span className="success-message">Linked</span> : <div className="google-button settings-google-button"><GoogleLogin onSuccess={handleGoogleLink} onError={() => setStatus((current) => ({ ...current, error: 'Google account linking could not be started.' }))} text="continue_with" shape="pill" width="180" /></div>}</div>
    </Card>
    <Card title="Preferences" className="settings-card">
      <div className="setting-row"><div><h3>Theme</h3><p className="muted">Choose light or dark mode</p></div><ThemeToggle /></div>
      <label className="setting-row"><div><h3>Primary color</h3><p className="muted">Your interface accent</p></div><input className="color-input" type="color" value={primaryColor} onChange={(event) => { setPrimaryColor(event.target.value); document.documentElement.style.setProperty('--accent', event.target.value); localStorage.setItem('primaryColor', event.target.value); }} /></label>
      <label className="setting-row"><div><h3>Animations</h3><p className="muted">Enable subtle motion effects</p></div><input type="checkbox" checked={animations} onChange={(event) => updateAnimations(event.target.checked)} /></label>
      <label className="setting-row"><div><h3>Language</h3><p className="muted">Choose your display language</p></div><select value={language} onChange={(event) => updateLanguage(event.target.value)}><option>English</option><option>Amharic</option><option>Oromo</option></select></label>
    </Card>
    <Card title="Privacy & Safety" className="settings-card">
      <label className="setting-row"><div><h3>Profile visibility</h3><p className="muted">Allow other users to view your profile</p></div><input type="checkbox" checked={privacy.profileVisible} onChange={(event) => updatePrivacy('profileVisible', event.target.checked)} /></label>
      <label className="setting-row"><div><h3>Show online status</h3><p className="muted">Let friends see when you are online</p></div><input type="checkbox" checked={privacy.showOnline} onChange={(event) => updatePrivacy('showOnline', event.target.checked)} /></label>
      <button className="settings-action-row" type="button" onClick={() => { setStatus({ error: '', message: '', saving: false }); setModal('blocklist'); }}><span><strong>Blocklist</strong><small>{blockedUsers.length} blocked account{blockedUsers.length === 1 ? '' : 's'}</small></span><span aria-hidden="true">›</span></button>
    </Card>
    <Card title="Support & Account" className="settings-card">
      <button className="settings-action-row" type="button" onClick={clearCache}><span><strong>Clear Cache</strong><small>Remove temporary app data</small></span><span aria-hidden="true">›</span></button>
      <button className="settings-action-row" type="button" onClick={() => window.alert('Meso Live\nVersion 1.0.0\n\nThank you for being part of our community.')}><span><strong>About</strong><small>Version and app information</small></span><span aria-hidden="true">›</span></button>
      <button className="settings-action-row settings-signout" type="button" onClick={handleLogout}><span><strong>Sign Out</strong><small>Sign out of this device</small></span><span aria-hidden="true">›</span></button>
    </Card>
    {status.message && <p className="success-message settings-feedback" role="status">{status.message}</p>}<ErrorMessage>{status.error}</ErrorMessage>
    {modal && <div className="settings-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="card settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title"><div className="settings-modal-heading"><h2 id="settings-modal-title">{modal === 'password' ? 'Change Password' : modal === 'account' ? 'Bind Contact Details' : 'Blocklist'}</h2><button className="button button-quiet" type="button" onClick={closeModal} aria-label="Close">×</button></div>
      {modal === 'password' && <form className="form-stack" onSubmit={savePassword}><label className="field"><span>Current password</span><input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} placeholder="Leave blank for first-time setup" /></label><label className="field"><span>New password</span><input type="password" required minLength="8" autoComplete="new-password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label><label className="field"><span>Confirm new password</span><input type="password" required minLength="8" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label><button className="button button-primary" disabled={status.saving} type="submit">{status.saving ? 'Saving…' : 'Update password'}</button></form>}
      {modal === 'account' && <form className="form-stack" onSubmit={saveAccount}><label className="field"><span>Email address</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label><label className="field"><span>Phone number</span><input type="tel" value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} placeholder="Your phone number" /></label><button className="button button-primary" disabled={status.saving} type="submit">{status.saving ? 'Saving…' : 'Save contact details'}</button></form>}
      {modal === 'blocklist' && <><form className="form-stack" onSubmit={addBlockedUser}><label className="field"><span>Username or user ID</span><input value={form.blockEntry} onChange={(event) => setForm({ ...form, blockEntry: event.target.value })} placeholder="Enter a username or ID" /></label><button className="button button-primary" type="submit">Add to blocklist</button></form><div className="blocked-list">{blockedUsers.length ? blockedUsers.map((value) => <div className="blocked-list-item" key={value}><span>{value}</span><button className="button button-quiet" type="button" onClick={() => removeBlockedUser(value)}>Unblock</button></div>) : <p className="muted">Your blocklist is empty.</p>}</div></>}
      <ErrorMessage>{status.error}</ErrorMessage>{status.message && <p className="success-message" role="status">{status.message}</p>}
    </section></div>}
  </Page>);
}
