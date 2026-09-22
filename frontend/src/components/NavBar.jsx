import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GmailConnectButton from './GmailConnectButton';

export default function NavBar() {
  const { user, signOutUser, guestMode, exitGuestMode } = useAuth();

  return (
    <div className="nav-bar">
      <div className="nav-inner">
        <span className="nav-brand">
          <img src="/logo.svg" alt="" className="nav-logo" />
          Baltic Job Radar
        </span>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Dashboard
          </NavLink>
          <NavLink to="/jobs" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Jobs
          </NavLink>
          <NavLink
            to="/external-jobs"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Job Boards
          </NavLink>
        </nav>
        {user && (
          <div className="nav-user">
            <GmailConnectButton />
            {user.photoURL && <img className="nav-avatar" src={user.photoURL} alt="" />}
            <span className="nav-email">{user.email}</span>
            <button className="link-btn" onClick={signOutUser}>
              Sign out
            </button>
          </div>
        )}
        {!user && guestMode && (
          <div className="nav-user">
            <span className="guest-badge">Guest — read only</span>
            <button className="link-btn" onClick={exitGuestMode}>
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
