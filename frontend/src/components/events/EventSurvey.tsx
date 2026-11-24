'use client';
/* eslint-disable @next/next/no-img-element */
// Encuesta de satisfacción: resultados para el equipo y formulario público (anónimo) para quien asistió.
import Link from 'next/link';
import { CSSProperties, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Star } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { EventShell } from './EventWorkspace';
import { EventSubnav } from './EventSubnav';
import i from './event-insights.module.css';

type Results = { enabled: boolean; question: string | null; sentAt: string | null; ended: boolean; recipients: number; onlyCheckedIn: boolean; responses: number; rating: number | null;
  distribution: number[]; nps: { score: number; promoters: number; passives: number; detractors: number; answered: number } | null;
  comments: { rating: number; liked: string | null; improve: string | null; extra: string | null; createdAt: string }[] };

export function EventSurveyResults({ id }: { id: string }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['event-survey', id], queryFn: async () => (await api.get<Results>(`/event-management/${id}/survey`)).data });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const d = query.data;
  async function sendNow() {
    setBusy(true); setNote(null);
    try { const { data } = await api.post<{ message: string }>(`/event-management/${id}/survey/send`); setNote({ tone: 'ok', text: data.message }); await qc.invalidateQueries({ queryKey: ['event-survey', id] }); }
    catch (err) { setNote({ tone: 'error', text: apiErrorMessage(err, 'No pudimos enviar la encuesta.') }); } finally { setBusy(false); }
  }
  const maxBar = Math.max(...(d?.distribution ?? [1]), 1);
  return (
    <EventShell title="Encuesta de satisfacción" description="Lo que opinan quienes asistieron, para que el próximo evento sea mejor.">
      <EventSubnav id={id} />
      {query.isPending && <p className={i.muted} role="status">Cargando encuesta…</p>}
      {query.isError && <p className={i.error} role="alert">{apiErrorMessage(query.error, 'No pudimos cargar la encuesta.')}</p>}
      {d && <>
        <section className={i.card}>
          <h2>Envío</h2>
          <p className={i.muted}>{d.sentAt ? `Enviada el ${new Date(d.sentAt).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' })}.`
            : !d.ended ? `Se envía ${d.enabled ? 'automáticamente al día siguiente de que termine el evento' : 'cuando la envíes desde aquí, después del evento'}.`
              : d.enabled ? 'Se enviará automáticamente en la próxima revisión diaria. También puedes enviarla ahora.' : 'El envío automático está apagado: puedes enviarla ahora.'}
            {' '}Llega a {d.recipients} {d.recipients === 1 ? 'persona' : 'personas'} {d.onlyCheckedIn ? '(quienes ingresaron)' : '(entradas confirmadas)'}. Las respuestas son anónimas.</p>
          {note && <p className={note.tone === 'ok' ? i.ok : i.error} role={note.tone === 'ok' ? 'status' : 'alert'}>{note.text}</p>}
          {!d.sentAt && d.ended && d.recipients > 0 && <div className={i.actions}><button type="button" className={i.primary} disabled={busy} onClick={() => void sendNow()}><Send size={15} aria-hidden="true" />{busy ? 'Enviando…' : 'Enviar encuesta ahora'}</button></div>}
        </section>
        <div className={i.kpis}>
          <div className={i.kpi}><span>Respuestas</span><strong>{d.responses}</strong><small>{d.recipients ? `${Math.round((d.responses / d.recipients) * 100)} % de quienes la recibieron` : 'Sin destinatarios aún'}</small></div>
          <div className={i.kpi}><span>Calificación promedio</span><strong>{d.rating != null ? `${d.rating.toLocaleString('es-CL')} / 5` : '—'}</strong><small>De 1 (malo) a 5 (excelente)</small></div>
          <div className={i.kpi}><span>Recomendación (NPS)</span><strong>{d.nps ? d.nps.score : '—'}</strong><small>{d.nps ? `${d.nps.promoters} lo recomendarían · ${d.nps.detractors} no` : 'De −100 a 100'}</small></div>
        </div>
        {d.responses > 0 && <div className={i.two}>
          <section className={i.card} aria-labelledby="survey-dist"><h2 id="survey-dist">Calificaciones</h2>
            <ul className={i.bars}>{[5, 4, 3, 2, 1].map((v) => (
              <li key={v}><span className={i.barName}>{'★'.repeat(v)}<span className="sr-only">{v} estrellas</span></span><span className={i.barTrack} aria-hidden="true"><i style={{ width: `${(d.distribution[v - 1] / maxBar) * 100}%` }} /></span><span className={i.barValue}>{d.distribution[v - 1]}</span></li>
            ))}</ul>
          </section>
          <section className={i.card} aria-labelledby="survey-comments"><h2 id="survey-comments">Comentarios</h2>
            {!d.comments.length && <p className={i.empty}>Aún no hay comentarios escritos.</p>}
            <ul className={i.comments}>{d.comments.map((c, k) => (
              <li key={k}><span className={i.stars} aria-label={`${c.rating} de 5`}>{'★'.repeat(c.rating)}<span className={i.starsOff}>{'★'.repeat(5 - c.rating)}</span></span>
                {c.liked && <p><b>Lo mejor:</b> {c.liked}</p>}{c.improve && <p><b>Para mejorar:</b> {c.improve}</p>}{c.extra && <p><b>{d.question ?? 'Comentario'}:</b> {c.extra}</p>}</li>
            ))}</ul>
          </section>
        </div>}
      </>}
    </EventShell>
  );
}

