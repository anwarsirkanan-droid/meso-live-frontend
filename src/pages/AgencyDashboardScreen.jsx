import { useEffect, useState } from 'react';
import { getAgencyDashboard } from '../api.js';
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

  useEffect(() => {
    getAgencyDashboard().then(setDashboard).catch((requestError) => {
      setError(requestError.response?.data?.message || requestError.message || 'Could not load the agency dashboard.');
    });
  }, []);

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
