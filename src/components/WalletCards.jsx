import { useNavigate } from 'react-router-dom';
import { Card } from './UI.jsx';

const number = (value) => (Number(value) || 0).toLocaleString();
const valueOf = (data, key) => Number(data?.[key] ?? data?.wallet?.[key] ?? data?.balance?.[key] ?? 0);

export default function WalletCards({ wallet }) {
  const navigate = useNavigate();
  const coins = valueOf(wallet, 'coins');
  const diamonds = valueOf(wallet, 'diamonds');
  return <Card className="wallet-cards">
    <div className="wallet-balance-card">
      <div><p className="eyebrow">COINS</p><h3>{number(coins)}</h3></div>
      <button className="button button-primary" type="button" onClick={() => navigate('/profile/recharge')}>Top Up</button>
    </div>
    <div className="wallet-balance-card">
      <div><p className="eyebrow">DIAMONDS</p><h3>{number(diamonds)}</h3></div>
      <button className="button button-secondary" type="button" onClick={() => navigate('/profile/wallet')}>View</button>
    </div>
  </Card>;
}
