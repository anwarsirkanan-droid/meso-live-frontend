import { NavLink, useLocation } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/messages', label: 'Messages', icon: '💬' },
  { to: '/profile', label: 'Me', icon: '👤' },
];

export default function BottomNav() {
  const location = useLocation();
  const loggedIn = Boolean(localStorage.getItem('token'));

  if (!loggedIn || ['/login', '/register'].includes(location.pathname)) return null;

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `bottom-nav-link${isActive ? ' active' : ''}`}
        >
          <span className="bottom-nav-icon" aria-hidden="true">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
