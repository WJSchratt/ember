// Writes a printable QR code PNG pointing at the live McGuire Fields sign-up page.
//   npm run qr                         -> public/mcguire-pickup-qr.png (served at /mcguire-pickup-qr.png)
//   npm run qr -- https://other.url out.png
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import QRCode from 'qrcode';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Must match MCGUIRE_URL in src/flags.js.
const base = process.env.VITE_PUBLIC_URL || 'https://ember-web-three.vercel.app';
const url = process.argv[2] || `${base}/pickup/mcguire`;
const out = path.resolve(process.argv[3] || path.join(root, 'public', 'mcguire-pickup-qr.png'));

fs.mkdirSync(path.dirname(out), { recursive: true });
await QRCode.toFile(out, url, {
  errorCorrectionLevel: 'M',
  margin: 2,
  width: 1200,
  color: { dark: '#000000', light: '#ffffff' },
});
console.log(`QR for ${url} -> ${out}`);
