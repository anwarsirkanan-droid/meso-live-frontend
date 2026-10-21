import { ChevronRight, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from './UI.jsx';

const items = [['My Streams', '/profile/streams'], ['My Gifts', '/profile/gifts'], ['Invite Friends', '/profile/invite'], ['Withdrawal', '/profile/withdrawal'], ['Help & Support', 'help'], ['About', 'about'], ['Settings', '/settings', Settings]];
export default function ListMenu() { const navigate = useNavigate(); const act = (path) => { if (path === 'help') window.open('https://wa.me/251900000000', '_blank', 'noopener,noreferrer'); else if (path === 'about') window.alert(`Meso Live ${import.meta.env.VITE_APP_VERSION || '1.0.0'}\nTerms and conditions apply.`); else navigate(path); }; return <Card title="More" className="profile-list-menu"><div>{items.map(([label, path, Icon]) => <button key={label} type="button" onClick={() => act(path)}><span>{Icon ? <Icon size={16} /> : null}{label}</span><ChevronRight size={17} /></button>)}</div></Card>; }
