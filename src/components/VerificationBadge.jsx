export default function VerificationBadge({ verified = false }) {
  return (
    <span className={`verification-badge${verified ? ' verified' : ''}`}>
      {verified ? '✓ Verified' : 'Not verified'}
    </span>
  );
}
