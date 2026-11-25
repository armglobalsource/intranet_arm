import { describe, expect, it } from 'vitest';
import { createHash, createPublicKey, generateKeyPairSync, verify } from 'crypto';
import { inflateRawSync } from 'zlib';
import * as forge from 'node-forge';
import { NotFoundException } from '@nestjs/common';
import { WalletTicket, applePass, applePassJson, crc32, googleSaveUrl, passSerial, walletDate, walletSettings } from './event-wallet';
import { EventWalletService } from './event-wallet.service';

function certificate(cn: string, keys = generateKeyPairSync('rsa', { modulusLength: 2048 })) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(keys.publicKey.export({ type: 'spki', format: 'pem' }).toString());
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01'); cert.validity.notAfter = new Date('2030-01-01');
  cert.setSubject([{ name: 'commonName', value: cn }]); cert.setIssuer([{ name: 'commonName', value: cn }]);
  const key = forge.pki.privateKeyFromPem(keys.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString());
  cert.sign(key, forge.md.sha256.create());
  return { certPem: forge.pki.certificateToPem(cert), keyPem: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
}
const signer = certificate('Pass Type ID: pass.org.armglobal.eventos');
const wwdr = certificate('Apple Worldwide Developer Relations');
const google = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = (values: Record<string, string>) => ({ get: (k: string) => values[k] });
const appleEnv = { APPLE_WALLET_PASS_TYPE_ID: 'pass.org.armglobal.eventos', APPLE_WALLET_TEAM_ID: 'ABCDE12345', APPLE_WALLET_CERT: signer.certPem, APPLE_WALLET_KEY: Buffer.from(signer.keyPem).toString('base64'), APPLE_WALLET_WWDR: wwdr.certPem };
const googleEnv = { GOOGLE_WALLET_ISSUER_ID: '3388000000012345678', GOOGLE_WALLET_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'wallet@arm.iam.gserviceaccount.com', private_key: google.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }) };

const ticket: WalletTicket = {
  id: '11111111-2222-3333-4444-555555555555', code: 'abcdef12-3456-7890-abcd-ef1234567890', holder: 'José Muñoz', ticketName: 'General', orderId: '99999999-2222-3333-4444-555555555555',
  event: { id: '257bc9ba-5f6b-426b-a944-df327e8e35d2', title: 'Retiro AR Hombres 2027', startsAt: '2027-01-15T22:00:00.000Z', endsAt: '2027-01-17T18:00:00.000Z', timezone: 'America/Santiago', location: 'Loncura', address: 'Camino 1234', color: '#2c5e4d', campusName: 'Santiago' },
};

/** Lector ZIP mínimo para comprobar el .pkpass generado. */
function unzip(buf: Buffer) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10); let p = buf.readUInt32LE(end + 16); const out: Record<string, Buffer> = {};
  for (let i = 0; i < count; i++) {
    const size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32), offset = buf.readUInt32LE(p + 42), crc = buf.readUInt32LE(p + 16);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const start = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
    out[name] = inflateRawSync(buf.subarray(start, start + size));
    expect(crc32(out[name])).toBe(crc);
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

