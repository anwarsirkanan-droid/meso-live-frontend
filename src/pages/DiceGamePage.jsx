import { useState } from 'react';
import { playDice } from '../api.js';
import { Card, ErrorMessage, Field, Page } from '../components/UI.jsx';

export default function DiceGamePage() {
  const [amount, setAmount] = useState(10);
  const [choice, setChoice] = useState('odd');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const play = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult('');
    try {
      const data = await playDice({ amount: Number(amount), choice });
      setResult(data?.message || `Result: ${data?.result ?? data?.roll ?? 'Round completed'}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Dice game" eyebrow="ROLL THE DICE">
      <Card className="center-card game-card">
        <div className="dice-art">🎲</div>
        <p className="muted">Pick a side and place your bet.</p>
        <form className="form-stack" onSubmit={play}>
          <Field label="Bet amount (coins)" type="number" min="1" required value={amount} onChange={(event) => setAmount(event.target.value)} />
          <label className="field"><span>Your pick</span><select value={choice} onChange={(event) => setChoice(event.target.value)}><option value="odd">Odd</option><option value="even">Even</option></select></label>
          <ErrorMessage>{error}</ErrorMessage>
          {result && <p className="result-message" role="status">{result}</p>}
          <button className="button button-primary button-full" disabled={busy}>{busy ? 'Rolling…' : 'Play'}</button>
        </form>
      </Card>
    </Page>
  );
}
