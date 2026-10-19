import { useState } from 'react';
import { generateInvite } from '../api.js';
import { Card, ErrorMessage, Page } from '../components/UI.jsx';

export default function InvitePage() {
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const createInvite = async () => {
    setError('');
    try {
      const result = await generateInvite();
      setInvite(result?.code || result?.inviteCode || '');
      if (!result?.code && !result?.inviteCode) setError('The server did not return an invite code.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
    } catch (copyError) {
      setError(`Could not copy invite code: ${copyError.message}`);
    }
  };

  return (
    <Page title="Invite friends" eyebrow="GROW YOUR CIRCLE">
      <Card className="center-card invite-card">
        <div className="large-icon">🎁</div>
        <h2>Good things are better shared</h2>
        <p className="muted">Invite friends to Meso Live and connect in your favorite rooms.</p>
        {invite ? (
          <div className="invite-code">
            <strong>{invite}</strong>
            <button className="button button-secondary" type="button" onClick={copyCode}>{copied ? 'Copied!' : 'Copy code'}</button>
          </div>
        ) : (
          <button className="button button-primary button-full" type="button" onClick={createInvite}>Get my invite code</button>
        )}
        <ErrorMessage>{error}</ErrorMessage>
        <div className="stats-row"><div><strong>0</strong><span>Friends invited</span></div><div><strong>0</strong><span>Rewards earned</span></div></div>
      </Card>
    </Page>
  );
}
