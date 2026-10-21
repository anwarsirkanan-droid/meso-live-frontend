import { useEffect, useState } from 'react';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { applyForAgency, applyForAgencyExit, applyForSubAgency, getAgencyCenter, getAgencyCommission, getAgencyInviteLinks } from '../api.js';
import { Card, Loading, Page } from '../components/UI.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const number = (value) => (Number(value) || 0).toLocaleString();
const percent = (value) => `${(Number(value || 0) * 100).toFixed(0)}%`;

export default function AgencyCenterScreen() {
  const { user } = useAuth();
  const isAgent = user?.isAgent === true || String(user?.role || '').toLowerCase() === 'agent';
  const isAgencyOwner = user?.isAgencyOwner === true || user?.role === 'AGENT_OWNER' || user?.ownedAgency;
  const [center, setCenter] = useState(null);
  const [rules, setRules] = useState([]);
  const [links, setLinks] = useState(null);
  const [parentAgencyId, setParentAgencyId] = useState('');
  const [applicationMessage, setApplicationMessage] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [status, setStatus] = useState({ error: '', message: '', saving: false });

  const load = async () => {
    try {
      const [centerData, commissionData, inviteData] = await Promise.all([
        getAgencyCenter(), getAgencyCommission(), getAgencyInviteLinks(),
      ]);
      setCenter(centerData);
      setRules(commissionData.rules || centerData.commission?.rules || []);
      setLinks(inviteData || centerData.inviteLinks || null);
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.response?.data?.message || error.message || 'Could not load Agency Center.' }));
    }
  };

  useEffect(() => {
    if (!isAgent) return undefined;
    load();
    const refresh = window.setInterval(load, 30000);
    return () => window.clearInterval(refresh);
  }, [isAgent]);

  const submitAgencyApplication = async (event) => {
    event.preventDefault();
    setStatus({ error: '', message: '', saving: true });
    try {
      await applyForAgency({ agencyId: agencyId.trim(), phoneNumber: phoneNumber.trim() });
      setAgencyId('');
      setStatus({ error: '', message: 'Agency application submitted for Agent approval.', saving: false });
    } catch (error) {
      setStatus({ error: error.response?.data?.message || 'Could not submit the agency application.', message: '', saving: false });
    }
  };

  const copy = async (value) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setStatus({ error: '', message: 'Invite link copied.', saving: false });
  };

  const submitSubAgency = async (event) => {
    event.preventDefault();
    setStatus({ error: '', message: '', saving: true });
    try {
      await applyForSubAgency({ parentAgencyId, message: applicationMessage });
      setParentAgencyId(''); setApplicationMessage('');
      setStatus({ error: '', message: 'Sub-agency application submitted.', saving: false });
    } catch (error) { setStatus({ error: error.response?.data?.message || 'Could not submit the application.', message: '', saving: false }); }
  };

  const submitExit = async () => {
    setStatus({ error: '', message: '', saving: true });
    try {
      await applyForAgencyExit({ message: applicationMessage });
      setApplicationMessage('');
      setStatus({ error: '', message: 'Exit application submitted.', saving: false });
    } catch (error) { setStatus({ error: error.response?.data?.message || 'Could not submit the exit application.', message: '', saving: false }); }
  };

  if (!isAgent) {
    return (
      <Page title="Agency Center" eyebrow="BECOME AN AGENT">
        <Card title="Apply to Become an Agent">
          <p className="muted">Join an agency by submitting your Agent name or Agency ID and contact information.</p>
          <form className="form-stack" onSubmit={submitAgencyApplication}>
            <label className="field"><span>Agent name / Agency ID</span><input value={agencyId} onChange={(event) => setAgencyId(event.target.value)} placeholder="Enter an Agency ID or code" required disabled={status.saving} /></label>
            <label className="field"><span>Phone / contact info</span><input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Phone number" required disabled={status.saving} /></label>
            <button className="button button-primary" type="submit" disabled={status.saving}>{status.saving ? 'Submitting…' : 'Apply for Agency'}</button>
          </form>
          {status.error && <p className="form-error" role="alert">{status.error}</p>}
          {status.message && <p className="success-message" role="status">{status.message}</p>}
        </Card>
      </Page>
    );
  }

  if (!center) return <Page title="Agency Center" eyebrow={isAgencyOwner ? 'AGENCY OWNER DASHBOARD' : 'MY AGENCY'}><Loading>{status.error || 'Loading Agency Center…'}</Loading></Page>;

  const isAgencyOwnerFromCenter = center.agency?.isOwner || center.isAgencyOwner || center.agency?.ownerId === user?._id;
  const finalIsAgencyOwner = isAgencyOwner || isAgencyOwnerFromCenter;

  const revenue = center.giftRevenue || {};
  const commission = center.commission || {};
  const nextTier = revenue.nextTier;
  const current = Number(revenue.last30Days) || 0;
  const target = Number(nextTier?.minimumTeamIncome) || current || 1;
  const progress = nextTier?.minimumTeamIncome === null ? 100 : Math.min(100, (current / target) * 100);

  if (finalIsAgencyOwner) {
    return (
      <Page title="Agency Center" eyebrow="AGENCY OWNER DASHBOARD" actions={<button className="agency-refresh-button" type="button" onClick={load} aria-label="Refresh Agency Center"><RefreshCw size={17} /></button>}>
        {status.error && <p className="form-error" role="alert">{status.error}</p>}
        <section className="agency-dashboard-header card">
          <div><p className="eyebrow">MY AGENCY</p><h2>{center.agency?.name || 'Agency'}</h2><span className="muted">{center.agency?.timeZone || 'GMT+8'}</span></div>
          <div className="agency-dashboard-commission"><span className="muted">Yesterday's commission</span><strong>{number(center.yesterdayTotalCommission || center.commission?.yesterdayCommission)} coins</strong><span className="muted">Current rate {percent(commission.rate)}</span></div>
        </section>

        <Card title="Gift Revenue Progress" className="agency-progress-card">
          <div className="agency-progress-heading"><div><strong>{number(current)}</strong><span className="muted"> points · 30d + today {number(revenue.today)}</span></div><span className="level-badge">Level {commission.tier || center.agency?.tier}</span></div>
          <div className="profile-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div>
          <p className="muted">{nextTier?.minimumTeamIncome === null ? 'S+ qualification is based on inviting 2 S-level agencies.' : `${number(nextTier?.remaining)} points to reach ${nextTier?.tier || 'next level'}.`}</p>
        </Card>

        <div className="agency-breakdown-grid">
          <Card><p className="muted">My Host Gift Revenue</p><strong>{number(center.myHostGiftRevenue?.last30Days)}</strong><small>30 days</small></Card>
          <Card><p className="muted">My Sub-Agency Revenue</p><strong>{number(center.subAgencyGiftRevenue?.last30Days)}</strong><small>30 days</small></Card>
          <Card><p className="muted">Protection T1</p><strong>{number(center.protectionT1?.hosts)}</strong><small>{number(center.protectionT1?.subAgencyHosts)} sub-agency hosts</small></Card>
        </div>

        <Card title="Invite & Support" className="agency-link-actions">
          <div className="agency-action-grid">
            <button type="button" onClick={() => copy(links?.hostInviteLink)}><span>Host Invite Link</span><Copy size={16} /></button>
            <button type="button" onClick={() => copy(links?.agencyInviteLink)}><span>Agency Invite</span><Copy size={16} /></button>
            <a href={center.adminWhatsAppUrl || '#'} target="_blank" rel="noreferrer"><span>Admin WhatsApp</span><ExternalLink size={16} /></a>
          </div>
        </Card>

        <Card title="Commission Rules" className="agency-rules-card" id="commission-rules">
          {rules.map((rule) => <div className="agency-rule-row" key={rule.tier}><strong>{rule.tier}</strong><span>{rule.minimumTeamIncome === null ? '2 S-level agencies invited' : `${number(rule.minimumTeamIncome)} team income`}</span><b>{percent(rule.rate)}</b></div>)}
          {commission.sPlus && <p className="muted">S+ includes an additional 1% bonus on S-level host revenue.</p>}
        </Card>
        {status.message && <p className="success-message" role="status">{status.message}</p>}
      </Page>
    );
  }

  return (
    <Page title="Agency Center" eyebrow="MY AGENCY" actions={<button className="agency-refresh-button" type="button" onClick={load} aria-label="Refresh Agency Center"><RefreshCw size={17} /></button>}>
      {status.error && <p className="form-error" role="alert">{status.error}</p>}
      <section className="agency-dashboard-header card">
        <div><p className="eyebrow">MY AGENCY</p><h2>{center.agency?.name || 'Agency'}</h2><span className="muted">{center.agency?.timeZone || 'GMT+8'}</span></div>
        <div className="agency-dashboard-commission"><span className="muted">Yesterday's commission</span><strong>{number(center.yesterdayTotalCommission || center.commission?.yesterdayCommission)} coins</strong><span className="muted">Current rate {percent(commission.rate)}</span></div>
        <button className="button button-secondary button-small" type="button" onClick={() => document.getElementById('commission-rules')?.scrollIntoView({ behavior: 'smooth' })}>Rules&nbsp;›</button>
      </section>

      <Card title="Gift Revenue Progress" className="agency-progress-card">
        <div className="agency-progress-heading"><div><strong>{number(current)}</strong><span className="muted"> points · 30d + today {number(revenue.today)}</span></div><span className="level-badge">Level {commission.tier || center.agency?.tier}</span></div>
        <div className="profile-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div>
        <p className="muted">{nextTier?.minimumTeamIncome === null ? 'S+ qualification is based on inviting 2 S-level agencies.' : `${number(nextTier?.remaining)} points to reach ${nextTier?.tier || 'next level'}.`}</p>
      </Card>

      <div className="agency-breakdown-grid">
        <Card><p className="muted">My Host Gift Revenue</p><strong>{number(center.myHostGiftRevenue?.last30Days)}</strong><small>30 days</small></Card>
        <Card><p className="muted">My Sub-Agency Revenue</p><strong>{number(center.subAgencyGiftRevenue?.last30Days)}</strong><small>30 days</small></Card>
        <Card><p className="muted">Protection T1</p><strong>{number(center.protectionT1?.hosts)}</strong><small>{number(center.protectionT1?.subAgencyHosts)} sub-agency hosts</small></Card>
      </div>

      <Card title="Invite & Support" className="agency-link-actions">
        <div className="agency-action-grid">
          <button type="button" onClick={() => copy(links?.hostInviteLink)}><span>Host Invite Link</span><Copy size={16} /></button>
          <button type="button" onClick={() => copy(links?.agencyInviteLink)}><span>Agency Invite</span><Copy size={16} /></button>
          <a href={center.adminWhatsAppUrl || '#'} target="_blank" rel="noreferrer"><span>Admin WhatsApp</span><ExternalLink size={16} /></a>
        </div>
      </Card>

      {!finalIsAgencyOwner && (
        <Card title="Applications" className="agency-application-card">
          <form className="form-stack" onSubmit={submitSubAgency}>
            <label className="field"><span>Sub-agency parent ID</span><input value={parentAgencyId} onChange={(event) => setParentAgencyId(event.target.value)} placeholder="Mongo agency ID" required /></label>
            <label className="field"><span>Application message</span><textarea value={applicationMessage} onChange={(event) => setApplicationMessage(event.target.value)} maxLength={1000} placeholder="Optional message" /></label>
            <div className="agency-application-actions"><button className="button button-primary" type="submit" disabled={status.saving}>Sub-Agency Application</button><button className="button button-secondary" type="button" onClick={submitExit} disabled={status.saving}>Exit Application</button></div>
          </form>
        </Card>
      )}

      <Card title="Commission Rules" className="agency-rules-card" id="commission-rules">
        {rules.map((rule) => <div className="agency-rule-row" key={rule.tier}><strong>{rule.tier}</strong><span>{rule.minimumTeamIncome === null ? '2 S-level agencies invited' : `${number(rule.minimumTeamIncome)} team income`}</span><b>{percent(rule.rate)}</b></div>)}
        {commission.sPlus && <p className="muted">S+ includes an additional 1% bonus on S-level host revenue.</p>}
      </Card>
      {status.message && <p className="success-message" role="status">{status.message}</p>}
    </Page>
  );
}
