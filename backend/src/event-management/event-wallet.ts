// Entradas en Apple Wallet (.pkpass firmado) y Google Wallet (enlace «Guardar» con JWT firmado).
// El QR del pase es el mismo código de la entrada que lee el control de acceso.
import { createHash, createPrivateKey, sign as rsaSign } from 'crypto';
import { deflateRawSync } from 'zlib';
import * as forge from 'node-forge';
import { WALLET_IMAGES } from './event-wallet-assets';

export type WalletTicket = {
  id: string; code: string; holder: string; ticketName: string; orderId: string;
  event: { id: string; title: string; startsAt: string; endsAt?: string | null; timezone: string; location?: string; address?: string; online?: boolean; color?: string; bannerUrl?: string; campusName?: string };
};
export type AppleWallet = { passTypeId: string; teamId: string; certPem: string; keyPem: string; wwdrPem: string };
export type GoogleWallet = { issuerId: string; email: string; privateKey: string };
export type WalletSettings = { apple: AppleWallet | null; google: GoogleWallet | null };
type Env = { get<T = string>(key: string): T | undefined };

/** Acepta PEM directo, PEM en base64 o DER en base64 (como se pega en Vercel). */
function pem(value: string | undefined, label: string) {
  const v = (value ?? '').trim().replace(/\\n/g, '\n');
  if (!v) return '';
  if (v.includes('-----BEGIN')) return v;
  const raw = Buffer.from(v, 'base64');
  const text = raw.toString('utf8');
  if (text.includes('-----BEGIN')) return text;
  return `-----BEGIN ${label}-----\n${raw.toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END ${label}-----\n`;
}

/**
 * Lee la configuración de las billeteras. Cada una se activa sola cuando están todas sus variables;
 * si algo no calza (certificado y clave de otro par, JSON inválido), queda desactivada en vez de fallar.
 */
export function walletSettings(env: Env): WalletSettings {
  let apple: AppleWallet | null = null;
  try {
    const passTypeId = env.get('APPLE_WALLET_PASS_TYPE_ID')?.trim() ?? '';
    const teamId = env.get('APPLE_WALLET_TEAM_ID')?.trim() ?? '';
    const wwdrPem = pem(env.get('APPLE_WALLET_WWDR'), 'CERTIFICATE');
    let certPem = pem(env.get('APPLE_WALLET_CERT'), 'CERTIFICATE');
    let keyPem = pem(env.get('APPLE_WALLET_KEY'), 'PRIVATE KEY');
    const p12 = env.get('APPLE_WALLET_P12')?.trim();
    if (p12 && (!certPem || !keyPem)) {
      // Certificado exportado desde el llavero como .p12 (base64) con su contraseña.
      const der = forge.util.decode64(p12);
      const store = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), String(env.get('APPLE_WALLET_P12_PASSWORD') ?? ''));
      const cert = store.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0]?.cert;
      const key = store.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key
        ?? store.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0]?.key;
      if (cert && key) { certPem = forge.pki.certificateToPem(cert); keyPem = forge.pki.privateKeyToPem(key as forge.pki.rsa.PrivateKey); }
    }
    if (/^[A-Za-z0-9.-]{3,}$/.test(passTypeId) && /^[A-Z0-9]{10}$/.test(teamId) && certPem && keyPem && wwdrPem) {
      // Normaliza la clave a PKCS#1/PKCS#8 legible por forge y comprueba que sea del mismo certificado.
      const key = forge.pki.privateKeyFromPem(createPrivateKey(keyPem).export({ type: 'pkcs1', format: 'pem' }).toString()) as forge.pki.rsa.PrivateKey;
      const cert = forge.pki.certificateFromPem(certPem);
      forge.pki.certificateFromPem(wwdrPem);
      const pub = cert.publicKey as forge.pki.rsa.PublicKey;
      if (pub.n.equals(key.n)) apple = { passTypeId, teamId, certPem, keyPem: forge.pki.privateKeyToPem(key), wwdrPem };
    }
  } catch { apple = null; }

  let google: GoogleWallet | null = null;
  try {
    const issuerId = env.get('GOOGLE_WALLET_ISSUER_ID')?.trim() ?? '';
    const raw = env.get('GOOGLE_WALLET_SERVICE_ACCOUNT')?.trim() ?? '';
    if (/^\d{6,30}$/.test(issuerId) && raw) {
      const json = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
      if (typeof json.client_email === 'string' && typeof json.private_key === 'string') {
        createPrivateKey(json.private_key);
        google = { issuerId, email: json.client_email, privateKey: json.private_key };
      }
    }
  } catch { google = null; }
  return { apple, google };
}

