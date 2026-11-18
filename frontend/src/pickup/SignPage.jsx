import { PUBLIC_URL } from '../flags.js';
import { useQrDataUrl } from './useQr.js';

// Printable field sign. Letter/A4 portrait; white background so it prints clean.
export default function SignPage() {
  const qr = useQrDataUrl(PUBLIC_URL);
  return (
    <div className="pk-sign">
      <button type="button" className="btn btn-primary pk-print-btn" onClick={() => window.print()}>
        <i className="ti ti-printer" aria-hidden="true" /> Print sign
      </button>
      <div className="pk-sign-sheet">
        <div className="pk-sign-ball" aria-hidden="true">
          <i className="ti ti-ball-football" />
        </div>
        <h1>Pickup Soccer</h1>
        <h2>at McGuire Fields</h2>
        {qr && <img className="pk-sign-qr" src={qr} alt={`QR code linking to ${PUBLIC_URL}`} />}
        <p className="pk-sign-cta">Scan to sign up</p>
        <p className="pk-sign-sub">Free &middot; All levels &middot; No account needed</p>
        <p className="pk-sign-url">{PUBLIC_URL.replace(/^https?:\/\//, '')}</p>
        <p className="pk-sign-fine">Informal pickup game, not an organized event. Play at your own risk.</p>
      </div>
    </div>
  );
}
