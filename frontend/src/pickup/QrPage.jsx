import { Link } from 'react-router-dom';
import { MCGUIRE_URL } from '../flags.js';
import { useQrDataUrl } from './useQr.js';

export default function QrPage() {
  const qr = useQrDataUrl(MCGUIRE_URL);
  return (
    <div className="pk-page">
      <h1 className="pk-title pk-title-sm">QR code</h1>
      <div className="pk-block pk-qr-card">
        {qr && <img src={qr} alt={`QR code linking to ${MCGUIRE_URL}`} className="pk-qr-img" />}
        <p className="pk-quiet">Points to {MCGUIRE_URL}</p>
        <div className="pk-actions">
          {qr && (
            <a className="pk-btn pk-btn-go" href={qr} download="mcguire-pickup-qr.png">
              Download PNG
            </a>
          )}
          <Link className="pk-btn pk-btn-plain" to="/sign">
            Printable sign
          </Link>
        </div>
      </div>
    </div>
  );
}
