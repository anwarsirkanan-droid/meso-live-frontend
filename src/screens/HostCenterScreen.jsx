import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  acceptAgencyInvitation,
  getPendingAgencyInvitations,
  getProfile,
  joinAgency,
  rejectAgencyInvitation,
  requestAgencyRelease,
} from '../api.js';
import CameraFaceVerification from '../components/CameraFaceVerification.jsx';
import CreateAgencyModal from '../components/CreateAgencyModal.jsx';
import { Card, ErrorMessage, Loading, Page } from '../components/UI.jsx';

const roleIsAgent = (user) =>
  String(user?.role || '').toUpperCase() === 'AGENT' || user?.isAgent === true;

const roleIsHost = (user) =>
  String(user?.role || '').toUpperCase() === 'HOST' || user?.isHost === true;

const agencyIsApproved = (user) =>
  !user?.agencyStatus || String(user.agencyStatus).toUpperCase() === 'APPROVED';

const isAgencyOwner = (user) =>
  user?.isAgencyOwner === true || user?.role === 'AGENT_OWNER' || user?.ownedAgency;

export default function HostCenterScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [agencyId, setAgencyId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [agencyModalOpen, setAgencyModalOpen] = useState(false);
  const [releasePending, setReleasePending] = useState(false);
  const [status, setStatus] = useState({ error: '', message: '', saving: false });

  const load = async () => {
    try {
      const [user, pending] = await Promise.all([getProfile(), getPendingAgencyInvitations()]);
      setProfile(user);
      setPhoneNumber(user.phoneNumber || '');
      setInvitations(Array.isArray(pending) ? pending : pending.invitations || []);
    } catch (error) {
      setStatus({ error: error.response?.data?.message || error.message || 'Could not load Host Center.', message: '', saving: false });
    }
  };

  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []);

  const isAgent = roleIsAgent(profile);
  const isOwner = isAgencyOwner(profile);
  const hasAgency = Boolean(profile?.agencyId);
  const canJoinAgency = !hasAgency && !isAgent && !isOwner;
  const canApplyToBecomeAgent = !isAgent && !isOwner;
  const canRequestRelease = hasAgency && !isAgent && roleIsHost(profile) && agencyIsApproved(profile);

  const join = async (event) => {
    event.preventDefault();
    const trimmedAgencyId = agencyId.trim();
    setAgencyId(trimmedAgencyId);
    if (!trimmedAgencyId) {
      setStatus({ error: 'Enter an Agency ID or agency code.', message: '', saving: false });
      return;
    }
    setStatus({ error: '', message: '', saving: true });
    try {
      const result = await joinAgency(trimmedAgencyId);
      setProfile((current) => ({ ...current, ...result.user, agencyId: result.agencyId }));
      setAgencyId('');
      setStatus({ error: '', message: 'You joined the agency.', saving: false });
    } catch (error) {
      setStatus({ error: error.response?.data?.message || 'Could not join the agency.', message: '', saving: false });
    }
  };

  const leaveAgency = async () => {
    setStatus({ error: '', message: '', saving: true });
    try {
      const response = await requestAgencyRelease();
      setReleasePending(true);
      setStatus({ error: '', message: response.message || 'Agency release request submitted for Agent approval.', saving: false });
    } catch (error) {
      setStatus({ error: error.response?.data?.message || 'Could not submit the release request.', message: '', saving: false });
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
      setStatus({ error: '', message: action === 'accept' ? 'Agency invitation accepted.' : 'Agency invitation declined.', saving: false });
    } catch (error) {
      setStatus({ error: error.response?.data?.message || 'Could not respond to the agency invitation.', message: '', saving: false });
    }
  };

  if (!profile) return <Page title="Host Center" eyebrow="YOUR HOST JOURNEY"><Loading>Loading Host Center…</Loading></Page>;

  return (
    <Page title="Host Center" eyebrow="YOUR HOST JOURNEY">
      <Card className="host-center-hero">
        <p className="eyebrow">HOST ACCESS</p>
        <h2>{isOwner ? 'Agency Owner Dashboard' : (roleIsHost(profile) ? 'Your Host tools are ready' : 'Start hosting with an agency')}</h2>
        <p className="muted">{isOwner ? 'Manage your agency and hosts.' : 'Manage your agency membership and Agent applications.'}</p>
      </Card>

      {isOwner && (
        <Card title="Agency Owner Actions" className="settings-card">
          <p className="muted">As an Agency Owner, you have full control over your agency.</p>
          <button className="button button-primary" type="button" onClick={() => navigate('/agency-dashboard')}>
            Go to Agency Dashboard
          </button>
        </Card>
      )}

      {roleIsHost(profile) && profile.hostVerificationStatus !== 'APPROVED' && (
        <Card title="Host Face Verification" className="settings-card">
          {profile.hostVerificationStatus === 'PENDING_APPROVAL' && <p className="verification-pending" role="status">Verification Pending Approval</p>}
          <CameraFaceVerification onSubmitted={load} />
        </Card>
      )}

      {!isOwner && canJoinAgency && (
        <Card title="Join an Agency" className="settings-card">
          <form className="form-stack" onSubmit={join}>
            <label className="field"><span>Agency ID or code</span><input value={agencyId} onChange={(event) => setAgencyId(event.target.value)} placeholder="Enter an Agency ID or code" disabled={status.saving} required /></label>
            <button className="button button-primary" type="submit" disabled={status.saving}>{status.saving ? 'Joining…' : 'Join Agency'}</button>
          </form>
        </Card>
      )}

      {!isOwner && canApplyToBecomeAgent && (
        <Card title="Create / Become an Agent" className="settings-card">
          <p className="muted">Submit one agency application for approval.</p>
          <button className="button button-primary" type="button" onClick={() => setAgencyModalOpen(true)}>
            Create / Become an Agent
          </button>
        </Card>
      )}

      {canRequestRelease && (
        <Card title="Request Agency Release / Leave Agency" className="settings-card">
          <p className="muted">Your request will be sent to your current Agent for approval.</p>
          <p className="verification-pending" role="note">Auto-releases after 7 days of agent inactivity.</p>
          <button className="button button-secondary" type="button" onClick={leaveAgency} disabled={status.saving || releasePending}>
            {releasePending ? 'Release request pending' : status.saving ? 'Submitting…' : 'Request Agency Release'}
          </button>
        </Card>
      )}

      <Card title={`Agency Invitations${invitations.length ? ` (${invitations.length})` : ''}`} className="settings-card">
        {invitations.length === 0 ? <p className="muted">No pending agency invitations.</p> : <div className="agency-invitation-list">{invitations.map((invitation) => <div className="agency-invitation-card" key={invitation._id}><div><strong>{invitation.agencyId?.agencyName || invitation.agencyId?.name || 'Agency'}</strong><p className="muted">Invited by {invitation.agentId?.name || invitation.agentId?.username || `Agent ${invitation.agentId?.publicId || ''}`}</p><small className="muted">Agency code: {invitation.agencyId?.agencyCode || '—'}</small></div><div className="agency-invitation-actions"><button className="button button-primary button-small" type="button" disabled={status.saving} onClick={() => respond(invitation, 'accept')}>Agree</button><button className="button button-secondary button-small" type="button" disabled={status.saving} onClick={() => respond(invitation, 'reject')}>Disagree</button></div></div>)}</div>}
      </Card>
      {status.message && <p className="success-message" role="status">{status.message}</p>}
      <ErrorMessage>{status.error}</ErrorMessage>
      {agencyModalOpen && (
        <CreateAgencyModal
          isExistingHost={Boolean(profile.agencyId)}
          initialContact={phoneNumber}
          onClose={() => setAgencyModalOpen(false)}
          onSuccess={(message) => {
            setAgencyModalOpen(false);
            setStatus({ error: '', message, saving: false });
          }}
        />
      )}
    </Page>
  );
}
