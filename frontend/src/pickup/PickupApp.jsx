import { useEffect } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import TetherHome from './TetherHome.jsx';
import McGuirePage from './McGuirePage.jsx';
import { MCGUIRE_PATH } from '../flags.js';
import Privacy from './Privacy.jsx';
import Admin from './Admin.jsx';
import SignPage from './SignPage.jsx';
import QrPage from './QrPage.jsx';
import './pickup.css';

// Pickup mode has its own look (light "team sheet"), so it loads its own fonts
// and flips the page background; the legacy dark theme is left untouched.
const FONTS =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap';
function usePickupChrome() {
  useEffect(() => {
    if (!document.getElementById('pk-fonts')) {
      document.head.appendChild(Object.assign(document.createElement('link'), { id: 'pk-fonts', rel: 'stylesheet', href: FONTS }));
    }
    document.body.classList.add('pk-body');
    return () => document.body.classList.remove('pk-body');
  }, []);
}

// Tether's app shell while PICKUP_ONLY is on: Tether brand + a light nav over
// the pickup pages. Accounts, rooms, chat and AI stay paused behind the flag.
export default function PickupApp() {
  usePickupChrome();
  const { pathname } = useLocation();
  const printable = pathname === '/sign';

  return (
    <div className={`pickup-shell${printable ? ' printable' : ''}`}>
      {!printable && (
        <header className="pk-topbar">
          <Link to="/" className="pk-brand" aria-label="Tether home">
            <i className="ti ti-flame" aria-hidden="true" />
            Tether
          </Link>
          <nav className="pk-nav" aria-label="Tether">
            <NavLink to="/" end>
              Pickup games
            </NavLink>
            <NavLink to={MCGUIRE_PATH}>McGuire</NavLink>
          </nav>
        </header>
      )}
      <main className="pk-main">
        <Routes>
          <Route path="/" element={<TetherHome />} />
          <Route path={MCGUIRE_PATH} element={<McGuirePage />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/sign" element={<SignPage />} />
          <Route path="/qr" element={<QrPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
