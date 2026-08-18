import { NavLink } from 'react-router-dom';
import { initials, avatarHueClass } from './ui.js';

export default function Sidebar({ user, onLogout }) {
  return (
    <nav className="sidebar">
      <span className="brand" style={{ padding: '0 0 1.5rem' }}>
        <i className="ti ti-flame" aria-hidden="true" /> Roomless
      </span>

      <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
        <i className="ti ti-home" aria-hidden="true" />
        <span>Home</span>
      </NavLink>
      <NavLink to="/rooms" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
        <i className="ti ti-message-circle" aria-hidden="true" />
        <span>Rooms</span>
      </NavLink>
      <NavLink to="/create" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
        <i className="ti ti-circle-plus" aria-hidden="true" />
        <span>Create</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
        <i className="ti ti-user" aria-hidden="true" />
        <span>Profile</span>
      </NavLink>

      <div style={{ flex: 1 }} />

      <div className="sidebar-user">
        <span className={`avatar avatar-sm ${avatarHueClass(user.id)}`}>{initials(user.displayName)}</span>
        <span className="muted" style={{ fontSize: 13 }}>{user.displayName}</span>
        <button className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '5px 10px' }} onClick={onLogout}>
          <i className="ti ti-logout" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
