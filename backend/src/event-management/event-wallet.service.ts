import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { WalletSettings, WalletTicket, applePass, googleSaveUrl, walletSettings } from './event-wallet';

export type WalletLinks = { apple?: string; google?: string };
const fullName = (p: any) => [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim();

/**
 * Pases de Wallet por entrada. Los enlaces van firmados con el ID y el código vigente de la entrada:
 * no caducan, pero dejan de servir si la entrada se transfiere (cambia el código) o se anula.
 */
@Injectable()
export class EventWalletService {
  private cached?: WalletSettings;
  constructor(private readonly db: DatabaseService, private readonly config: ConfigService) {}

  settings() { return (this.cached ??= walletSettings(this.config)); }
  providers() { const s = this.settings(); return { apple: !!s.apple, google: !!s.google }; }

  private secret() {
    const secret = this.config.get<string>('EVENT_REGISTRATION_SECRET') ?? '';
    if (secret.length < 32) throw new ServiceUnavailableException('Las inscripciones todavía no están configuradas.');
    return secret;
  }
  private origin() {
    try { const u = new URL(this.config.get<string>('FRONTEND_URL') ?? ''); if (u.protocol === 'https:') return u.origin; } catch { /* sin configurar */ }
    throw new ServiceUnavailableException('Las inscripciones todavía no están configuradas.');
  }
  private signature(ticketId: string, code: string) { return createHmac('sha256', this.secret()).update(`wallet:${ticketId}:${code}`).digest('base64url'); }

  /** Enlaces para una entrada confirmada; vacío si no hay billeteras configuradas. */
  links(ticketId: string, code: string | null | undefined): WalletLinks {
    const p = this.providers();
    if (!code || (!p.apple && !p.google)) return {};
    try {
      const base = `${this.origin()}/api/v1/event-wallet/${ticketId}`; const s = this.signature(ticketId, code);
      return { ...(p.apple ? { apple: `${base}/apple?s=${s}` } : {}), ...(p.google ? { google: `${base}/google?s=${s}` } : {}) };
    } catch { return {}; }
  }

  private async ticket(ticketId: string, s: string): Promise<WalletTicket> {
    const row = (await this.db.query(`SELECT r.id,r.order_id,r.status,r.ticket_code,r.participant,r.snapshot,o.status AS order_status,
      e.id AS event_id,e.title,e.starts_at,e.ends_at,e.status AS event_status,e.details,c.name AS campus_name
      FROM arm_app.event_registrations r JOIN arm_app.event_orders o ON o.id=r.order_id JOIN arm_app.event_programs e ON e.id=r.event_id
      LEFT JOIN arm_app.campuses c ON c.id=e.campus_id WHERE r.id=$1`, [ticketId])).rows[0];
    const code = row?.ticket_code ?? row?.id;
    const expected = row ? Buffer.from(this.signature(row.id, code)) : Buffer.alloc(0);
    const given = Buffer.from(String(s ?? ''));
    const valid = row && given.length === expected.length && timingSafeEqual(given, expected);
    // Mismo mensaje para todo: no revela si la entrada existe.
    if (!valid || row.status !== 'confirmed' || row.order_status !== 'confirmed' || row.event_status === 'cancelled') throw new NotFoundException('Esta entrada ya no está vigente. Revisa tus entradas en Mis entradas.');
    const d = row.details ?? {};
    return {
      id: row.id, code, orderId: row.order_id, holder: fullName(row.participant) || 'Asistente', ticketName: row.snapshot?.ticketName ?? 'Entrada',
      event: { id: row.event_id, title: row.title, startsAt: new Date(row.starts_at).toISOString(), endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null, timezone: d.timezone ?? 'America/Santiago',
        location: d.location, address: d.address, online: d.modality === 'online', color: d.color, bannerUrl: d.bannerUrl, campusName: row.campus_name },
    };
  }

  async apple(ticketId: string, s: string) {
    const cfg = this.settings().apple;
    if (!cfg) throw new NotFoundException('Apple Wallet todavía no está disponible.');
    const t = await this.ticket(ticketId, s);
    return { file: applePass(cfg, t, this.origin()), name: `entrada-${t.id.slice(0, 8)}.pkpass` };
  }
  async google(ticketId: string, s: string) {
    const cfg = this.settings().google;
    if (!cfg) throw new NotFoundException('Google Wallet todavía no está disponible.');
    return googleSaveUrl(cfg, await this.ticket(ticketId, s), this.origin());
  }
}
