import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, signOutUser } = useAuth();

  return (
    <div className="nav-bar">
      <div className="nav-inner">
        <span className="nav-brand">Unicorns Lithuania</span>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Dashboard
          </NavLink>
          <NavLink to="/jobs" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Jobs
          </NavLink>
        </nav>
        {user && (
          <div className="nav-user">
            {user.photoURL && <img className="nav-avatar" src={user.photoURL} alt="" />}
            <span className="nav-email">{user.email}</span>
            <button className="link-btn" onClick={signOutUser}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
