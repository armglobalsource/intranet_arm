'use client';

import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';
import { ASSIGNMENT_LABELS, assignmentText } from '@/lib/ficha-assignments';
import { useRosterStatus } from './RosterStatusContext';
import type { AssignmentEdit, Encuentro, Row, RowAssignment } from '@/types/ficha';

export const FichaPeopleContext = createContext<{ fichaId: string; encuentros: Encuentro[]; currentId: string }>({ fichaId: '', encuentros: [], currentId: '' });
type Person = RowAssignment['people'][number] & { campusName?: string };
const personKey = (p: Person) => p.userId !== undefined ? `user:${p.userId}` : `manual:${p.manualId}`;

export function PersonCellInput({ value, onChange, row, style, placeholder }: {
  value: string; row: Row; onChange: (value: string, edit: AssignmentEdit) => void;
  style?: React.CSSProperties; placeholder?: string; multiline?: boolean; rows?: number;
}) {
  const context = useContext(FichaPeopleContext);
  const key = row.shared ? 'shared' : context.currentId;
  const saved = row.assignments?.[key];
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="ficha-person-cell" aria-label={`Asignar personas: ${row.label}`} onClick={() => setOpen(true)}
      title={saved ? 'Editar asignación vinculada al directorio' : value ? 'Nombre anterior sin vínculo: selecciona el usuario correspondiente' : 'Seleccionar personas'}
      style={{ width: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', border: '1px dashed #CBD5E1', borderRadius: 7, background: saved ? '#F0FDF9' : '#F8FAFC', color: '#334155', padding: '5px 7px', cursor: 'pointer', textAlign: 'inherit', font: 'inherit', ...style }}>
      {value || placeholder || 'Seleccionar persona…'}
      <span className="ficha-no-print" aria-hidden="true" style={{ marginLeft: 5, color: saved ? '#047857' : '#64748B', fontSize: 10 }}>{saved ? '●' : '+'}</span>
    </button>
    {open && createPortal(<AssignmentDialog row={row} value={value} saved={saved} context={context} onClose={() => setOpen(false)} onSave={edit => { onChange(assignmentText(edit.assignment), edit); setOpen(false); }} />, document.body)}
  </>;
}

function AssignmentDialog({ row, value, saved, context, onClose, onSave }: {
  row: Row; value: string; saved?: RowAssignment;
  context: React.ContextType<typeof FichaPeopleContext>;
  onClose: () => void; onSave: (edit: AssignmentEdit) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState<RowAssignment>(saved ? structuredClone(saved) : { mode: 'people', people: [], note: '' });
  const [scope, setScope] = useState<AssignmentEdit['scope']>(row.shared ? 'all' : 'current');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const userId = useAuthStore(s => s.user?.id);
  const queryClient = useQueryClient();
  const roster = useRosterStatus();
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => { const t = setTimeout(() => setQuery(search), 250); return () => clearTimeout(t); }, [search]);
  const people = useQuery({
    queryKey: ['ficha-people', userId, context.fichaId, query],
    queryFn: ({ signal }) => api.get<Person[]>(`/fichas/${context.fichaId}/people`, { params: { search: query }, signal }).then(r => r.data),
    enabled: !!context.fichaId && draft.mode === 'people', staleTime: 30_000,
  });
  const choose = (p: Person) => setDraft(d => ({ ...d, people: d.people.some(x => personKey(x) === personKey(p)) ? d.people.filter(x => personKey(x) !== personKey(p)) : [...d.people, p.userId !== undefined ? { userId: p.userId, name: p.name } : { manualId: p.manualId!, name: p.name }] }));
  const createPerson = useMutation({
    mutationFn: (name: string) => api.post<Person>(`/fichas/${context.fichaId}/people/manual`, { name }).then(r => r.data),
    onSuccess: p => { choose(p); setSearch(''); queryClient.invalidateQueries({ queryKey: ['ficha-people', userId, context.fichaId] }); },
  });
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose} className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/40" style={{ maxHeight: '90dvh' }}>
    <div className="p-5 space-y-4">
      <div className="flex justify-between gap-3"><div><h2 id={titleId} className="text-lg font-bold">{row.label}</h2><p className="text-sm text-slate-500">Selecciona personas para este puesto.</p></div><button type="button" onClick={onClose} aria-label="Cerrar asignación" className="self-start rounded-lg px-3 py-1 hover:bg-slate-100">✕</button></div>
      {!saved && value && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Dato anterior: <strong>{value}</strong>. Conservado hasta que apliques una nueva asignación.</p>}
      <label className="block text-sm font-medium">Tipo de asignación<select value={draft.mode} onChange={e => setDraft(d => ({ ...d, mode: e.target.value as RowAssignment['mode'], people: [] }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2">
        {Object.entries(ASSIGNMENT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      {draft.mode === 'people' && <div className="space-y-2">
        {draft.people.map(p => <div key={personKey(p)} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm">
          <span className="flex-1 font-medium">{p.name}</span>
          <input aria-label={`Tratamiento de ${p.name}`} value={p.title ?? ''} maxLength={80} placeholder="Tratamiento: Pastor, Pastora…" onChange={e => setDraft(d => ({ ...d, people: d.people.map(x => personKey(x) === personKey(p) ? { ...x, title: e.target.value } : x) }))} className="w-48 rounded-md border border-slate-300 bg-white px-2 py-1" />
          <button type="button" onClick={() => choose(p)} aria-label={`Quitar ${p.name}`} className="px-2 text-slate-600">✕</button>
        </div>)}
        <input autoFocus value={search} maxLength={160} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o apellido…" aria-label="Buscar personas" className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
        <p className="text-xs text-slate-500">Busca usuarios y personas agregadas manualmente. Hasta 10 por puesto.</p>
        <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200" aria-busy={people.isFetching}>
          {people.isPending ? <p role="status" className="p-3 text-sm">Buscando personas…</p> : people.isError ? <div role="alert" className="p-3 text-sm text-red-700">{apiErrorMessage(people.error, 'No se pudo cargar el directorio.')} <button type="button" onClick={() => people.refetch()} className="underline">Reintentar</button></div> : people.data?.length ? people.data.map(p => {
            const selected = draft.people.some(x => personKey(x) === personKey(p));
            const unavailable = p.userId !== undefined && roster[p.userId] === 'no_disponible';
            return <label key={personKey(p)} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 p-3 text-sm last:border-0 hover:bg-slate-50">
              <input type="checkbox" checked={selected} disabled={!selected && (unavailable || draft.people.length >= 10)} onChange={() => choose(p)} />
              <span><span className="font-medium">{p.name}</span><span className="block text-xs text-slate-500">{p.campusName || 'Sin campus'} · {p.userId !== undefined ? `Usuario #${p.userId}` : 'Persona sin cuenta'}{unavailable ? ' · No disponible esta semana' : p.userId !== undefined && roster[p.userId] === 'disponible' ? ' · Disponible' : ''}</span></span>
            </label>;
          }) : <p className="p-3 text-sm text-slate-500">Sin coincidencias. Puedes agregar a esta persona manualmente.</p>}
        </div>
        {search.trim() && !people.data?.some(p => p.name.trim().toLocaleLowerCase() === search.trim().toLocaleLowerCase()) && <button type="button" disabled={draft.people.length >= 10 || createPerson.isPending || people.isFetching || people.isError || search !== query} onClick={() => createPerson.mutate(search.trim())} className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">{createPerson.isPending ? 'Agregando…' : `+ Agregar «${search.trim()}» sin cuenta`}</button>}
        {createPerson.isError && <p role="alert" className="text-sm text-red-700">{apiErrorMessage(createPerson.error, 'No se pudo agregar la persona.')}</p>}
      </div>}
      <label className="block text-sm font-medium">{draft.mode === 'team' ? 'Nombre del equipo' : 'Nota opcional'}<input value={draft.note} maxLength={500} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" placeholder={draft.mode === 'team' ? 'Ej. Equipo Santiago' : 'Ej. Coordinación / apoyo'} /></label>
      {context.encuentros.length > 1 && <label className="block text-sm font-medium">Aplicar a<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" value={scope} onChange={e => setScope(e.target.value as typeof scope)}>
        <option value="current">Solo este encuentro · {context.encuentros.find(e => e.id === context.currentId)?.time}</option>
        <option value="block">Encuentros del mismo bloque (AM / PM)</option>
        <option value="all">Todos los encuentros de esta ficha</option>
      </select></label>}
      <p className="text-xs text-slate-500">El tratamiento solo se muestra en esta asignación. Las personas sin cuenta no reciben acceso a la plataforma.</p>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={createPerson.isPending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancelar</button><button type="button" onClick={() => onSave({ assignment: draft, scope, encounterId: context.currentId })} disabled={createPerson.isPending || (draft.mode === 'team' && !draft.note.trim())} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Aplicar asignación</button></div>
    </div>
  </dialog>;
}
