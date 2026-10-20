import { BarChart3, Gamepad2, Gift, Landmark, ShoppingBag, Target, Trophy, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from './UI.jsx';

const items = [['Task Center', Target, '/tasks'], ['Store', ShoppingBag, '/profile/recharge'], ['Wallet', Wallet, '/profile/wallet'], ['Level', BarChart3, '/profile/levels'], ['Host Rewards', Trophy, '/host-rewards'], ['Host Tasks', Gift, '/host-tasks'], ['Agency', Landmark, '/profile/agency'], ['Games', Gamepad2, '/games/dice']];
export default function GridMenu() { const navigate = useNavigate(); return <Card title="Quick access" className="profile-grid-menu"><div className="profile-menu-grid">{items.map(([label, Icon, path]) => <button key={label} type="button" onClick={() => navigate(path)}><Icon size={20} /><span>{label}</span></button>)}</div></Card>; }
