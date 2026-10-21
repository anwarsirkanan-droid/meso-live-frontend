import { useEffect, useState } from 'react';
import { applyForAgency } from '../api.js';

export default function CreateAgencyModal({ isExistingHost, initialContact = '', onClose, onSuccess }) {
  const [agencyName, setAgencyName] = useState('');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState(initialContact);
  const [proof, setProof] = useState(null);
  const [status, setStatus] = useState({ error: '', saving: false });

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !status.saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, status.saving]);

  const submit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData();
    form.append('agencyName', agencyName.trim());
    form.append('phoneNumber', contactInfo.trim());
    if (isExistingHost) {
      form.append('description', description.trim());
      form.append('experience', description.trim());
    } else {
      form.append('experience', description.trim());
      if (proof) form.append('proof', proof);
    }

    setStatus({ error: '', saving: true });
    try {
      const response = await applyForAgency(form);
      formElement.reset();
      onSuccess(response.message || 'Agency application submitted.');
    } catch (error) {
      setStatus({
        error: error.response?.data?.message || 'Could not submit the agency application.',
        saving: false,
      });
    }
  };

  return (
    <div className="agency-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !status.saving) onClose();
    }}>
      <section className="agency-modal card" role="dialog" aria-modal="true" aria-labelledby="create-agency-title">
        <div className="filter-modal-header">
          <div>
            <p className="eyebrow">AGENCY APPLICATION</p>
            <h2 id="create-agency-title">Create / Become an Agent</h2>
          </div>
          <button className="filter-modal-close" type="button" onClick={onClose} disabled={status.saving} aria-label="Close">
            ×
          </button>
        </div>
        <p className="muted" role="note">
          {isExistingHost
            ? 'Your request will be sent to your current Agent for approval.'
            : 'Your application will be submitted to Meso Live Admin for review.'}
        </p>
        <form className="form-stack" onSubmit={submit}>
          <label className="field">
            <span>Agency Name</span>
            <input value={agencyName} onChange={(event) => setAgencyName(event.target.value)} maxLength={100} required disabled={status.saving} />
          </label>
          {isExistingHost && (
            <label className="field">
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} required disabled={status.saving} />
            </label>
          )}
          <label className="field">
            <span>Contact Info</span>
            <input value={contactInfo} onChange={(event) => setContactInfo(event.target.value)} minLength={7} maxLength={40} required disabled={status.saving} />
          </label>
          {!isExistingHost && (
            <>
              <label className="field">
                <span>Experience Description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} required disabled={status.saving} />
              </label>
              <label className="field">
                <span>Upload Proof / Screenshot of Prior Agency Experience</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setProof(event.target.files?.[0] || null)}
                  required
                  disabled={status.saving}
                />
              </label>
            </>
          )}
          {status.error && <p className="form-error" role="alert">{status.error}</p>}
          <div className="agency-modal-actions">
            <button className="button button-secondary" type="button" onClick={onClose} disabled={status.saving}>Cancel</button>
            <button className="button button-primary" type="submit" disabled={status.saving}>
              {status.saving ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
