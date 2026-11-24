'use client';
// Panel de ventas de un evento: recaudación, entradas, ocupación, ventas por día, por entrada, por campus y códigos.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table2 } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { EventShell } from './EventWorkspace';
import { EventSubnav } from './EventSubnav';
import { eventPrice } from './event-types';
import i from './event-insights.module.css';

export type SalesData = {
  event: { title: string; startsAt: string; timezone: string; capacity: number | null; pricing?: string };
  totals: { collected: number; testCollected: number; discounts: number; refunded: number; pendingAmount: number; pendingOrders: number; waitlistedOrders: number; reviewOrders: number;
    orders: number; tickets: number; checkedIn: number; pendingTickets: number; waitlisted: number; cancelled: number; courtesy: number };
  byDay: { day: string; tickets: number; amount: number }[];
  byTicket: { name: string; capacity: number | null; price: number; sold: number; pending: number; revenue: number }[];
  byCampus: { name: string; tickets: number; revenue: number }[];
  codes: { code: string; kind: 'percent' | 'amount'; value: number; active: boolean; uses: number; given: number }[];
};
export const money = (n: number) => eventPrice({ name: '', price: n, currency: 'CLP' });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
/** «20 nov» a partir de 2026-11-20 (fecha ya calculada en la zona del evento). */
export function shortDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))).replace('.', '');
}
/** Días consecutivos entre la primera y la última venta, con 0 donde no hubo (para no esconder días sin ventas). */
export function fillDays(rows: SalesData['byDay']) {
  if (!rows.length) return [];
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: SalesData['byDay'] = [];
  const start = Date.parse(`${rows[0].day}T00:00:00Z`), end = Date.parse(`${rows[rows.length - 1].day}T00:00:00Z`);
  for (let t = start; t <= end && out.length < 400; t += 86400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push(map.get(day) ?? { day, tickets: 0, amount: 0 });
  }
  return out;
}

