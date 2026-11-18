import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Same options as scripts/make-qr.mjs so the on-screen and printed codes match.
export const QR_OPTIONS = { errorCorrectionLevel: 'M', margin: 2, width: 1024, color: { dark: '#000000', light: '#ffffff' } };

export function useQrDataUrl(text) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, QR_OPTIONS).then(setUrl).catch(() => setUrl(''));
  }, [text]);
  return url;
}