// ── Formato común ──
const HEX = /^#[0-9a-f]{6}$/i;
const colorOf = (t: WalletTicket) => (HEX.test(t.event.color ?? '') ? t.event.color! : '#31302e');
const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
function when(value: string, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  try { return new Intl.DateTimeFormat('es-CL', { ...opts, timeZone }).format(new Date(value)); } catch { return new Intl.DateTimeFormat('es-CL', opts).format(new Date(value)); }
}
export function walletDate(t: WalletTicket) {
  const tz = t.event.timezone || 'America/Santiago';
  return `${when(t.event.startsAt, tz, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[.,]/g, '')} · ${when(t.event.startsAt, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} hrs`;
}
const place = (t: WalletTicket) => (t.event.online ? 'Evento online' : t.event.location || 'Por confirmar');
/** Identificador estable por entrada y código: al transferirla cambia el código y nace un pase nuevo. */
export const passSerial = (t: WalletTicket) => `${t.id}-${createHash('sha256').update(t.code).digest('hex').slice(0, 12)}`;

// ── Apple Wallet ──
export function applePassJson(cfg: Pick<AppleWallet, 'passTypeId' | 'teamId'>, t: WalletTicket, origin: string) {
  const color = colorOf(t);
  const end = t.event.endsAt || new Date(Date.parse(t.event.startsAt) + 3 * 3600_000).toISOString();
  return {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    serialNumber: passSerial(t),
    organizationName: 'ARM Global',
    description: `Entrada · ${t.event.title}`,
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(255, 255, 255)',
    backgroundColor: rgb(color),
    // iOS muestra el pase en la pantalla bloqueada cerca de la hora del evento.
    relevantDate: new Date(t.event.startsAt).toISOString(),
    relevantDates: [{ startDate: new Date(Date.parse(t.event.startsAt) - 3 * 3600_000).toISOString(), endDate: new Date(end).toISOString() }],
    expirationDate: new Date(Date.parse(end) + 24 * 3600_000).toISOString(),
    eventTicket: {
      headerFields: [{ key: 'date', label: 'FECHA', value: walletDate(t) }],
      primaryFields: [{ key: 'event', label: 'EVENTO', value: t.event.title }],
      secondaryFields: [{ key: 'holder', label: 'ASISTENTE', value: t.holder }, { key: 'ticket', label: 'ENTRADA', value: t.ticketName, textAlignment: 'PKTextAlignmentRight' }],
      auxiliaryFields: [{ key: 'place', label: 'LUGAR', value: place(t) }],
      backFields: [
        ...(t.event.address && !t.event.online ? [{ key: 'address', label: 'Dirección', value: t.event.address }] : []),
        ...(t.event.campusName ? [{ key: 'campus', label: 'Organiza', value: t.event.campusName }] : []),
        { key: 'code', label: 'Código de la entrada', value: t.code },
        { key: 'help', label: 'Tus entradas', value: `Transfiere o revisa tus entradas en ${origin}/mis-entradas` },
      ],
    },
    barcodes: [{ format: 'PKBarcodeFormatQR', message: t.code, messageEncoding: 'iso-8859-1', altText: t.code.slice(0, 8).toUpperCase() }],
    barcode: { format: 'PKBarcodeFormatQR', message: t.code, messageEncoding: 'iso-8859-1', altText: t.code.slice(0, 8).toUpperCase() },
  };
}

/** Firma PKCS#7 separada del manifest, con el certificado del Pass Type ID y el intermedio WWDR de Apple. */
export function signManifest(cfg: Pick<AppleWallet, 'certPem' | 'keyPem' | 'wwdrPem'>, manifest: Buffer, now = new Date()) {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString('binary'));
  const cert = forge.pki.certificateFromPem(cfg.certPem);
  p7.addCertificate(cert);
  p7.addCertificate(forge.pki.certificateFromPem(cfg.wwdrPem));
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(cfg.keyPem) as any, certificate: cert, digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [{ type: forge.pki.oids.contentType, value: forge.pki.oids.data }, { type: forge.pki.oids.messageDigest }, { type: forge.pki.oids.signingTime, value: now as any }],
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
}

