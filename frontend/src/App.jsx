import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Profile from './pages/Profile.jsx';
import Events from './pages/Events.jsx';
import CreateEvent from './pages/CreateEvent.jsx';
import Room from './pages/Room.jsx';

function RequireAuth({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="container">Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, logout, loading } = useAuth();

  return (
    <>
      <nav className="topbar">
        <span className="brand">Ember 🔥</span>
        <span className="links">
          {!loading && user ? (
            <>
              <NavLink to="/">Events</NavLink>
              <NavLink to="/create">Create</NavLink>
              <NavLink to="/profile">Profile ({user.displayName})</NavLink>
              <button onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/signup">Sign up</NavLink>
            </>
          )}
        </span>
      </nav>

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
    </>
  );
}