type Info = { title: string; startsAt: string; timezone?: string; bannerUrl?: string; color?: string; question: string | null; answered: boolean };
const base = () => api.defaults.baseURL;

export function EventSurveyForm({ slug }: { slug: string }) {
  const [access, setAccess] = useState<{ e: string; t: string } | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ rating: 0, nps: -1, liked: '', improve: '', extra: '' });
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1)); const e = h.get('e'), t = h.get('t');
    if (!e || !t) { setError('Abre el enlace que te enviamos por correo para responder la encuesta.'); return; }
    setAccess({ e, t });
    axios.post<Info>(`${base()}/public-events/${encodeURIComponent(slug)}/survey/check`, { e, t }).then((r) => { setInfo(r.data); setDone(r.data.answered); }).catch((err) => setError(apiErrorMessage(err, 'Este enlace de encuesta no es válido.')));
  }, [slug]);
  async function submit(ev: FormEvent) {
    ev.preventDefault(); if (!access || !form.rating) return;
    setBusy(true); setError('');
    try {
      await axios.post(`${base()}/public-events/${encodeURIComponent(slug)}/survey`, { ...access, rating: form.rating, ...(form.nps >= 0 ? { nps: form.nps } : {}),
        ...(form.liked.trim() ? { liked: form.liked } : {}), ...(form.improve.trim() ? { improve: form.improve } : {}), ...(form.extra.trim() ? { extra: form.extra } : {}) });
      setDone(true);
    } catch (err) { setError(apiErrorMessage(err, 'No pudimos guardar tu respuesta. Inténtalo de nuevo.')); } finally { setBusy(false); }
  }
  return (
    <main className={i.surveyPage} style={{ '--event-color': info?.color || '#31302e' } as CSSProperties}>
      <header className={i.surveyBand}>{info?.bannerUrl && <img src={info.bannerUrl} alt="" referrerPolicy="no-referrer" />}<div><p>Encuesta</p><h1>{info?.title ?? 'Cuéntanos cómo te fue'}</h1></div></header>
      <section className={i.surveyCard}>
        {error && <p className={i.error} role="alert">{error}</p>}
        {done ? <div className={i.thanks}><h2>¡Gracias por responder!</h2><p>Tu opinión nos ayuda a preparar mejores encuentros.</p><Link href="/eventos">Ver próximos eventos</Link></div>
          : info && (
            <form onSubmit={submit}>
              <fieldset className={i.question}><legend>¿Cómo calificarías el evento?</legend>
                <div className={i.starPick} role="radiogroup" aria-label="Calificación de 1 a 5">
                  {[1, 2, 3, 4, 5].map((v) => <button key={v} type="button" role="radio" aria-checked={form.rating === v} aria-label={`${v} de 5`} data-on={form.rating >= v || undefined} onClick={() => setForm({ ...form, rating: v })}><Star size={30} aria-hidden="true" /></button>)}
                </div></fieldset>
              <fieldset className={i.question}><legend>¿Qué tan probable es que se lo recomiendes a un amigo?</legend>
                <div className={i.npsPick} role="radiogroup" aria-label="De 0 a 10">{Array.from({ length: 11 }, (_, v) => <button key={v} type="button" role="radio" aria-checked={form.nps === v} onClick={() => setForm({ ...form, nps: v })}>{v}</button>)}</div>
                <div className={i.npsScale}><span>Nada probable</span><span>Muy probable</span></div></fieldset>
              <label className={i.field}><span>¿Qué fue lo que más te gustó?</span><textarea rows={3} maxLength={1000} value={form.liked} onChange={(e) => setForm({ ...form, liked: e.target.value })} /></label>
              <label className={i.field}><span>¿Qué podríamos mejorar?</span><textarea rows={3} maxLength={1000} value={form.improve} onChange={(e) => setForm({ ...form, improve: e.target.value })} /></label>
              {info.question && <label className={i.field}><span>{info.question}</span><textarea rows={3} maxLength={1000} value={form.extra} onChange={(e) => setForm({ ...form, extra: e.target.value })} /></label>}
              <p className={i.muted}>Tus respuestas son anónimas.</p>
              <button className={i.primary} disabled={busy || !form.rating}>{busy ? 'Enviando…' : 'Enviar respuestas'}</button>
            </form>
          )}
      </section>
    </main>
  );
}
