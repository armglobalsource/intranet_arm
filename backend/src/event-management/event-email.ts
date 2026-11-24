// Correos de inscripción a eventos con la identidad del evento: portada, título según
// el estado, datos en tarjetas y botón del color del evento. Solo tablas y estilos en
// línea para que se vea igual en Gmail, Outlook y el teléfono.

export type EmailKind = 'confirmed' | 'pending_payment' | 'waitlisted' | 'registered';

export interface EventEmailData {
  kind: EmailKind;
  firstName: string;
  link: string;
  origin: string;
  ticketCode?: string | null;
  /** Content-ID de la imagen QR adjunta al correo (se muestra con cid:). */
  qrCid?: string | null;
  /** Entradas de la compra; si falta, se usa ticketCode/qrCid como una sola entrada. */
  tickets?: { name: string; ticketName: string; code: string; qrCid?: string | null }[];
  /** Descuento aplicado con un código, para mostrar el detalle del total. */
  discount?: number;
  amount: number;
  currency: string;
  ticketName?: string;
  expiresAt?: string | null;
  testPayment?: boolean;
  senderName?: string;
  event: {
    title: string; summary?: string; bannerUrl?: string; color?: string;
    startsAt: string; endsAt?: string; timezone?: string;
    modality?: string; location?: string; address?: string; campusName?: string;
  };
}

