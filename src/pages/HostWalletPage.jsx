import { useEffect, useState } from 'react';
import { getWalletBalance, requestWithdraw } from '../api.js';
import { Card, ErrorMessage, Field, Loading, Page } from '../components/UI.jsx';

export default function HostWalletPage() {
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Bank transfer');
  const [account, setAccount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => getWalletBalance()
    .then((data) => setWallet(data?.wallet || data))
    .catch((requestError) => setError(requestError.response?.data?.message || requestError.message));

  useEffect(() => { refresh(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await requestWithdraw({ amount: Number(amount), method, account });
      setMessage('Withdrawal request submitted.');
      setAmount('');
      setAccount('');
      await refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Host wallet" eyebrow="YOUR EARNINGS">
      <Card className="balance-card">
        <p className="eyebrow">DIAMONDS AVAILABLE</p>
        {wallet ? <h2>💎 {wallet.diamonds ?? wallet.balance ?? 0}</h2> : <Loading>Loading balance…</Loading>}
      </Card>
      <Card title="Request a withdrawal">
        <form className="form-stack" onSubmit={submit}>
          <Field label="Amount" type="number" min="1" required value={amount} onChange={(event) => setAmount(event.target.value)} />
          <label className="field"><span>Withdrawal method</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option>Bank transfer</option><option>Telebirr</option></select></label>
          <Field label="Account or phone number" required value={account} onChange={(event) => setAccount(event.target.value)} />
          <ErrorMessage>{error}</ErrorMessage>
          {message && <p className="success-message" role="status">{message}</p>}
          <button className="button button-primary button-full" disabled={busy}>{busy ? 'Submitting…' : 'Request withdrawal'}</button>
        </form>
      </Card>
      <Card title="Withdrawal history"><p className="muted">Your requests will appear here.</p></Card>
    </Page>
  );
}
