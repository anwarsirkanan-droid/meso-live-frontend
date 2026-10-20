import { useNavigate } from 'react-router-dom';
import { Card } from './UI.jsx';

const number = (value) => (Number(value) || 0).toLocaleString();
const valueOf = (data, key) => Number(data?.[key] ?? data?.wallet?.[key] ?? data?.balance?.[key] ?? 0);

function Progress({ title, value, level }) {
  const progress = Math.max(0, Math.min(100, Number(level?.progress ?? level?.percentage ?? 0)));
  const need = Number(level?.nextLevelPoints ?? level?.pointsNeeded ?? level?.needed ?? 0);
  return <div className="wallet-level"><div><span>{title}: {number(value)}</span><strong>Lv.{level?.level || 1}</strong></div><div className="profile-progress-track"><span style={{ width: `${progress}%` }} /></div><small>{need ? `Need ${number(need)} ${title.toLowerCase() === 'wealth value' ? 'coins' : 'points'} for upgrade` : 'Maximum level or progress unavailable'}</small></div>;
}

export default function WalletCards({ wallet, levels }) {
  const navigate = useNavigate();
  const coins = valueOf(wallet, 'coins');
  const diamonds = valueOf(wallet, 'diamonds');
  const wealth = levels?.wealth || levels?.wealthLevel || wallet?.wealth || {};
  const charm = levels?.charm || levels?.charmLevel || wallet?.charm || {};
  return <section className="wallet-cards">
    <Card className="wallet-balance-card"><div><p className="eyebrow">COINS</p><h3>{number(coins)}</h3></div><button className="button button-primary" type="button" onClick={() => navigate('/profile/recharge')}>Top Up</button></Card>
    <Card className="wallet-balance-card"><div><p className="eyebrow">DIAMONDS</p><h3>{number(diamonds)}</h3></div><button className="button button-secondary" type="button" onClick={() => navigate('/profile/wallet')}>View</button></Card>
    <Card className="wallet-progress-card"><Progress title="Wealth Value" value={wealth.value ?? wealth.points ?? wallet?.wealthValue} level={wealth} /><Progress title="Charm Value" value={charm.value ?? charm.points ?? wallet?.charmValue} level={charm} /></Card>
  </section>;
}
