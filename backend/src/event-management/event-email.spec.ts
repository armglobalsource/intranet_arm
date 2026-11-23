import { describe, expect, it } from 'vitest';
import { renderEventEmail, EventEmailData } from './event-email';
import { senderFor } from '../auth/resend-mailer.service';

const base: EventEmailData = {
  kind: 'confirmed', firstName: 'Pablo', link: 'https://ecosistema.armglobal.org/eventos/retiro/inscripcion#id=1&token=t',
  origin: 'https://ecosistema.armglobal.org', ticketCode: '3520053e-72a6-48c2-b38a-e077bda942bc', amount: 100, currency: 'CLP',
  ticketName: 'Entrada general', senderName: 'AR Hombres',
  event: { title: 'Retiro AR Hombres 2027', summary: 'Un tiempo para renovar la fe.', bannerUrl: 'https://cdn.example.org/portada.jpg', color: '#283033',
    startsAt: '2026-11-27T10:15:00.000Z', endsAt: '2026-11-28T18:00:00.000Z', timezone: 'America/Santiago', modality: 'onsite', location: 'Loncura', address: 'Loncura 1234', campusName: 'Santiago' },
};

describe('correos de inscripción con la identidad del evento', () => {
  it('entrada confirmada: portada, datos, código, botón y remitente del evento', () => {
    const m = renderEventEmail(base);
    expect(m.subject).toBe('Tu entrada está confirmada · Retiro AR Hombres 2027');
    expect(m.html).toContain('src="https://cdn.example.org/portada.jpg"');
    expect(m.html).toContain('¡Tu entrada está confirmada!');
    expect(m.html).toContain('Hola Pablo:');
    expect(m.html).toContain('Viernes, 27 de noviembre de 2026');
    expect(m.html).toContain('Loncura 1234');
    expect(m.html).toContain('https://www.google.com/maps/search/?api=1&amp;query=Loncura%2C%20Loncura%201234');
    expect(m.html).toContain('3520053e-72a6-48c2-b38a-e077bda942bc');
    expect(m.html).toContain('Ver mi entrada');
    expect(m.html).toContain('background:#283033');
    expect(m.html).toContain('Enviado por AR Hombres');
    expect(m.text).toContain('Código de tu entrada: 3520053e');
  });

  it('pago pendiente: pide completar el pago, muestra la reserva y no entrega código', () => {
    const m = renderEventEmail({ ...base, kind: 'pending_payment', ticketCode: null, expiresAt: '2026-11-24T13:20:00.000Z' });
    expect(m.subject).toBe('Completa tu pago · Retiro AR Hombres 2027');
    expect(m.html).toContain('Completar mi pago');
    expect(m.html).toContain('vigente hasta el');
    expect(m.html).not.toContain('Tu entrada</div>');
  });

  it('sin portada usa el color del evento; escapa textos y descarta URLs inseguras', () => {
    const m = renderEventEmail({ ...base, event: { ...base.event, bannerUrl: 'javascript:alert(1)', title: '<b>Retiro</b>', color: 'red;x' } });
    expect(m.html).not.toContain('javascript:');
    expect(m.html).toContain('&lt;b&gt;Retiro&lt;/b&gt;');
    expect(m.html).not.toContain('<b>Retiro</b>');
    expect(m.html).toContain('background:#31302e');
  });

  it('remitente: solo buzones del dominio verificado; las respuestas van a ese buzón', () => {
    const configured = 'Ecosistema ARM <acceso@armglobal.org>';
    expect(senderFor(configured, 'AR Hombres', 'arhombres@armglobal.org')).toEqual({ from: 'AR Hombres <arhombres@armglobal.org>', replyTo: 'arhombres@armglobal.org' });
    // Otro dominio: se conserva el buzón configurado y solo cambia el nombre.
    expect(senderFor(configured, 'AR Hombres', 'arhombres@gmail.com')).toEqual({ from: 'AR Hombres <acceso@armglobal.org>', replyTo: undefined });
    expect(senderFor(configured, 'Nombre <falso>\r\n', '')).toEqual({ from: 'Nombre falso <acceso@armglobal.org>', replyTo: undefined });
    expect(senderFor(configured)).toEqual({ from: undefined, replyTo: undefined });
  });
});
