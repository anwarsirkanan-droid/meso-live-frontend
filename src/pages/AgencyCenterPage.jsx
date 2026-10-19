import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAgencyCenter } from '../api.js';
import { Card, Loading, Page } from '../components/UI.jsx';

const formatNumber = (value) => (Number(value) || 0).toLocaleString();

export default function AgencyCenterPage() {
  const [center, setCenter] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAgencyCenter()
      .then((data) => {
        if (active) setCenter(data);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || requestError.message || 'Could not load the agency center.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Page title="Agency Center" eyebrow="YOUR AGENCY">
      {error && (
        <Card>
          <p className="notice-error" role="alert">{error}</p>
          <p className="muted agency-help">
            Agency Center access is available to agency members. Contact your agency administrator if you need access.
          </p>
        </Card>
      )}
      {!error && !center && <Loading>Loading agency center…</Loading>}
      {center && (
        <>
          <Card className="agency-summary">
            <p className="eyebrow">AGENCY TIER {center.agency?.tier || center.commission?.tier || '—'}</p>
            <h2>{center.agency?.name || 'Agency'}</h2>
            <p className="muted">Commission rate: {Math.round((center.commission?.rate || 0) * 100)}%</p>
          </Card>
          <div className="agency-stats-grid">
            <Card><p className="muted">Today’s team gifts</p><strong>{formatNumber(center.giftRevenue?.today)}</strong></Card>
            <Card><p className="muted">Last 30 days</p><strong>{formatNumber(center.giftRevenue?.last30Days)}</strong></Card>
            <Card><p className="muted">Hosts</p><strong>{formatNumber(center.protectionT1?.hosts)}</strong></Card>
            <Card><p className="muted">Sub-agencies</p><strong>{formatNumber(center.protectionT1?.subAgencies)}</strong></Card>
          </div>
          {center.giftRevenue?.nextTier && (
            <Card title="Next agency tier">
              <p className="muted">
                {center.giftRevenue.nextTier.remaining === null
                  ? 'Continue building your agency network to qualify.'
                  : `${formatNumber(center.giftRevenue.nextTier.remaining)} more team gift coins needed.`}
              </p>
            </Card>
          )}
          <Card className="link-card">
            <Link className="page-link" to="/profile/invite">
              <span>Invite friends</span><span aria-hidden="true">→</span>
            </Link>
          </Card>
        </>
      )}
    </Page>
  );
}
