import { useState } from 'react';
import VerificationBadge from '../components/VerificationBadge.jsx';
import { Card, Page } from '../components/UI.jsx';

export default function FaceVerifyPage() {
  const [fileName, setFileName] = useState('');

  return (
    <Page title="Face verification" eyebrow="KEEP OUR COMMUNITY SAFE">
      <Card className="center-card">
        <div className="large-icon">📸</div>
        <h2>Verify your identity</h2>
        <p className="muted">Upload a clear photo of your face. Verification status will appear here.</p>
        <VerificationBadge />
        <label className="button button-secondary upload-button">
          {fileName || 'Choose a face photo'}
          <input type="file" accept="image/*" onChange={(event) => setFileName(event.target.files?.[0]?.name || '')} />
        </label>
        <button type="button" className="button button-primary button-full" disabled={!fileName}>Submit for review</button>
        <p className="muted fine-print">Your photo is only used for verification.</p>
      </Card>
    </Page>
  );
}
