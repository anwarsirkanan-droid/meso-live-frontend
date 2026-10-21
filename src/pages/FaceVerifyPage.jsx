import CameraFaceVerification from '../components/CameraFaceVerification.jsx';
import { Card, Page } from '../components/UI.jsx';

export default function FaceVerifyPage() {
  return (
    <Page title="Face verification" eyebrow="KEEP OUR COMMUNITY SAFE">
      <Card className="center-card">
        <div className="large-icon">📸</div>
        <h2>Verify your identity</h2>
        <p className="muted">Verification uses a live camera snapshot only.</p>
        <CameraFaceVerification />
        <p className="muted fine-print">Your photo is only used for verification.</p>
      </Card>
    </Page>
  );
}