// ZIP mínimo (deflate) para el .pkpass: sin dependencias externas.
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export function crc32(buf: Buffer) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function zip(files: Record<string, Buffer>) {
  const local: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const fname = Buffer.from(name, 'utf8'); const packed = deflateRawSync(data); const crc = crc32(data);
    const head = Buffer.alloc(30); head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
    head.writeUInt16LE(0, 10); head.writeUInt16LE(0x21, 12); head.writeUInt32LE(crc, 14); head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(fname.length, 26); head.writeUInt16LE(0, 28);
    const dir = Buffer.alloc(46); dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(0x0800, 8); dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(0, 12); dir.writeUInt16LE(0x21, 14); dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(packed.length, 20); dir.writeUInt32LE(data.length, 24); dir.writeUInt16LE(fname.length, 28); dir.writeUInt32LE(offset, 42);
    local.push(head, fname, packed); central.push(dir, fname); offset += 30 + fname.length + packed.length;
  }
  const dirBuf = Buffer.concat(central); const end = Buffer.alloc(22); const count = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(dirBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, dirBuf, end]);
}

/** Archivos del pase: pass.json, imágenes, manifest (SHA-1 de cada archivo) y firma. */
export function applePassFiles(cfg: AppleWallet, t: WalletTicket, origin: string, now = new Date()) {
  const files: Record<string, Buffer> = { 'pass.json': Buffer.from(JSON.stringify(applePassJson(cfg, t, origin)), 'utf8') };
  for (const [name, data] of Object.entries(WALLET_IMAGES)) files[name] = Buffer.from(data, 'base64');
  const manifest = Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(files).map(([n, d]) => [n, createHash('sha1').update(d).digest('hex')]))), 'utf8');
  files['manifest.json'] = manifest;
  files.signature = signManifest(cfg, manifest, now);
  return files;
}
export const applePass = (cfg: AppleWallet, t: WalletTicket, origin: string) => zip(applePassFiles(cfg, t, origin));

// ── Google Wallet ──
const text = (value: string) => ({ defaultValue: { language: 'es-CL', value } });
const gid = (issuer: string, value: string) => `${issuer}.${value.replace(/[^A-Za-z0-9._-]/g, '_')}`;
export function googlePayload(cfg: Pick<GoogleWallet, 'issuerId'>, t: WalletTicket, origin: string) {
  const color = colorOf(t);
  const classId = gid(cfg.issuerId, `evento-${t.event.id}`);
  const banner = /^https:\/\//.test(t.event.bannerUrl ?? '') ? t.event.bannerUrl! : '';
  return {
    eventTicketClasses: [{
      id: classId, issuerName: 'ARM Global', reviewStatus: 'UNDER_REVIEW',
      eventName: text(t.event.title),
      logo: { sourceUri: { uri: `${origin}/arm-brand-icon-192.png` }, contentDescription: text('ARM Global') },
      ...(banner ? { heroImage: { sourceUri: { uri: banner }, contentDescription: text(t.event.title) } } : {}),
      hexBackgroundColor: color,
      venue: { name: text(place(t)), address: text(t.event.online ? 'Online' : t.event.address || place(t)) },
      dateTime: { start: new Date(t.event.startsAt).toISOString(), ...(t.event.endsAt ? { end: new Date(t.event.endsAt).toISOString() } : {}) },
      homepageUri: { uri: `${origin}/mis-entradas`, description: 'Mis entradas' },
    }],
    eventTicketObjects: [{
      id: gid(cfg.issuerId, `entrada-${passSerial(t)}`), classId, state: 'ACTIVE',
      ticketHolderName: t.holder, ticketType: text(t.ticketName), hexBackgroundColor: color,
      barcode: { type: 'QR_CODE', value: t.code, alternateText: t.code.slice(0, 8).toUpperCase() },
      textModulesData: [{ id: 'fecha', header: 'Fecha', body: walletDate(t) }],
    }],
  };
}
const b64url = (v: Buffer | string) => Buffer.from(v).toString('base64url');
/** Enlace «Guardar en Google Wallet» (JWT RS256 firmado con la cuenta de servicio). */
export function googleSaveUrl(cfg: GoogleWallet, t: WalletTicket, origin: string, now = Date.now()) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: cfg.email, aud: 'google', typ: 'savetowallet', iat: Math.floor(now / 1000), origins: [origin], payload: googlePayload(cfg, t, origin) }));
  const signature = rsaSign('RSA-SHA256', Buffer.from(`${header}.${claims}`), cfg.privateKey);
  return `https://pay.google.com/gp/v/save/${header}.${claims}.${b64url(signature)}`;
}
