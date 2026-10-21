import { useEffect, useState } from 'react';
import {
  acceptAgencyInvitation,
  applyForAgency,
  getPendingAgencyInvitations,
  getProfile,
  joinAgency,
  rejectAgencyInvitation,
  requestAgencyRelease,
} from '../api.js';
import CameraFaceVerification from '../components/CameraFaceVerification.jsx';
import { Card, ErrorMessage, Loading, Page } from '../components/UI.jsx';

const roleIsAgent = (user) =>
  String(user?.role || '').toUpperCase() === 'AGENT' || user?.isAgent === true;

const roleIsHost = (user) =>
  String(user?.role || '').toUpperCase() === 'HOST' || user?.isHost === true;

const agencyIsApproved = (user) =>
  !user?.agencyStatus || String(user.agencyStatus).toUpperCase() === 'APPROVED';

export default function HostCenterScreen() {
  const [profile, setProfile] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [agencyId, setAgencyId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [experience, setExperience] = useState('');
  const [proof, setProof] = useState(null);
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
  const hasAgency = Boolean(profile?.agencyId);
  const isExistingHost = hasAgency && roleIsHost(profile);
  const canJoinAgency = !hasAgency && !isAgent;
  const canApplyToBecomeAgent = !isAgent;
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

  const applyToBecomeAgent = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!isExistingHost && !proof) {
      setStatus({ error: 'Attach a screenshot proving your Agent experience.', message: '', saving: false });
      return;
    }
    const application = new FormData();
    application.append('agencyName', agencyName.trim());
    application.append('phoneNumber', phoneNumber.trim());
    application.append('experience', experience.trim());
    if (proof) application.append('proof', proof);

    setStatus({ error: '', message: '', saving: true });
    try {
      const response = await applyForAgency(application);
      setStatus({ error: '', message: response.message || 'Agent application submitted.', saving: false });
      setAgencyName('');
      setExperience('');
      setProof(null);
      form.reset();
    } catch (error) {
      setStatus({ error: error.response?.data?.message || 'Could not submit the Agent application.', message: '', saving: false });
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
        <h2>{roleIsHost(profile) ? 'Your Host tools are ready' : 'Start hosting with an agency'}</h2>
        <p className="muted">Manage your agency membership and Agent applications.</p>
      </Card>

      {roleIsHost(profile) && profile.hostVerificationStatus !== 'APPROVED' && (
        <Card title="Host Face Verification" className="settings-card">
          {profile.hostVerificationStatus === 'PENDING_APPROVAL' && <p className="verification-pending" role="status">Verification Pending Approval</p>}
          <CameraFaceVerification onSubmitted={load} />
        </Card>
      )}

      {canJoinAgency && (
        <Card title="Join an Agency" className="settings-card">
          <form className="form-stack" onSubmit={join}>
            <label className="field"><span>Agency ID or code</span><input value={agencyId} onChange={(event) => setAgencyId(event.target.value)} placeholder="Enter an Agency ID or code" disabled={status.saving} required /></label>
            <button className="button button-primary" type="submit" disabled={status.saving}>{status.saving ? 'Joining…' : 'Join Agency'}</button>
          </form>
        </Card>
      )}

      {canApplyToBecomeAgent && (
        <Card title="Create / Become an Agent" className="settings-card">
          <p className="muted">
            {isExistingHost
              ? 'Your application will be sent to your current Agent for approval.'
              : 'Your application and proof will be sent to MESO LIVE Admin for review.'}
          </p>
          <form className="form-stack" onSubmit={applyToBecomeAgent}>
            <label className="field"><span>Agency Name</span><input value={agencyName} onChange={(event) => setAgencyName(event.target.value)} maxLength={100} required disabled={status.saving} /></label>
            <label className="field"><span>Phone / Contact Info</span><input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required disabled={status.saving} /></label>
            <label className="field"><span>Experience Description</span><textarea value={experience} onChange={(event) => setExperience(event.target.value)} maxLength={2000} rows={4} required disabled={status.saving} /></label>
            {!isExistingHost && (
              <label className="field">
                <span>Attach Proof / Screenshot of Agent Experience from other apps</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setProof(event.target.files?.[0] || null)}
                  required
                  disabled={status.saving}
                />
              </label>
            )}
            <button className="button button-primary" type="submit" disabled={status.saving}>{status.saving ? 'Submitting…' : 'Submit Agent Application'}</button>
          </form>
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
    </Page>
  );
}
