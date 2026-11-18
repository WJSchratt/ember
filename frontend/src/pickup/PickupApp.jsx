import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PickupHome from './PickupHome.jsx';
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

// The whole app while PICKUP_ONLY is on. No auth provider, no nav, no rooms.
export default function PickupApp() {
  usePickupChrome();
  const { pathname } = useLocation();
  const printable = pathname === '/sign';

  return (
    <div className={`pickup-shell${printable ? ' printable' : ''}`}>
      {/* Home has its own masthead; other pages get a plain strip back to it. */}
      {!printable && pathname !== '/' && (
        <div className="pk-topbar">
          <Link to="/">&larr; Pickup Soccer at McGuire Fields</Link>
        </div>
      )}
      <main className="pk-main">
        <Routes>
          <Route path="/" element={<PickupHome />} />
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
