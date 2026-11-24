// Datos y reglas de la lista de inscritos y del control de ingreso (sin React, para probarlas aparte).

export type Attendee = {
  id: string; firstName: string; lastName: string; email: string; phone: string; age: number | null;
  campusId: number; campusName: string; ticketName: string | null; status: string; amount: number; currency: string;
  paymentId?: string | null; testPayment?: boolean; source: 'public' | 'manual'; note?: string | null; createdAt: string;
  checkedInAt: string | null; checkedInBy: string | null; createdBy?: string | null; emailSent?: boolean;
  orderId?: string; orderAmount?: number | string; orderRefunded?: number | string; orderStatus?: string; refundedAt?: string | null; ticketCode?: string; transferredAt?: string | null; buyerName?: string; buyerEmail?: string; discountCode?: string | null; answers?: Record<string, string | boolean>;
};
export type AttendanceQuestion = { id: string; label: string; type: string };
export type AttendanceEvent = {
  id: string; slug: string; title: string; status: string; startsAt: string; endsAt: string; capacity: number | null;
  timezone?: string; pricing?: 'free' | 'paid'; color?: string; bannerUrl?: string;
  tickets: { id: string; name: string; price: number; currency: string }[]; campuses: { id: number; name: string }[]; questions?: AttendanceQuestion[];
};
export type AttendanceData = { event: AttendanceEvent; manage: boolean; canRefund?: boolean; registrations: Attendee[] };
export type Counts = { confirmed: number; checkedIn: number };
export type CheckInReply = { result: 'ok' | 'already' | 'invalid' | 'not_found'; message: string; attendee: Attendee | null; counts: Counts };
export type DoorEvent = { id: string; slug: string; title: string; startsAt: string; endsAt: string; capacity: number | null; campusName: string; bannerUrl?: string; timezone?: string; confirmed: number; checkedIn: number };

export const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmada', pending_payment: 'Pago pendiente', waitlisted: 'Lista de espera',
  expired: 'Reserva vencida', payment_review: 'Revisar pago', cancelled: 'Anulada',
};
/** Estados en que el organizador puede preguntarle a Mercado Pago por el pago. */
export const VERIFIABLE = ['pending_payment', 'expired', 'payment_review'];

export const fullName = (a: Pick<Attendee, 'firstName' | 'lastName'>) => `${a.firstName} ${a.lastName}`.trim();

/** Minúsculas y sin tildes, para buscar «jose» y encontrar «José». */
export function fold(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export type AttendeeFilter = { search: string; status: string; campus: string; presence: '' | 'in' | 'out' };
export function filterAttendees(list: Attendee[], f: AttendeeFilter) {
  const words = fold(f.search).split(/\s+/).filter(Boolean);
  return list.filter((a) => {
    if (f.status && a.status !== f.status) return false;
    if (f.campus && String(a.campusId) !== f.campus) return false;
    if (f.presence === 'in' && !a.checkedInAt) return false;
    if (f.presence === 'out' && (a.checkedInAt || a.status !== 'confirmed')) return false;
    if (!words.length) return true;
    const hay = fold(`${a.firstName} ${a.lastName} ${a.email} ${a.phone} ${a.id} ${a.ticketCode ?? ''} ${a.ticketName ?? ''}`);
    return words.every((w) => hay.includes(w));
  });
}

export function summarize(list: Attendee[], capacity: number | null) {
  const confirmed = list.filter((a) => a.status === 'confirmed');
  const checkedIn = confirmed.filter((a) => a.checkedInAt).length;
  const revenue = confirmed.filter((a) => !a.testPayment).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  return {
    confirmed: confirmed.length, checkedIn,
    pending: list.filter((a) => a.status === 'pending_payment' || a.status === 'payment_review').length,
    waitlisted: list.filter((a) => a.status === 'waitlisted').length,
    courtesy: confirmed.filter((a) => a.source === 'manual').length,
    revenue,
    capacityLeft: capacity == null ? null : Math.max(capacity - list.filter((a) => a.status === 'confirmed' || a.status === 'pending_payment').length, 0),
  };
}

/** Filas para Excel, con encabezados en español y fechas en la zona del evento. */
/** Respuesta legible: «Sí»/«No» para casillas. */
export function answerText(value: string | boolean | undefined) {
  return value === true ? 'Sí' : value === false ? 'No' : (value ?? '');
}
/** Quién compró, si no es la misma persona que asiste. */
export function boughtBy(a: Attendee) {
  return a.buyerName && fold(a.buyerName) !== fold(fullName(a)) ? a.buyerName : '';
}

export function exportRows(list: Attendee[], timeZone?: string, questions: AttendanceQuestion[] = []) {
  const when = (v: string | null) => {
    if (!v) return '';
    try { return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(v)); } catch { return v; }
  };
  return list.map((a) => ({
    Nombre: a.firstName, Apellido: a.lastName, Correo: a.email, Teléfono: a.phone, Edad: a.age ?? '',
    Campus: a.campusName, Entrada: a.ticketName ?? '', Estado: STATUS_LABELS[a.status] ?? a.status,
    Monto: Number(a.amount) || 0, 'Pago Mercado Pago': a.paymentId ?? '', Origen: a.source === 'manual' ? 'Agregada por el equipo' : 'Inscripción pública',
    Ingresó: a.checkedInAt ? 'Sí' : 'No', 'Hora de ingreso': when(a.checkedInAt), 'Registrado por': a.checkedInBy ?? '',
    'Fecha de inscripción': when(a.createdAt), Nota: a.note ?? '',
    'Compró': a.buyerName ?? '', 'Correo de quien compró': a.buyerEmail ?? '', 'Código de descuento': a.discountCode ?? '', Compra: a.orderId ?? '',
    ...Object.fromEntries(questions.map((q) => [q.label, answerText(a.answers?.[q.id])])),
    Transferida: a.transferredAt ? 'Sí' : '',
    Código: a.ticketCode ?? a.id,
  }));
}

/** El código de la entrada dentro de lo que lea el escáner (texto suelto o un enlace). */
export function ticketCodeIn(text: string) {
  return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(text)?.[0]?.toLowerCase() ?? null;
}

/** «19:42» en la zona del evento. */
export function clock(value: string | null | undefined, timeZone?: string) {
  if (!value) return '';
  try { return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(value)); } catch { return ''; }
}

export function fileSlug(title: string) {
  return fold(title).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'evento';
}
