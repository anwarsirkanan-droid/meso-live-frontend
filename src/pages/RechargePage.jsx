import { useEffect, useState } from 'react';
import { getProfile, getRechargePackages, recharge } from '../api.js';
import { Card, ErrorMessage, Field, Loading, Page } from '../components/UI.jsx';

export default function RechargePage() {
  const [packages, setPackages] = useState([]);
  const [selected, setSelected] = useState('');
  const [customer, setCustomer] = useState({ email: '', firstName: '', lastName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [message, setMessage] = useState('');
  const [customerPrefillWarning, setCustomerPrefillWarning] = useState('');

  useEffect(() => {
    let active = true;
    getRechargePackages()
      .then((data) => {
        if (!active) return;
        const availablePackages = Array.isArray(data) ? data : [];
        setPackages(availablePackages);
        setSelected(availablePackages.find((item) => item.popular)?.id || availablePackages[0]?.id || '');
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || requestError.message || 'Could not load coin packages.');
      })
      .finally(() => {
        if (active) setLoadingPackages(false);
      });

    getProfile()
      .then((profile) => {
        if (!active) return;
        const [firstName = '', ...lastNameParts] = (profile.name || '').trim().split(/\s+/);
        setCustomer((current) => ({
          ...current,
          email: profile.email || current.email,
          firstName: firstName || current.firstName,
          lastName: lastNameParts.join(' ') || current.lastName,
        }));
      })
      .catch(() => {
        if (active) setCustomerPrefillWarning('Could not prefill your account details. Enter them below to continue.');
      });
    return () => {
      active = false;
    };
  }, []);

  const pay = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await recharge(selected, customer);
      if (result?.checkoutUrl) window.location.assign(result.checkoutUrl);
      else setMessage(result?.message || 'Payment checkout is unavailable. No coins were credited.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Recharge coins" eyebrow="SUPPORT YOUR FAVORITE CREATORS">
      {loadingPackages ? <Loading>Loading coin packages…</Loading> : (
        <div className="package-list">
          {packages.map((item) => (
            <button
              type="button"
              className={`package-option${selected === item.id ? ' selected' : ''}`}
              key={item.id}
              onClick={() => setSelected(item.id)}
            >
              <span className="package-coin">🪙</span>
              <span><strong>{item.coins.toLocaleString()} coins</strong>{item.popular && <small>Most popular</small>}</span>
              <span className="package-price">ETB {item.amountEtb.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
      <Card className="payment-card">
        <ErrorMessage>{error}</ErrorMessage>
        {message && <p className="success-message">{message}</p>}
        {customerPrefillWarning && <p className="muted" role="status">{customerPrefillWarning}</p>}
        <p className="muted">Secure payments powered by Chapa.</p>
        <div className="form-stack">
          <Field label="Email" type="email" autoComplete="email" required value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} />
          <Field label="First name" autoComplete="given-name" required value={customer.firstName} onChange={(event) => setCustomer((current) => ({ ...current, firstName: event.target.value }))} />
          <Field label="Last name" autoComplete="family-name" required value={customer.lastName} onChange={(event) => setCustomer((current) => ({ ...current, lastName: event.target.value }))} />
          <button className="button button-primary button-full" type="button" disabled={busy || loadingPackages || !selected} onClick={pay}>
            {busy ? 'Connecting to Chapa…' : 'Pay with Chapa'}
          </button>
        </div>
      </Card>
    </Page>
  );
}
