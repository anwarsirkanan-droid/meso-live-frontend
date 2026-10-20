import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <header className="topbar">
      <Link to="/" className="brand">Meso <span>Live</span></Link>
    </header>
  );
}
