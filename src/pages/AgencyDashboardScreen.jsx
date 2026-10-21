import { useEffect, useState } from 'react';
import { getAgencyDashboard, getPendingFaceVerifications, reviewFaceVerification, searchAgencyUser, sendAgencyInvitation } from '../api.js';
import { Card, Loading, Page } from '../components/UI.jsx';

const number = (value) => (Number(value) || 0).toLocaleString();
const percent = (value, target) => Math.min(100, target > 0 ? (Number(value) / Number(target)) * 100 : 0);

function Progress({ label, value, target, unit }) {
  const progress = percent(value, target);
  return (
    <div className="agency-target-progress">
      <div className="agency-target-label"><span>{label}</span><span>{number(value)} / {number(target)} {unit}</span></div>
      <div className="profile-progress-track" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function AgencyDashboardScreen() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [publicId, setPublicId] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [inviteStatus, setInviteStatus] = useState({ error: '', message: '', loading: false });
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [reviewingVerification, setReviewingVerification] = useState('');

  useEffect(() => {
    Promise.all([getAgencyDashboard(), getPendingFaceVerifications()]).then(([agencyData, verificationData]) => {
      setDashboard(agencyData);
      setPendingVerifications(verificationData.verifications || []);
    }).catch((requestError) => {
      setError(requestError.response?.data?.message || requestError.message || 'Could not load the agency dashboard.');
    });
  }, []);

  const reviewVerification = async (verificationId, status) => {
    setReviewingVerification(verificationId);
    try {
      await reviewFaceVerification(verificationId, status);
      setPendingVerifications((current) => current.filter((item) => item._id !== verificationId));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not review the face verification.');
    } finally {
      setReviewingVerification('');
    }
  };

  const searchUser = async (event) => {
    event.preventDefault();
    setInviteStatus({ error: '', message: '', loading: true });
    setFoundUser(null);
    try {
      const result = await searchAgencyUser(publicId.trim());
      setFoundUser(result.user || result);
      setInviteStatus({ error: '', message: '', loading: false });
    } catch (requestError) {
      setInviteStatus({ error: requestError.response?.data?.message || 'User not found.', message: '', loading: false });
    }
  };

  const inviteUser = async () => {
    if (!foundUser) return;
    setInviteStatus({ error: '', message: '', loading: true });
    try {
      await sendAgencyInvitation(foundUser.publicId);
      setInviteStatus({ error: '', message: 'Invitation sent successfully.', loading: false });
    } catch (requestError) {
      setInviteStatus({ error: requestError.response?.data?.message || 'Could not send the invitation.', message: '', loading: false });
    }
  };

  return (
    <Page title="Agency Dashboard" eyebrow="AGENCY CENTER">
      {error && <Card><p className="notice-error" role="alert">{error}</p></Card>}
      {!error && !dashboard && <Loading>Loading agency dashboard...</Loading>}
      {dashboard && <>
        <div className="agency-stats-grid">
          <Card><p className="muted">Agency Name</p><strong>{dashboard.agency.agencyName}</strong></Card>
          <Card><p className="muted">Agency Code</p><strong>{dashboard.agency.agencyCode}</strong></Card>
          <Card><p className="muted">Joined Hosts</p><strong>{number(dashboard.agency.hostsCount)}</strong></Card>
          <Card><p className="muted">Agency Revenue</p><strong>{number(dashboard.agency.totalEarnings)}</strong></Card>
        </div>
        <Card title="Invite Host">
          <p className="muted">Share this unique code with hosts who want to join your agency.</p>
          <div className="agency-code">{dashboard.agency.agencyCode}</div>
          <form className="agency-user-search" onSubmit={searchUser}>
            <label className="field"><span>Search user by Public ID</span><input inputMode="numeric" value={publicId} onChange={(event) => setPublicId(event.target.value)} placeholder="Example: 1000123" /></label>
            <button className="button button-secondary" type="submit" disabled={inviteStatus.loading || !publicId.trim()}>{inviteStatus.loading ? 'Searching…' : 'Search user'}</button>
          </form>
          {foundUser && <div className="agency-search-result"><div className="agency-search-user"><div className="agency-search-avatar">{foundUser.avatar || foundUser.profilePicture ? <img src={foundUser.avatar || foundUser.profilePicture} alt="" /> : (foundUser.name || foundUser.username || '?').slice(0, 1).toUpperCase()}</div><div><strong>{foundUser.name || foundUser.username}</strong><p className="muted">@{foundUser.username} · ID: {foundUser.publicId}</p></div></div><button className="button button-primary button-small" type="button" onClick={inviteUser} disabled={inviteStatus.loading || Boolean(foundUser.agencyId)}>{foundUser.agencyId ? 'Already in an agency' : inviteStatus.loading ? 'Sending…' : 'Send Invitation'}</button></div>}
          {inviteStatus.message && <p className="success-message" role="status">{inviteStatus.message}</p>}
          {inviteStatus.error && <p className="form-error" role="alert">{inviteStatus.error}</p>}
        </Card>
        <Card title={`Pending Face Verification${pendingVerifications.length === 1 ? '' : 's'}`}>
          {pendingVerifications.length === 0 ? <p className="muted">No pending host verifications.</p> : <div className="verification-review-list">{pendingVerifications.map((verification) => { const user = verification.userId || {}; return <div className="verification-review-card" key={verification._id}><div className="verification-review-user"><div className="agency-search-avatar">{user.avatar || user.profilePicture ? <img src={user.avatar || user.profilePicture} alt="" /> : (user.name || user.username || '?').slice(0, 1).toUpperCase()}</div><div><strong>{user.name || user.username}</strong><p className="muted">@{user.username} · ID: {user.publicId}</p></div></div><div className="verification-review-actions"><button className="button button-primary button-small" type="button" disabled={Boolean(reviewingVerification)} onClick={() => reviewVerification(verification._id, 'APPROVED')}>Approve</button><button className="button button-secondary button-small" type="button" disabled={Boolean(reviewingVerification)} onClick={() => reviewVerification(verification._id, 'REJECTED')}>Reject</button></div></div>; })}</div>}
        </Card>
        <Card title={`Host Progress (${dashboard.month})`}>
          {dashboard.hosts.length === 0 && <p className="muted">No hosts have joined yet.</p>}
          <div className="agency-host-list">
            {dashboard.hosts.map(({ host, target }) => (
              <div className="agency-host" key={host._id}>
                <div><strong>{host.name || host.username}</strong><span className="muted">@{host.username}</span></div>
                <Progress label="Live Hours" value={target.liveHoursCompleted} target={target.liveHoursTarget} unit="hours" />
                <Progress label="Diamonds" value={target.diamondsEarned} target={target.diamondTarget} unit="diamonds" />
              </div>
            ))}
          </div>
        </Card>
      </>}
    </Page>
  );
}