function DayChart({ rows }: { rows: SalesData['byDay'] }) {
  const days = useMemo(() => fillDays(rows), [rows]);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  if (!days.length) return <p className={i.empty}>Aún no hay entradas confirmadas.</p>;
  const max = Math.max(...days.map((d) => d.tickets), 1);
  const W = 640, H = 180, pad = 24, gap = 2, slot = (W - pad) / days.length, bw = Math.min(Math.max(slot - gap, 2), 36);
  const xOf = (k: number) => pad + k * slot + (slot - bw) / 2;
  const ticks = [0, Math.ceil(max / 2), max];
  const label = (d: SalesData['byDay'][number]) => `${shortDay(d.day)}: ${d.tickets} ${d.tickets === 1 ? 'entrada' : 'entradas'}${d.amount ? ` · ${money(d.amount)}` : ''}`;
  return (
    <div>
      <div className={i.chartHead}>
        <p className={i.chartNote}>Entradas confirmadas según el día en que se inscribieron.</p>
        <button type="button" className={i.ghost} onClick={() => setTable(!table)} aria-pressed={table}><Table2 size={14} aria-hidden="true" />{table ? 'Ver gráfico' : 'Ver como tabla'}</button>
      </div>
      {table ? (
        <table className={i.table}><thead><tr><th>Día</th><th>Entradas</th><th>Monto</th></tr></thead>
          <tbody>{days.filter((d) => d.tickets).map((d) => <tr key={d.day}><td>{shortDay(d.day)}</td><td>{d.tickets}</td><td>{money(d.amount)}</td></tr>)}</tbody></table>
      ) : (
        <div className={i.chartWrap} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H + 22}`} className={i.chart} role="img" aria-label={`Entradas por día: ${days.filter((d) => d.tickets).map(label).join('; ')}`}>
            {ticks.map((t) => { const y = H - (t / max) * (H - 10); return <g key={t}><line x1={pad} x2={W} y1={y} y2={y} className={i.grid} /><text x={pad - 6} y={y + 4} className={i.axis} textAnchor="end">{t}</text></g>; })}
            {days.map((d, k) => {
              const h = (d.tickets / max) * (H - 10); const x = xOf(k);
              return (
                <g key={d.day}>
                  <rect x={pad + k * slot} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(k)} onFocus={() => setHover(k)} tabIndex={d.tickets ? 0 : -1} aria-label={label(d)} />
                  {d.tickets > 0 && <path d={`M${x},${H} V${H - h + Math.min(4, h)} Q${x},${H - h} ${x + Math.min(4, bw / 2)},${H - h} H${x + bw - Math.min(4, bw / 2)} Q${x + bw},${H - h} ${x + bw},${H - h + Math.min(4, h)} V${H} Z`} className={hover === k ? i.barOn : i.bar} pointerEvents="none" />}
                </g>
              );
            })}
            <line x1={pad} x2={W} y1={H} y2={H} className={i.baseline} />
            <text x={pad} y={H + 16} className={i.axis}>{shortDay(days[0].day)}</text>
            {days.length > 1 && <text x={W} y={H + 16} className={i.axis} textAnchor="end">{shortDay(days[days.length - 1].day)}</text>}
          </svg>
          {hover != null && <div className={i.tooltip} style={{ left: `${((xOf(hover) + bw / 2) / W) * 100}%` }} role="status"><b>{shortDay(days[hover].day)}</b><span>{days[hover].tickets} {days[hover].tickets === 1 ? 'entrada' : 'entradas'}</span>{days[hover].amount > 0 && <span>{money(days[hover].amount)}</span>}</div>}
        </div>
      )}
    </div>
  );
}

function Bars({ rows, value, detail }: { rows: { name: string }[]; value: (r: any) => number; detail: (r: any) => string }) {
  const max = Math.max(...rows.map(value), 1);
  return (
    <ul className={i.bars}>
      {rows.map((r) => (
        <li key={r.name}>
          <span className={i.barName}>{r.name}</span>
          <span className={i.barTrack} aria-hidden="true"><i style={{ width: `${(value(r) / max) * 100}%` }} /></span>
          <span className={i.barValue}>{detail(r)}</span>
        </li>
      ))}
    </ul>
  );
}

export function EventSales({ id }: { id: string }) {
  const query = useQuery({ queryKey: ['event-sales', id], queryFn: async () => (await api.get<SalesData>(`/event-management/${id}/sales`)).data, refetchInterval: 60_000 });
  const d = query.data; const t = d?.totals;
  const paid = d?.event.pricing === 'paid';
  return (
    <EventShell title={d?.event.title ?? 'Ventas'} description="Cómo va el evento: entradas, recaudación y de dónde vienen.">
      <EventSubnav id={id} />
      {query.isPending && <p className={i.muted} role="status">Cargando ventas…</p>}
      {query.isError && <p className={i.error} role="alert">{apiErrorMessage(query.error, 'No pudimos cargar las ventas.')}</p>}
      {d && t && <>
        <div className={i.kpis}>
          {paid && <div className={i.kpi}><span>Recaudado neto</span><strong>{money(t.collected)}</strong><small>{t.refunded ? `Después de ${money(t.refunded)} devueltos` : 'Pagos reales aprobados'}{t.testCollected ? ` · Pruebas: ${money(t.testCollected)}` : ''}</small></div>}
          <div className={i.kpi}><span>Entradas confirmadas</span><strong>{t.tickets}</strong><small>{t.orders} {t.orders === 1 ? 'compra' : 'compras'}{t.courtesy ? ` · ${t.courtesy} del equipo` : ''}</small></div>
          <div className={i.kpi}><span>Ocupación</span><strong>{d.event.capacity ? `${pct(t.tickets + t.pendingTickets, d.event.capacity)} %` : '—'}</strong><small>{d.event.capacity ? `${t.tickets + t.pendingTickets} de ${d.event.capacity} cupos` : 'Sin límite de cupos'}</small></div>
          <div className={i.kpi}><span>Ingresaron</span><strong>{t.checkedIn}</strong><small>{t.tickets ? `${pct(t.checkedIn, t.tickets)} % de las entradas` : 'Aún sin ingresos'}</small></div>
          {paid && <div className={i.kpi}><span>Por cobrar</span><strong>{money(t.pendingAmount)}</strong><small>{t.pendingOrders} {t.pendingOrders === 1 ? 'reserva vigente' : 'reservas vigentes'}{t.waitlistedOrders ? ` · ${t.waitlistedOrders} en espera` : ''}</small></div>}
          {paid && <div className={i.kpi}><span>Descuentos</span><strong>{money(t.discounts)}</strong><small>{t.reviewOrders ? `${t.reviewOrders} pago(s) en revisión` : 'Con códigos de descuento'}</small></div>}
        </div>

        <section className={i.card} aria-labelledby="sales-days"><h2 id="sales-days">Entradas por día</h2><DayChart rows={d.byDay} /></section>

        <div className={i.two}>
          <section className={i.card} aria-labelledby="sales-tickets">
            <h2 id="sales-tickets">Por tipo de entrada</h2>
            {d.byTicket.length ? <table className={i.table}>
              <thead><tr><th>Entrada</th><th>Vendidas</th>{paid && <th>Monto</th>}</tr></thead>
              <tbody>{d.byTicket.map((r) => (
                <tr key={r.name}><td><b>{r.name}</b>{r.capacity && <span className={i.meter} aria-label={`${pct(r.sold, r.capacity)} % del cupo`}><i style={{ width: `${Math.min(pct(r.sold, r.capacity), 100)}%` }} /></span>}</td>
                  <td>{r.sold}{r.capacity ? ` / ${r.capacity}` : ''}{r.pending ? <small> · {r.pending} por pagar</small> : null}</td>{paid && <td>{money(r.revenue)}</td>}</tr>
              ))}</tbody></table> : <p className={i.empty}>Sin entradas vendidas.</p>}
          </section>
          <section className={i.card} aria-labelledby="sales-campus">
            <h2 id="sales-campus">Por campus</h2>
            {d.byCampus.length ? <Bars rows={d.byCampus} value={(r) => r.tickets} detail={(r) => `${r.tickets}${paid && r.revenue ? ` · ${money(r.revenue)}` : ''}`} /> : <p className={i.empty}>Sin entradas confirmadas.</p>}
          </section>
        </div>

        {d.codes.length > 0 && (
          <section className={i.card} aria-labelledby="sales-codes">
            <h2 id="sales-codes">Códigos de descuento</h2>
            <table className={i.table}><thead><tr><th>Código</th><th>Descuento</th><th>Usos</th><th>Descontado</th></tr></thead>
              <tbody>{d.codes.map((c) => <tr key={c.code}><td><code>{c.code}</code>{!c.active && <small> · inactivo</small>}</td><td>{c.value === 0 ? 'Solo acceso' : c.kind === 'percent' ? `${c.value} %` : money(c.value)}</td><td>{c.uses}</td><td>{money(c.given)}</td></tr>)}</tbody></table>
          </section>
        )}
      </>}
    </EventShell>
  );
}
