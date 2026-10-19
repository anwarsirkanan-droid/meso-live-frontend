import { Card, Page } from '../components/UI.jsx';

export default function AdminDashboard() {
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
      </Page>
    </div>
  );
}
