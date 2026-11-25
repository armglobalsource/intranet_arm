import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { EventActor } from './event-program.rules';
import { EventAttendanceService } from './event-attendance.service';

// Equipaje: cada bolso lleva una etiqueta con QR ligada a una entrada confirmada.
// Se registra en la puerta o en la mesa de equipaje y se entrega escaneando la etiqueta y la entrada del dueño.
// Usa los mismos permisos que la puerta (quien registra ingresos también recibe y entrega bolsos).

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0 ni 1: se leen igual al escribirlos
export const MAX_BAGS = 10;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export type DeliverResult = 'ok' | 'mismatch' | 'already' | 'void' | 'not_found';

export function newBagCode(rand: (max: number) => number = randomInt) {
  return Array.from({ length: 8 }, () => ALPHABET[rand(ALPHABET.length)]).join('');
}
/** Lo que escribe el QR de la etiqueta (y lo que se puede teclear): «ARMEQ-7K3Q9XHM» o «7K3Q-9XHM». */
export function bagCodeIn(text: string) {
  const t = String(text ?? '').toUpperCase();
  const tagged = /ARMEQ-([A-Z0-9]{8})/.exec(t)?.[1];
  if (tagged) return tagged;
  const plain = t.replace(/[\s-]/g, '');
  return /^[A-Z0-9]{8}$/.test(plain) ? plain : null;
}
const name = (p: any) => [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim();

const BAG_SQL = `SELECT b.id,b.code,b.number,b.description,b.status,b.registration_id AS "registrationId",b.created_at AS "createdAt",b.delivered_at AS "deliveredAt",b.delivered_method AS "deliveredMethod",
 r.participant,r.status AS "ticketStatus",r.snapshot->>'ticketName' AS "ticketName",c.name AS "campusName",
 (SELECT count(*)::int FROM arm_app.event_luggage x WHERE x.registration_id=b.registration_id AND x.status<>'void') AS total,
 nullif(concat_ws(' ',cu."firstName",cu."lastName"),'') AS "createdBy",nullif(concat_ws(' ',du."firstName",du."lastName"),'') AS "deliveredBy"
 FROM arm_app.event_luggage b JOIN arm_app.event_registrations r ON r.id=b.registration_id JOIN arm_app.campuses c ON c.id=r.campus_id
 LEFT JOIN arm_app.users cu ON cu.id=b.created_by LEFT JOIN arm_app.users du ON du.id=b.delivered_by`;
function bag(r: any) {
  const { participant, ...rest } = r;
  return { ...rest, ownerName: name(participant) || 'Asistente' };
}

@Injectable()
export class EventLuggageService {
  constructor(private readonly db: DatabaseService, private readonly attendance: EventAttendanceService) {}

  private async counts(eventId: string) {
    const r = (await this.db.query(`SELECT count(*) FILTER (WHERE status='stored')::int AS stored,count(*) FILTER (WHERE status='delivered')::int AS delivered,count(DISTINCT registration_id) FILTER (WHERE status<>'void')::int AS owners FROM arm_app.event_luggage WHERE event_id=$1`, [eventId])).rows[0];
    return { stored: r?.stored ?? 0, delivered: r?.delivered ?? 0, owners: r?.owners ?? 0 };
  }
  private async ofRegistration(eventId: string, registrationId: string) {
    return (await this.db.query(`${BAG_SQL} WHERE b.event_id=$1 AND b.registration_id=$2 AND b.status<>'void' ORDER BY b.number`, [eventId, registrationId])).rows.map(bag);
  }
  private async owner(eventId: string, registrationId: string) {
    const r = (await this.db.query(`SELECT r.id,r.participant,r.status,r.ticket_code,r.snapshot->>'ticketName' AS "ticketName",c.name AS "campusName" FROM arm_app.event_registrations r JOIN arm_app.campuses c ON c.id=r.campus_id WHERE r.event_id=$1 AND r.id=$2`, [eventId, registrationId])).rows[0];
    if (!r) throw new NotFoundException('Esta persona no está inscrita en este evento');
    return { id: r.id, name: name(r.participant) || 'Asistente', status: r.status, ticketName: r.ticketName ?? 'Entrada', campusName: r.campusName, ticketCode: r.ticket_code ?? r.id };
  }

  async list(user: EventActor, eventId: string) {
    const { event } = await this.attendance.scope(user, eventId, 'door');
    const d = event.details ?? {};
    const rows = (await this.db.query(`${BAG_SQL} WHERE b.event_id=$1 ORDER BY b.created_at DESC,b.number LIMIT 10000`, [eventId])).rows.map(bag);
    return { event: { id: event.id, title: event.title, color: d.color, timezone: d.timezone, startsAt: event.starts_at }, bags: rows, counts: await this.counts(eventId) };
  }

  async forRegistration(user: EventActor, eventId: string, registrationId: string) {
    await this.attendance.scope(user, eventId, 'door');
    const o = await this.owner(eventId, registrationId);
    const { ticketCode: _t, ...owner } = o;
    return { owner, bags: await this.ofRegistration(eventId, registrationId) };
  }

  /** Agrega bolsos a una entrada confirmada y devuelve todos sus bolsos vigentes, listos para imprimir. */
  async add(user: EventActor, eventId: string, dto: { registrationId: string; count: number; description?: string }) {
    const { event } = await this.attendance.scope(user, eventId, 'door');
    if (event.status === 'cancelled') throw new BadRequestException('El evento está cancelado');
    const count = Math.floor(Number(dto.count));
    if (!(count >= 1 && count <= MAX_BAGS)) throw new BadRequestException(`Registra entre 1 y ${MAX_BAGS} bolsos`);
    const created: string[] = await this.db.transaction(async (db) => {
      const r = (await db.query('SELECT id,status FROM arm_app.event_registrations WHERE id=$1 AND event_id=$2 FOR UPDATE', [dto.registrationId, eventId])).rows[0];
      if (!r) throw new NotFoundException('Esta persona no está inscrita en este evento');
      if (r.status !== 'confirmed') throw new BadRequestException('Solo se registra equipaje de entradas confirmadas');
      const used = (await db.query(`SELECT count(*) FILTER (WHERE status<>'void')::int AS active,coalesce(max(number),0)::int AS last FROM arm_app.event_luggage WHERE registration_id=$1`, [r.id])).rows[0];
      if (used.active + count > MAX_BAGS) throw new BadRequestException(`Cada persona puede dejar hasta ${MAX_BAGS} bolsos (ya tiene ${used.active})`);
      const ids: string[] = [];
      for (let i = 1; i <= count; i++) {
        // Un código repetido es casi imposible (32^8); si ocurre, se reintenta con otro.
        for (let attempt = 0; ; attempt++) {
          try {
            ids.push((await db.query(`INSERT INTO arm_app.event_luggage(event_id,registration_id,number,code,description,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
              [eventId, r.id, used.last + i, newBagCode(), dto.description?.trim() || null, user.sub])).rows[0].id);
            break;
          } catch (e) { if ((e as any).code !== '23505' || attempt > 3) throw e; }
        }
      }
      return ids;
    });
    const owner = await this.forRegistration(user, eventId, dto.registrationId);
    return { ...owner, created, counts: await this.counts(eventId) };
  }

  /** Anula una etiqueta (impresa por error o bolso que no quedó): deja de servir para retirar. */
  async void(user: EventActor, eventId: string, bagId: string) {
    await this.attendance.scope(user, eventId, 'door');
    const r = (await this.db.query(`UPDATE arm_app.event_luggage SET status='void',voided_at=now(),voided_by=$3 WHERE id=$1 AND event_id=$2 AND status='stored' RETURNING registration_id`, [bagId, eventId, user.sub])).rows[0];
    if (!r) throw new ConflictException('Esta etiqueta ya fue entregada o anulada');
    return { bags: await this.ofRegistration(eventId, r.registration_id), counts: await this.counts(eventId) };
  }

  /** Lee una etiqueta: a quién pertenece y en qué estado está. */
  async lookup(user: EventActor, eventId: string, text: string) {
    await this.attendance.scope(user, eventId, 'door');
    const code = bagCodeIn(text);
    const row = code ? (await this.db.query(`${BAG_SQL} WHERE b.event_id=$1 AND b.code=$2`, [eventId, code])).rows[0] : null;
    if (!row) throw new NotFoundException(UUID.test(text ?? '') ? 'Eso es una entrada, no una etiqueta de bolso. Escanea primero la etiqueta.' : 'No reconocemos esta etiqueta en este evento.');
    return { bag: bag(row) };
  }

  /**
   * Entrega un bolso. Se confirma con la entrada del dueño (QR del correo o Wallet) o, si no la tiene,
   * con su carnet: en ese caso el equipo marca que lo verificó y queda registrado así.
   */
  async deliver(user: EventActor, eventId: string, dto: { bagCode: string; ticketCode?: string; registrationId?: string; idChecked?: boolean }) {
    await this.attendance.scope(user, eventId, 'door');
    const reply = async (result: DeliverResult, message: string, b: any = null) => ({ result, message, bag: b, counts: await this.counts(eventId) });
    const code = bagCodeIn(dto.bagCode);
    const row = code ? (await this.db.query(`${BAG_SQL} WHERE b.event_id=$1 AND b.code=$2`, [eventId, code])).rows[0] : null;
    if (!row) return reply('not_found', 'No reconocemos esta etiqueta en este evento.');
    const b = bag(row);
    if (b.status === 'void') return reply('void', 'Esta etiqueta fue anulada: no sirve para retirar.', b);
    if (b.status === 'delivered') return reply('already', `Este bolso ya se entregó${b.deliveredBy ? ` (entregó ${b.deliveredBy})` : ''}.`, b);

    const owner = await this.owner(eventId, b.registrationId);
    let method: 'ticket' | 'id_check';
    if (dto.ticketCode) {
      const ticket = UUID.exec(dto.ticketCode)?.[0]?.toLowerCase();
      if (!ticket) return reply('mismatch', 'Eso no es una entrada. Escanea el QR de la entrada del dueño.', b);
      if (ticket !== String(owner.ticketCode).toLowerCase()) {
        const other = (await this.db.query(`SELECT participant FROM arm_app.event_registrations WHERE event_id=$1 AND (ticket_code=$2 OR id=$2)`, [eventId, ticket])).rows[0];
        return reply('mismatch', other ? `Este bolso es de ${b.ownerName}, pero la entrada es de ${name(other.participant)}.` : `Este bolso es de ${b.ownerName} y esa entrada no es suya.`, b);
      }
      method = 'ticket';
    } else if (dto.registrationId && dto.idChecked) {
      if (dto.registrationId !== b.registrationId) return reply('mismatch', `Este bolso es de ${b.ownerName}.`, b);
      method = 'id_check';
    } else {
      throw new BadRequestException('Escanea la entrada del dueño o confirma que revisaste su carnet');
    }
    const done = (await this.db.query(`UPDATE arm_app.event_luggage SET status='delivered',delivered_at=now(),delivered_by=$3,delivered_method=$4 WHERE id=$1 AND event_id=$2 AND status='stored' RETURNING id`, [b.id, eventId, user.sub, method])).rows[0];
    if (!done) return reply('already', 'Este bolso ya se entregó.', b);
    const fresh = bag((await this.db.query(`${BAG_SQL} WHERE b.id=$1`, [b.id])).rows[0]);
    return reply('ok', `Entregado a ${fresh.ownerName}.`, fresh);
  }
}
