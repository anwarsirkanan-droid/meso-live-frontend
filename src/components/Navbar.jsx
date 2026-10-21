import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const { pathname } = useLocation();
  if (pathname === '/') return null;
  return (
    <header className="topbar">
      <Link to="/" className="brand">Meso <span>Live</span></Link>
    </header>
  );
}