describe('Wallet', () => {
  it('se activa solo con la configuración completa y coherente', () => {
    expect(walletSettings(env({}))).toEqual({ apple: null, google: null });
    const both = walletSettings(env({ ...appleEnv, ...googleEnv }));
    expect(both.apple?.passTypeId).toBe('pass.org.armglobal.eventos');
    expect(both.google?.email).toBe('wallet@arm.iam.gserviceaccount.com');
    // Clave de otro certificado: no se activa (Apple rechazaría el pase).
    expect(walletSettings(env({ ...appleEnv, APPLE_WALLET_KEY: certificate('otra').keyPem })).apple).toBeNull();
    expect(walletSettings(env({ ...appleEnv, APPLE_WALLET_TEAM_ID: 'abc' })).apple).toBeNull();
    expect(walletSettings(env({ ...googleEnv, GOOGLE_WALLET_SERVICE_ACCOUNT: '{no es json' })).google).toBeNull();
    expect(walletSettings(env({ ...googleEnv, GOOGLE_WALLET_SERVICE_ACCOUNT: Buffer.from(googleEnv.GOOGLE_WALLET_SERVICE_ACCOUNT).toString('base64') })).google).not.toBeNull();
  });

  it('acepta el certificado exportado como .p12', () => {
    const cert = forge.pki.certificateFromPem(signer.certPem);
    const key = forge.pki.privateKeyFromPem(forge.pki.privateKeyToPem(forge.pki.privateKeyFromPem(require('crypto').createPrivateKey(signer.keyPem).export({ type: 'pkcs1', format: 'pem' }).toString())));
    const p12 = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(key, [cert], 'clave', { algorithm: '3des' })).getBytes();
    const cfg = walletSettings(env({ ...appleEnv, APPLE_WALLET_CERT: '', APPLE_WALLET_KEY: '', APPLE_WALLET_P12: forge.util.encode64(p12), APPLE_WALLET_P12_PASSWORD: 'clave' }));
    expect(cfg.apple?.certPem).toContain('BEGIN CERTIFICATE');
  });

  it('arma el pase de Apple con el QR de la entrada, en la zona del evento', () => {
    const json = applePassJson({ passTypeId: 'pass.x', teamId: 'ABCDE12345' }, ticket, 'https://ecosistema.armglobal.org');
    expect(json.barcodes[0]).toMatchObject({ format: 'PKBarcodeFormatQR', message: ticket.code });
    expect(json.serialNumber).toBe(passSerial(ticket));
    expect(json.backgroundColor).toBe('rgb(44, 94, 77)');
    expect(walletDate(ticket)).toBe('vie 15 ene · 19:00 hrs');
    expect(json.eventTicket.secondaryFields[0]).toMatchObject({ label: 'ASISTENTE', value: 'José Muñoz' });
    // Al transferir, el código cambia y con él el número de serie.
    expect(passSerial({ ...ticket, code: 'otro' })).not.toBe(passSerial(ticket));
  });

  it('genera un .pkpass con manifest y firma PKCS#7 válidos', () => {
    const cfg = walletSettings(env(appleEnv)).apple!;
    const files = unzip(applePass(cfg, ticket, 'https://ecosistema.armglobal.org'));
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['pass.json', 'icon.png', 'icon@2x.png', 'logo.png', 'manifest.json', 'signature']));
    const manifest = JSON.parse(files['manifest.json'].toString());
    for (const [name, hash] of Object.entries(manifest)) expect(createHash('sha1').update(files[name]).digest('hex')).toBe(hash);
    expect(manifest.signature).toBeUndefined();
    expect(JSON.parse(files['pass.json'].toString()).teamIdentifier).toBe('ABCDE12345');

    // La firma incluye ambos certificados y su resumen corresponde exactamente al manifest.
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(files.signature.toString('binary'))) as any;
    expect(p7.certificates).toHaveLength(2);
    const signerInfo = p7.rawCapture.signerInfos[0];
    const attrs = signerInfo.value.find((v: any) => v.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && v.type === 0);
    const digest = attrs.value.map((a: any) => a.value).find((v: any) => forge.asn1.derToOid(v[0].value) === forge.pki.oids.messageDigest)[1].value[0].value;
    expect(Buffer.from(digest, 'binary').toString('hex')).toBe(createHash('sha256').update(files['manifest.json']).digest('hex'));
    // La firma RSA cubre los atributos firmados (codificados como SET).
    const set = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs.value);
    const sig = signerInfo.value[signerInfo.value.length - 1].value;
    const pub = createPublicKey(signer.certPem.replace(/[\s\S]*/, (c) => forge.pki.publicKeyToPem(forge.pki.certificateFromPem(c).publicKey)));
    expect(verify('sha256', Buffer.from(forge.asn1.toDer(set).getBytes(), 'binary'), pub, Buffer.from(sig, 'binary'))).toBe(true);
  });

  it('firma el enlace de Google Wallet con la cuenta de servicio', () => {
    const cfg = walletSettings(env(googleEnv)).google!;
    const url = googleSaveUrl(cfg, ticket, 'https://ecosistema.armglobal.org', Date.parse('2026-11-25T12:00:00Z'));
    expect(url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true);
    const [h, c, s] = url.split('/').pop()!.split('.');
    expect(verify('RSA-SHA256', Buffer.from(`${h}.${c}`), google.publicKey, Buffer.from(s, 'base64url'))).toBe(true);
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(claims).toMatchObject({ iss: 'wallet@arm.iam.gserviceaccount.com', aud: 'google', typ: 'savetowallet', origins: ['https://ecosistema.armglobal.org'] });
    const object = claims.payload.eventTicketObjects[0];
    expect(object).toMatchObject({ classId: '3388000000012345678.evento-257bc9ba-5f6b-426b-a944-df327e8e35d2', ticketHolderName: 'José Muñoz', barcode: { type: 'QR_CODE', value: ticket.code } });
    expect(object.id).toMatch(/^3388000000012345678\.[A-Za-z0-9._-]+$/);
  });

  describe('servicio', () => {
    const config = env({ ...appleEnv, ...googleEnv, EVENT_REGISTRATION_SECRET: 'x'.repeat(40), FRONTEND_URL: 'https://ecosistema.armglobal.org' });
    const row = { id: ticket.id, order_id: ticket.orderId, status: 'confirmed', ticket_code: ticket.code, participant: { firstName: 'José', lastName: 'Muñoz' }, snapshot: { ticketName: 'General' },
      order_status: 'confirmed', event_id: ticket.event.id, title: ticket.event.title, starts_at: ticket.event.startsAt, ends_at: ticket.event.endsAt, event_status: 'published', details: { timezone: 'America/Santiago', location: 'Loncura', color: '#2c5e4d' }, campus_name: 'Santiago' };
    const service = (r: any) => new EventWalletService({ query: async () => ({ rows: r ? [r] : [] }) } as any, config as any);
    const sig = (links: { apple?: string }) => new URL(links.apple!).searchParams.get('s')!;

    it('entrega enlaces firmados por entrada y código', () => {
      const links = service(row).links(ticket.id, ticket.code);
      expect(links.apple).toBe(`https://ecosistema.armglobal.org/api/v1/event-wallet/${ticket.id}/apple?s=${sig(links)}`);
      expect(links.google).toContain(`/api/v1/event-wallet/${ticket.id}/google?s=`);
      expect(new EventWalletService({} as any, env({}) as any).links(ticket.id, ticket.code)).toEqual({});
    });

    it('solo entrega el pase de una entrada confirmada y con el código vigente', async () => {
      const s = sig(service(row).links(ticket.id, ticket.code));
      const pass = await service(row).apple(ticket.id, s);
      expect(pass.file.readUInt32LE(0)).toBe(0x04034b50);
      expect(await service(row).google(ticket.id, s)).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\//);
      await expect(service(row).apple(ticket.id, 'firma-falsa')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service({ ...row, ticket_code: 'transferida' }).apple(ticket.id, s)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service({ ...row, status: 'cancelled' }).apple(ticket.id, s)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service({ ...row, order_status: 'pending_payment' }).google(ticket.id, s)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service({ ...row, event_status: 'cancelled' }).apple(ticket.id, s)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service(null).apple(ticket.id, s)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
