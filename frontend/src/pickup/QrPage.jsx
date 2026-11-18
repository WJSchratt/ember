import { Link } from 'react-router-dom';
import { PUBLIC_URL } from '../flags.js';
import { useQrDataUrl } from './useQr.js';

export default function QrPage() {
  const qr = useQrDataUrl(PUBLIC_URL);
  return (
    <div className="page pk-page">
      <h1 className="pk-title pk-title-sm">QR code</h1>
      <div className="card pk-qr-card">
        {qr && <img src={qr} alt={`QR code linking to ${PUBLIC_URL}`} className="pk-qr-img" />}
        <p className="muted">Points to {PUBLIC_URL}</p>
        <div className="pk-actions">
          {qr && (
            <a className="btn btn-primary" href={qr} download="mcguire-pickup-qr.png">
              <i className="ti ti-download" aria-hidden="true" /> Download PNG
            </a>
          )}
          <Link className="btn btn-ghost" to="/sign">
            Printable sign
          </Link>
        </div>
      </div>
    </div>
  );
}
