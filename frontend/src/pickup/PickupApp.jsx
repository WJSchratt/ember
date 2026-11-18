import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PickupHome from './PickupHome.jsx';
import Privacy from './Privacy.jsx';
import Admin from './Admin.jsx';
import SignPage from './SignPage.jsx';
import QrPage from './QrPage.jsx';
import './pickup.css';

// The whole app while PICKUP_ONLY is on. No auth provider, no nav, no rooms.
export default function PickupApp() {
  const { pathname } = useLocation();
  const printable = pathname === '/sign';

  return (
    <div className={`app-shell pickup-shell${printable ? ' printable' : ''}`}>
      <div className="main-column">
        {!printable && (
          <div className="appbar">
            <Link to="/" className="brand">
              <i className="ti ti-ball-football" aria-hidden="true" /> McGuire Pickup
            </Link>
            <span className="pk-free-tag">Free</span>
          </div>
        )}
        <Routes>
          <Route path="/" element={<PickupHome />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/sign" element={<SignPage />} />
          <Route path="/qr" element={<QrPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
