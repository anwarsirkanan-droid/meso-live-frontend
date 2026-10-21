import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { acceptAgencyInvitation, getPendingAgencyInvitations, getProfile, joinAgency, rejectAgencyInvitation } from '../api.js';
import CameraFaceVerification from '../components/CameraFaceVerification.jsx';
import { Card, ErrorMessage, Loading, Page } from '../components/UI.jsx';

export default function HostCenterScreen() {
  const [profile, setProfile] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [agencyId, setAgencyId] = useState('');
  const [status, setStatus] = useState({ error: '', message: '', saving: false });

  const load = async () => {
    try {
      const [user, pending] = await Promise.all([getProfile(), getPendingAgencyInvitations()]);
      setProfile(user);
      setInvitations(Array.isArray(pending) ? pending : pending.invitations || []);
    } catch (error) {
      setStatus({ error: error.response?.data?.message || error.message || 'Could not load Host Center.', message: '', saving: false });
    }
  };

  useEffect(() => { load(); }, []);

  const join = async (event) => {
    event.preventDefault();
    const trimmedAgencyId = agencyId.trim();
    setAgencyId(trimmedAgencyId);
    if (!trimmedAgencyId) return setStatus({ error: 'Enter an Agency ID or agency code.', message: '', saving: false });
    setStatus({ error: '', message: '', saving: true });
    try {
      await joinAgency(trimmedAgencyId);
      setAgencyId('');
      setStatus({ error: '', message: 'You joined the agency and Host access is now unlocked.', saving: false });
      await load();
    } catch (error) {
      setStatus({ error: error.response?.data?.message || 'Could not join the agency.', message: '', saving: false });
    }
  };

  const respond = async (invitation, action) => {
    setStatus({ error: '', message: '', saving: true });
    try {
      if (action === 'accept') await acceptAgencyInvitation(invitation._id);
      else await rejectAgencyInvitation(invitation._id);
      setInvitations((current) => current.filter((entry) => entry._id !== invitation._id));
      if (action === 'accept') {
        const user = await getProfile();
        setProfile(user);
      }
      setStatus({ error: '', message: action === 'accept' ? 'Agency invitation accepted. Host Tasks are unlocked.' : 'Agency invitation declined.', saving: false });
    } catch (error) {
      setStatus({ error: error.response?.data?.message || 'Could not respond to the agency invitation.', message: '', saving: false });
    }
  };

  if (!profile) return <Page title="Host Center" eyebrow="YOUR HOST JOURNEY"><Loading>Loading Host Center…</Loading></Page>;

  return (
    <Page title="Host Center" eyebrow="YOUR HOST JOURNEY">
      <Card className="host-center-hero">
        <p className="eyebrow">HOST ACCESS</p>
        <h2>{profile.isHost || profile.role === 'HOST' ? 'Your Host tools are ready' : 'Start hosting with an agency'}</h2>
        <p className="muted">Join an agency directly or respond to an invitation from an Agent.</p>
        {(profile.isHost || profile.role === 'HOST') && <Link className="button button-primary" to="/tasks">Open Host Tasks</Link>}
      </Card>

      {(profile.isHost || profile.role === 'HOST') && profile.hostVerificationStatus !== 'APPROVED' && (
        <Card title="Host Face Verification" className="settings-card">
          {profile.hostVerificationStatus === 'PENDING_APPROVAL' && <p className="verification-pending" role="status">Verification Pending Approval</p>}
          <CameraFaceVerification onSubmitted={load} />
        </Card>
      )}

      <Card title="Join an Agency" className="settings-card">
        <form className="form-stack" onSubmit={join}>
          <label className="field"><span>Agency ID or agency code</span><input value={agencyId} onChange={(event) => setAgencyId(event.target.value)} placeholder="Enter the ID shared by an Agent" disabled={Boolean(profile.agencyId) || status.saving} /></label>
          <button className="button button-primary" type="submit" disabled={Boolean(profile.agencyId) || status.saving}>{profile.agencyId ? 'Already in an agency' : status.saving ? 'Joining…' : 'Join agency'}</button>
        </form>
      </Card>

      <Card title={`Agency Invitations${invitations.length ? ` (${invitations.length})` : ''}`} className="settings-card">
        {invitations.length === 0 ? <p className="muted">No pending agency invitations.</p> : <div className="agency-invitation-list">{invitations.map((invitation) => <div className="agency-invitation-card" key={invitation._id}><div><strong>{invitation.agencyId?.agencyName || invitation.agencyId?.name || 'Agency'}</strong><p className="muted">Invited by {invitation.agentId?.name || invitation.agentId?.username || `Agent ${invitation.agentId?.publicId || ''}`}</p><small className="muted">Agency code: {invitation.agencyId?.agencyCode || '—'}</small></div><div className="agency-invitation-actions"><button className="button button-primary button-small" type="button" disabled={status.saving} onClick={() => respond(invitation, 'accept')}>Agree</button><button className="button button-secondary button-small" type="button" disabled={status.saving} onClick={() => respond(invitation, 'reject')}>Disagree</button></div></div>)}</div>}
      </Card>
      {status.message && <p className="success-message" role="status">{status.message}</p>}
      <ErrorMessage>{status.error}</ErrorMessage>
    </Page>
  );
}
