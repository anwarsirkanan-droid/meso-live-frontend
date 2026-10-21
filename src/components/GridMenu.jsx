import { BarChart3, Gamepad2, Landmark, ShoppingBag, Target, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from './UI.jsx';

const items = [['Task Center', Target, '/tasks'], ['Store', ShoppingBag, '/profile/recharge'], ['Wallet', Wallet, '/profile/wallet'], ['Level', BarChart3, '/profile/levels'], ['Agency', Landmark], ['Games', Gamepad2, '/games/dice']];
export default function GridMenu({ profile }) { const navigate = useNavigate(); const agencyPath = profile?.role === 'AGENT' || profile?.isAgent === true ? '/profile/agency' : '/host-center'; return <Card title="Quick access" className="profile-grid-menu"><div className="profile-menu-grid">{items.map(([label, Icon, path]) => <button key={label} type="button" onClick={() => navigate(path || agencyPath)}><Icon size={20} /><span>{label}</span></button>)}</div></Card>; }