export function esc(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const safeColor = (c?: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#31302e');
const safeUrl = (u?: string) => { try { const url = new URL(u ?? ''); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };

function fmt(value: string, timeZone: string | undefined, options: Intl.DateTimeFormatOptions) {
  try { return new Intl.DateTimeFormat('es-CL', { ...options, timeZone }).format(new Date(value)); } catch { return ''; }
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(amount); } catch { return `${amount} ${currency}`; }
}

const COPY: Record<EmailKind, { subject: string; heading: string; intro: string; cta: string }> = {
  confirmed: { subject: 'Tu entrada está confirmada', heading: '¡Tu entrada está confirmada!', intro: 'Ya tienes tu lugar. Guarda este correo: aquí está tu entrada.', cta: 'Ver mi entrada' },
  pending_payment: { subject: 'Completa tu pago', heading: 'Tu cupo te espera', intro: 'Recibimos tu inscripción. Completa el pago para confirmar tu entrada.', cta: 'Completar mi pago' },
  waitlisted: { subject: 'Estás en lista de espera', heading: 'Estás en lista de espera', intro: 'Los cupos están completos. Si se libera uno, el equipo organizador te contactará. No debes pagar por ahora.', cta: 'Ver mi inscripción' },
  registered: { subject: 'Recibimos tu inscripción', heading: 'Recibimos tu inscripción', intro: 'Tu inscripción quedó registrada.', cta: 'Ver mi inscripción' },
};

export function renderEventEmail(d: EventEmailData) {
  const e = d.event;
  const color = safeColor(e.color);
  const tz = e.timezone;
  const copy = COPY[d.kind];
  const date = e.startsAt ? cap(fmt(e.startsAt, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : '';
  const time = (v: string) => fmt(v, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const sameDay = e.endsAt && fmt(e.startsAt, tz, { dateStyle: 'short' }) === fmt(e.endsAt, tz, { dateStyle: 'short' });
  const hours = !e.startsAt ? '' : !e.endsAt ? `${time(e.startsAt)} hrs` : sameDay ? `${time(e.startsAt)} – ${time(e.endsAt)} hrs` : `${time(e.startsAt)} hrs · hasta el ${fmt(e.endsAt, tz, { day: 'numeric', month: 'long' })}`;
  const online = e.modality === 'online';
  const place = online ? 'Evento online' : e.location || '';
  const mapQuery = [e.location, e.address].filter((v) => v && v.trim()).join(', ');
  const map = !online && mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : '';
  const price = d.amount > 0 ? money(d.amount, d.currency) : 'Gratuita';
  const banner = safeUrl(e.bannerUrl);
  const logo = `${d.origin}/logo_negro.png`;
  const sender = d.senderName?.trim() || 'Eventos ARM Global';

  const row = (icon: string, label: string, value: string, extra = '') => value ? `
    <tr><td style="padding:12px 0;border-bottom:1px solid #ece5dd;vertical-align:top;width:34px;font-size:20px;line-height:1">${icon}</td>
    <td style="padding:12px 0;border-bottom:1px solid #ece5dd;vertical-align:top">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8f8f8f">${esc(label)}</div>
      <div style="margin-top:3px;font-size:16px;font-weight:600;color:#1d1d1b">${esc(value)}</div>${extra}</td></tr>` : '';

  // Una tarjeta por entrada confirmada, cada una con su QR (una compra puede traer varias).
  const tickets = d.kind !== 'confirmed' ? [] : d.tickets?.length ? d.tickets
    : d.ticketCode ? [{ name: d.firstName, ticketName: d.ticketName || 'Entrada general', code: d.ticketCode, qrCid: d.qrCid }] : [];
  const ticket = tickets.map((t, i) => `
    <tr><td style="padding:${i ? 14 : 8}px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed ${color};border-radius:14px;background:#fff9f4">
        <tr><td style="padding:18px 20px;text-align:center">
          <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${color}">${tickets.length > 1 ? `Entrada ${i + 1} de ${tickets.length}` : 'Tu entrada'}</div>
          <div style="margin-top:6px;font-size:20px;font-weight:800;color:#1d1d1b">${esc(t.name)} · ${esc(t.ticketName)}</div>
          ${t.qrCid ? `<img src="cid:${esc(t.qrCid)}" alt="Código QR de la entrada de ${esc(t.name)}" width="180" height="180" style="display:block;margin:14px auto 0;width:180px;height:180px;border:0">` : ''}
          <div style="margin-top:8px;font-family:Consolas,Menlo,monospace;font-size:12px;color:#656260;word-break:break-all">${esc(t.code)}</div>
          <div style="margin-top:8px;font-size:13px;color:#656260">${t.qrCid ? 'Muestra este código QR en la entrada del evento.' : 'Presenta este código al equipo del evento.'}</div>
        </td></tr></table></td></tr>`).join('');

  const notice = d.kind === 'pending_payment'
    ? `<tr><td style="padding:16px 32px 0"><div style="padding:14px 16px;border-radius:12px;background:#fdf1e9;color:#96523f;font-size:14px;line-height:1.5">${d.expiresAt ? `Tu reserva está vigente hasta el <strong>${esc(fmt(d.expiresAt, tz, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }))} hrs</strong>. ` : ''}${d.testPayment ? 'Modo de prueba: no uses tarjetas reales.' : 'El pago es seguro con Mercado Pago. Tu entrada se confirma cuando Mercado Pago aprueba el pago.'}</div></td></tr>`
    : '';

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(e.title)}</title></head>
<body style="margin:0;padding:0;background:#f6f1ec">
<div style="display:none;max-height:0;overflow:hidden">${esc(copy.heading)} · ${esc(e.title)}${date ? ` · ${esc(date)}` : ''}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1ec"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;font-family:Outfit,'Segoe UI',Arial,sans-serif;color:#31302e">
  <tr><td style="background:${color};padding:0">
    ${banner ? `<img src="${esc(banner)}" alt="${esc(e.title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0">` : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 32px;color:#ffffff">
      <div style="font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;opacity:.85">${esc(e.campusName || 'ARM Global')}</div>
      <div style="margin-top:10px;font-size:32px;font-weight:800;line-height:1.1;text-transform:uppercase;letter-spacing:.5px">${esc(e.title)}</div>
    </td></tr></table>`}
  </td></tr>
  <tr><td style="padding:32px 32px 4px">
    <div style="display:inline-block;width:42px;height:4px;border-radius:2px;background:${color}"></div>
    <h1 style="margin:14px 0 6px;font-size:30px;line-height:1.15;font-weight:800;color:#1d1d1b">${esc(copy.heading)}</h1>
    <p style="margin:0;font-size:16px;line-height:1.6;color:#31302e">Hola ${esc(d.firstName)}:<br>${esc(copy.intro)}</p>
  </td></tr>
  ${banner ? `<tr><td style="padding:18px 32px 0">
    <div style="padding:14px 18px;border-radius:12px;background:${color};color:#ffffff">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.8">Evento</div>
      <div style="margin-top:4px;font-size:20px;font-weight:800;line-height:1.25">${esc(e.title)}</div>
    </div>
  </td></tr>` : ''}
  <tr><td style="padding:6px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${row('📅', 'Fecha', date)}
    ${row('🕒', 'Horario', hours)}
    ${row(online ? '💻' : '📍', 'Lugar', place, `${e.address && !online ? `<div style="margin-top:2px;font-size:14px;color:#656260">${esc(e.address)}</div>` : ''}${map ? `<a href="${esc(map)}" style="display:inline-block;margin-top:6px;font-size:14px;font-weight:700;color:${color}">Cómo llegar →</a>` : ''}`)}
    ${row('🎟️', (d.tickets?.length ?? 1) > 1 ? 'Entradas' : 'Entrada', `${d.ticketName || 'Entrada general'} · ${price}${d.discount ? ` (incluye ${money(d.discount, d.currency)} de descuento)` : ''}`)}
  </table></td></tr>
  ${ticket}${notice}
  <tr><td align="center" style="padding:26px 32px 8px">
    <a href="${esc(d.link)}" style="display:inline-block;padding:15px 30px;border-radius:999px;background:${color};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">${esc(copy.cta)}</a>
  </td></tr>
  ${e.summary ? `<tr><td style="padding:14px 32px 0"><p style="margin:0;font-size:15px;line-height:1.7;color:#656260;text-align:center">${esc(e.summary)}</p></td></tr>` : ''}
  <tr><td style="padding:28px 32px 30px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ece5dd"><tr><td style="padding-top:20px;text-align:center">
      <img src="${esc(logo)}" alt="ARM Global" width="110" style="display:inline-block;width:110px;height:auto;border:0">
      <p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#8f8f8f">Enviado por ${esc(sender)} · ARM Global.<br>Si no reconoces esta inscripción, puedes ignorar este correo.</p>
    </td></tr></table>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    `${copy.heading} · ${e.title}`, '',
    `Hola ${d.firstName}:`, copy.intro, '',
    date ? `Fecha: ${date}` : null, hours ? `Horario: ${hours}` : null, place ? `Lugar: ${place}${e.address && !online ? `, ${e.address}` : ''}` : null,
    `Entrada: ${d.ticketName || 'Entrada general'} · ${price}`,
    ...tickets.map((t) => `Entrada de ${t.name} (${t.ticketName}): ${t.code}`),
    '', `${copy.cta}: ${d.link}`, '', `Enviado por ${sender} · ARM Global.`,
  ].filter((l): l is string => l !== null).join('\n');

  return { subject: `${copy.subject} · ${e.title}`, html, text };
}

