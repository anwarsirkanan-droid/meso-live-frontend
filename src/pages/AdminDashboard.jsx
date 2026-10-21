import { useEffect, useState } from 'react';
import { getAdminAgentApplications, reviewAdminAgentApplication } from '../api.js';
import { Card, Loading, Page } from '../components/UI.jsx';

export default function AdminDashboard() {
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState('');

  useEffect(() => {
    getAdminAgentApplications()
      .then((result) => setApplications(result.applications || []))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load Agent applications.'))
      .finally(() => setLoading(false));
  }, []);

  const review = async (applicationId, action) => {
    setReviewing(applicationId);
    setError('');
    try {
      await reviewAdminAgentApplication(applicationId, action);
      setApplications((current) => current.filter((application) => application._id !== applicationId));
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not ${action} the application.`);
    } finally {
      setReviewing('');
    }
  };

  return (
    <div className="admin-page">
      <Page title="Admin dashboard" eyebrow="MESO LIVE MANAGEMENT">
        <div className="admin-stats">
          <Card><p className="muted">Total users</p><h2>—</h2></Card>
          <Card><p className="muted">Live rooms</p><h2>—</h2></Card>
          <Card><p className="muted">Pending withdrawals</p><h2>—</h2></Card>
        </div>
        <Card title="Users"><p className="muted">User records will appear here.</p></Card>
        <Card title="Withdrawal requests"><p className="muted">Withdrawal requests will appear here.</p></Card>
        <Card title={`Pending Agent applications${applications.length ? ` (${applications.length})` : ''}`}>
          {error && <p className="notice-error" role="alert">{error}</p>}
          {loading ? <Loading>Loading Agent applications…</Loading> : applications.length === 0
            ? <p className="muted">No pending Agent applications.</p>
            : <div className="agency-invitation-list">{applications.map((application) => {
              const applicant = application.applicantId || {};
              const avatar = applicant.avatar || applicant.profilePicture;
              return (
                <article className="agency-invitation-card" key={application._id}>
                  <div>
                    <div className="agency-search-user">
                      <div className="agency-search-avatar">{avatar ? <img src={avatar} alt="" /> : (applicant.name || applicant.username || '?').slice(0, 1).toUpperCase()}</div>
                      <div>
                        <strong>{application.agencyName}</strong>
                        <p className="muted">{applicant.name || applicant.username} · ID: {applicant.publicId || applicant._id}</p>
                        <small className="muted">Phone: {application.phoneNumber}</small>
                      </div>
                    </div>
                    <p>{application.experience}</p>
                    <p className="muted">Agent experience proof:</p>
                    <img
                      src={application.proofDataUrl}
                      alt={`Agent experience proof submitted by ${applicant.username || 'applicant'}`}
                      style={{ display: 'block', maxWidth: '100%', maxHeight: 320, borderRadius: 12 }}
                    />
                  </div>
                  <div className="agency-invitation-actions">
                    <button className="button button-primary button-small" type="button" disabled={Boolean(reviewing)} onClick={() => review(application._id, 'approve')}>Approve</button>
                    <button className="button button-secondary button-small" type="button" disabled={Boolean(reviewing)} onClick={() => review(application._id, 'reject')}>Reject</button>
                  </div>
                </article>
              );
            })}</div>}
        </Card>
      </Page>
    </div>
  );
}
