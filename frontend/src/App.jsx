import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { initials } from './ui.js';
import Sidebar from './Sidebar.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Profile from './pages/Profile.jsx';
import Events from './pages/Events.jsx';
import Rooms from './pages/Rooms.jsx';
import CreateEvent from './pages/CreateEvent.jsx';
import Room from './pages/Room.jsx';

function RequireAuth({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="page">Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const authed = !loading && user;
  const bareRoute = ['/login', '/signup'].includes(location.pathname);

  return (
    <div className="app-shell">
      {authed && !bareRoute && <Sidebar user={user} onLogout={logout} />}

      <div className="main-column">
        {!bareRoute && (
          <div className="appbar">
            <span className="brand">
              <i className="ti ti-flame" aria-hidden="true" /> Roomless
            </span>
            {authed && (
              <NavLink to="/profile" className="avatar avatar-sm" style={{ width: 32, height: 32, fontSize: 12 }}>
                {initials(user.displayName)}
              </NavLink>
            )}
          </div>
        )}

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Events />
              </RequireAuth>
            }
          />
          <Route
            path="/rooms"
            element={
              <RequireAuth>
                <Rooms />
              </RequireAuth>
            }
          />
          <Route
            path="/create"
            element={
              <RequireAuth>
                <CreateEvent />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:id"
            element={
              <RequireAuth>
                <Room />
              </RequireAuth>
            }
          />
        </Routes>

        {authed && !bareRoute && (
          <nav className="bottomnav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              <i className="ti ti-home" aria-hidden="true" />
            </NavLink>
            <NavLink to="/rooms" className={({ isActive }) => (isActive ? 'active' : '')}>
              <i className="ti ti-message-circle" aria-hidden="true" />
            </NavLink>
            <NavLink to="/create" className={({ isActive }) => (isActive ? 'active' : '')}>
              <i className="ti ti-circle-plus" aria-hidden="true" />
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
              <i className="ti ti-user" aria-hidden="true" />
            </NavLink>
          </nav>
        )}
      </div>
    </div>
  );
}
