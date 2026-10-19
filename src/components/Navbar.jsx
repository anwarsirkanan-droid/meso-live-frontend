import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      <Link to="/" className="brand">Meso <span>Live</span></Link>
      <button className="button button-quiet button-small" onClick={logout} type="button">
        Log out
      </button>
    </header>
  );
}
