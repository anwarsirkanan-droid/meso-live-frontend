import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, getWallet } from '../api.js';
import GridMenu from '../components/GridMenu.jsx';
import ListMenu from '../components/ListMenu.jsx';
import ProfileHeader from '../components/ProfileHeader.jsx';
import WalletCards from '../components/WalletCards.jsx';
import { Card, Loading, Page } from '../components/UI.jsx';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    let active = true;
    getProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || requestError.message || 'Could not load your profile.');
      });

    getWallet().catch(() => null)
      .then((walletData) => {
        if (active) {
          setWallet(walletData);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const copyUserId = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus('User ID copied.');
    } catch {
      setCopyStatus('Could not copy Meso Live ID.');
    }
  };

  const roleAction = <Card className="role-menu-card"><h2>Become a Host</h2><p className="muted">Apply to host live rooms and earn diamonds.</p><button className="button button-primary" type="button" onClick={() => navigate('/host-application')}>Become a Host</button></Card>;

  return (
    <Page title="My profile" eyebrow="YOUR MESO LIVE ACCOUNT">
      {error ? <p className="form-error" role="alert">{error}</p> : !profile ? <Loading>Loading profile…</Loading> : (
        <>
          <ProfileHeader profile={profile} onCopy={copyUserId} />
          {copyStatus && <p className="profile-copy-status" role="status">{copyStatus}</p>}
          <WalletCards wallet={wallet || profile} />
          <GridMenu />
          <ListMenu />
          {roleAction}
        </>
      )}
    </Page>
  );
}
