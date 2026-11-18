import { useEffect, useState } from 'react';
import { MCGUIRE_URL } from '../flags.js';
import { useQrDataUrl } from './useQr.js';
import { pickupApi, scheduleLine } from './pickupApi.js';

// Printable field sign. Pure black on white so it survives a cheap printer
// or a photocopy; letter portrait.
export default function SignPage() {
  const qr = useQrDataUrl(MCGUIRE_URL);
  const [when, setWhen] = useState('');

  useEffect(() => {
    pickupApi
      .games()
      .then((d) => setWhen(scheduleLine(d.occurrences)))
      .catch(() => {});
  }, []);

  return (
    <div className="pk-sign">
      <button type="button" className="pk-btn pk-btn-go pk-print-btn" onClick={() => window.print()}>
        Print
      </button>
      <div className="pk-sign-sheet">
        <p className="pk-sign-kicker">McGuire Fields</p>
        <h1>Pickup Soccer</h1>
        {when && <p className="pk-sign-when">{when}</p>}
        <hr />
        <div className="pk-sign-body">
          {qr && <img className="pk-sign-qr" src={qr} alt={`QR code linking to ${MCGUIRE_URL}`} />}
          <div className="pk-sign-text">
            <p className="pk-sign-cta">Scan to sign up</p>
            <p>Put your name down so we know how many are coming.</p>
            <p>Free. All levels. No account.</p>
            <p>Bring a ball if you have one. Wear cleats.</p>
          </div>
        </div>
        <p className="pk-sign-url">{MCGUIRE_URL.replace(/^https?:\/\//, '')}</p>
        <p className="pk-sign-fine">
          Informal pickup game, not an organized event. Play at your own risk. Organized with Tether.
        </p>
      </div>
    </div>
  );
}
