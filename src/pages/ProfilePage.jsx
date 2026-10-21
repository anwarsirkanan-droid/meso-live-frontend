import { useEffect, useState } from 'react';
import { getProfile, getWallet } from '../api.js';
import GridMenu from '../components/GridMenu.jsx';
import ListMenu from '../components/ListMenu.jsx';
import ProfileHeader from '../components/ProfileHeader.jsx';
import WalletCards from '../components/WalletCards.jsx';
import { Card, Loading, Page, PageLink } from '../components/UI.jsx';

export default function ProfilePage() {
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

  return (
    <Page title="My profile" eyebrow="YOUR MESO LIVE ACCOUNT">
      {error ? <p className="form-error" role="alert">{error}</p> : !profile ? <Loading>Loading profile…</Loading> : (
        <>
          <ProfileHeader profile={profile} onCopy={copyUserId} />
          {copyStatus && <p className="profile-copy-status" role="status">{copyStatus}</p>}
          <WalletCards wallet={wallet || profile} />
          <GridMenu />
          <ListMenu />
          <Card title="Host Center" className="host-center-entry"><p className="muted">Join an agency, review invitations, and unlock Host Tasks.</p><PageLink to="/host-center">Open Host Center</PageLink></Card>
        </>
      )}
    </Page>
  );
}
