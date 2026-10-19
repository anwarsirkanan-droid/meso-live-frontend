import { useState } from 'react';
import { recharge } from '../api.js';
import { Card, ErrorMessage, Page } from '../components/UI.jsx';

const packages = [
  { id: 'starter', coins: 100, price: 'ETB 50' },
  { id: 'popular', coins: 550, price: 'ETB 250', popular: true },
  { id: 'mega', coins: 1200, price: 'ETB 500' },
];

export default function RechargePage() {
  const [selected, setSelected] = useState('popular');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const pay = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await recharge(selected);
      if (result?.checkoutUrl) window.location.assign(result.checkoutUrl);
      else setMessage('Recharge request created. Follow the payment instructions from your account.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Recharge coins" eyebrow="SUPPORT YOUR FAVORITE CREATORS">
      <div className="package-list">
        {packages.map((item) => (
          <button
            type="button"
            className={`package-option${selected === item.id ? ' selected' : ''}`}
            key={item.id}
            onClick={() => setSelected(item.id)}
          >
            <span className="package-coin">🪙</span>
            <span><strong>{item.coins} coins</strong>{item.popular && <small>Most popular</small>}</span>
            <span className="package-price">{item.price}</span>
          </button>
        ))}
      </div>
      <Card className="payment-card">
        <ErrorMessage>{error}</ErrorMessage>
        {message && <p className="success-message">{message}</p>}
        <p className="muted">Secure payments powered by Chapa.</p>
        <button className="button button-primary button-full" type="button" disabled={busy} onClick={pay}>
          {busy ? 'Connecting to Chapa…' : 'Pay with Chapa'}
        </button>
      </Card>
    </Page>
  );
}
