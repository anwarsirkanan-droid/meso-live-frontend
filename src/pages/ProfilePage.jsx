import { useEffect, useState } from 'react';
import { getProfile } from '../api.js';
import VerificationBadge from '../components/VerificationBadge.jsx';
import { Card, Loading, Page, PageLink } from '../components/UI.jsx';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getProfile()
      .then((data) => setProfile(data?.user || data))
      .catch((requestError) => setError(requestError.response?.data?.message || requestError.message));
  }, []);

  return (
    <Page title="My profile" eyebrow="YOUR MESO LIVE ACCOUNT">
      <Card className="profile-card">
        <div className="profile-avatar">{profile?.username?.[0]?.toUpperCase() || 'M'}</div>
        {error ? <p className="form-error">{error}</p> : !profile ? <Loading>Loading profile…</Loading> : (
          <>
            <h2>{profile.username || 'Meso Live member'}</h2>
            <p className="muted">{profile.email || 'Email not provided'}</p>
            <VerificationBadge verified={profile.isVerified === true || profile.verified === true} />
            <div className="stats-row">
              <div><strong>{profile.coins ?? 0}</strong><span>Coins</span></div>
              <div><strong>{profile.diamonds ?? 0}</strong><span>Diamonds</span></div>
            </div>
          </>
        )}
      </Card>
      <Card className="link-card">
        <PageLink to="/profile/settings" icon="⚙️">Settings</PageLink>
        <PageLink to="/profile/wallet" icon="💎">Host wallet</PageLink>
        <PageLink to="/profile/invite" icon="🎁">Invite friends</PageLink>
        <PageLink to="/profile/face-verify" icon="✓">Face verification</PageLink>
        <PageLink to="/profile/recharge" icon="🪙">Recharge coins</PageLink>
      </Card>
    </Page>
  );
}
