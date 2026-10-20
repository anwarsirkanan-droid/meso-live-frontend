import { ChevronRight, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from './UI.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const items = [['My Agency', '/profile/agency'], ['My Streams', '/profile/streams'], ['My Gifts', '/profile/gifts'], ['Invite Friends', '/profile/invite'], ['Withdrawal', '/profile/withdrawal'], ['Help & Support', 'help'], ['About', 'about']];
export default function ListMenu() { const navigate = useNavigate(); const { logout } = useAuth(); const act = (path) => { if (path === 'help') window.open('https://wa.me/251900000000', '_blank', 'noopener,noreferrer'); else if (path === 'about') window.alert(`Meso Live ${import.meta.env.VITE_APP_VERSION || '1.0.0'}\nTerms and conditions apply.`); else navigate(path); }; return <Card title="More" className="profile-list-menu"><div>{items.map(([label, path]) => <button key={label} type="button" onClick={() => act(path)}><span>{label}</span><ChevronRight size={17} /></button>)}<button type="button" className="logout-link" onClick={() => { if (window.confirm('Are you sure you want to log out?')) { logout(); navigate('/login', { replace: true }); } }}><span><LogOut size={16} /> Logout</span><ChevronRight size={17} /></button></div></Card>; }
