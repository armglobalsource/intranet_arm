'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  useAllCampuses,
  useCreateCampus,
  useUpdateCampus,
  useDeleteCampus,
  type Campus,
  type CampusSchedule,
  type CreateCampusPayload,
} from '@/hooks/useCampus';
import { useUsers } from '@/hooks/useUsers';
import type { User } from '@/types/user';

const PAGE_SIZE = 20;
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ACCENT = '#0891B2';

// ── helpers ───────────────────────────────────────────────────────────────────

function fullName(u: User) { return `${u.firstName} ${u.lastName}`.trim(); }
function initials(u: User) { return `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase(); }

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition';
const labelCls = 'block text-[11px] font-medium text-slate-500 mb-1';
const sectionCls = 'text-[10px] font-bold uppercase tracking-widest text-slate-400 pb-0.5 border-b border-slate-100';

// ── UserPill ──────────────────────────────────────────────────────────────────

function UserPill({ user, onRemove }: { user: User; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11.5px] font-medium">
      {user.avatarUrl
        ? <img src={user.avatarUrl} className="w-5 h-5 rounded-full object-cover" alt="" />
        : <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{initials(user)}</span>
      }
      {fullName(user)}
      {onRemove && (
        <button onClick={onRemove} className="text-slate-400 hover:text-red-500 transition-colors leading-none">✕</button>
      )}
    </span>
  );
}

// ── UserSelector ──────────────────────────────────────────────────────────────

function UserSelector({ label, ids, users, onChange }: {
  label: string; ids: number[]; users: User[]; onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [open,   setOpen]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected  = users.filter((u) => ids.includes(u.id));
  const available = users.filter((u) =>
    !ids.includes(u.id) && fullName(u).toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div ref={ref} className="relative">
        <div
          className="min-h-[38px] w-full px-3 py-2 border border-slate-200 rounded-lg flex flex-wrap gap-1.5 cursor-text focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition"
          onClick={() => setOpen(true)}
        >
          {selected.map((u) => (
            <UserPill key={u.id} user={u} onRemove={() => onChange(ids.filter((id) => id !== u.id))} />
          ))}
          <input
            type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={selected.length === 0 ? 'Buscar persona…' : ''}
            className="flex-1 min-w-[120px] text-[12.5px] outline-none bg-transparent placeholder:text-slate-300"
          />
        </div>
        {open && available.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {available.slice(0, 30).map((u) => (
              <button key={u.id} type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                onMouseDown={(e) => { e.preventDefault(); onChange([...ids, u.id]); setSearch(''); }}
              >
                {u.avatarUrl
                  ? <img src={u.avatarUrl} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                  : <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{initials(u)}</span>
                }
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-slate-900 truncate">{fullName(u)}</p>
                  <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ScheduleEditor ────────────────────────────────────────────────────────────

function ScheduleEditor({ schedules, onChange }: { schedules: CampusSchedule[]; onChange: (s: CampusSchedule[]) => void }) {
  function add() {
    onChange([...schedules, { dia: 'Domingo', hora: '10:00', descripcion: '' }]);
  }
  function update(i: number, field: keyof CampusSchedule, val: string) {
    onChange(schedules.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }
  function remove(i: number) {
    onChange(schedules.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={labelCls}>Horarios de encuentro</label>
        <button type="button" onClick={add}
          className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 font-semibold transition-colors">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Agregar horario
        </button>
      </div>

      {schedules.length === 0 && (
        <p className="text-[11.5px] text-slate-400 italic py-2">Sin horarios. Haz clic en "Agregar horario".</p>
      )}

      <div className="space-y-2">
        {schedules.map((s, i) => (
          <div key={i} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <select value={s.dia} onChange={(e) => update(i, 'dia', e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-[12.5px] bg-white focus:outline-none focus:border-teal-400 transition">
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <input type="time" value={s.hora} onChange={(e) => update(i, 'hora', e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-[12.5px] bg-white focus:outline-none focus:border-teal-400 transition w-28" />
            <input type="text" value={s.descripcion ?? ''} onChange={(e) => update(i, 'descripcion', e.target.value)}
              placeholder="Ej: Encuentro principal, Jóvenes…"
              className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-[12.5px] bg-white focus:outline-none focus:border-teal-400 transition" />
            <select value={s.fichaType ?? ''} onChange={(e) => update(i, 'fichaType', e.target.value)}
              title="Tipo de ficha para este horario"
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-[12px] bg-white focus:outline-none focus:border-teal-400 transition w-28">
              <option value="">Tipo ficha</option>
              <option value="unico">Único</option>
              <option value="multi">Multi</option>
              <option value="oracion">Oración</option>
            </select>
            <button type="button" onClick={() => remove(i)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CampusModal ───────────────────────────────────────────────────────────────

function CampusModal({ campus, onClose }: { campus?: Campus; onClose: () => void }) {
  const isEdit = !!campus;
  const { data: allUsers = [] } = useUsers();

  const empty: CreateCampusPayload = {
    name: '', siglas: '', address: '', city: '', country: '',
    phone: '', email: '', website: '', description: '',
    pastorIds: [], adminIds: [], schedules: [],
  };

  const [form, setForm] = useState<CreateCampusPayload>(
    campus ? {
      name:        campus.name,
      siglas:      campus.siglas       ?? '',
      address:     campus.address      ?? '',
      city:        campus.city         ?? '',
      country:     campus.country      ?? '',
      phone:       campus.phone        ?? '',
      email:       campus.email        ?? '',
      website:     campus.website      ?? '',
      description: campus.description  ?? '',
      pastorIds:   campus.pastorIds    ?? [],
      adminIds:    campus.adminIds     ?? [],
      schedules:   campus.schedules    ?? [],
    } : empty,
  );

  const [errorMsg, setErrorMsg] = useState('');
  const create    = useCreateCampus();
  const update    = useUpdateCampus();
  const isPending = create.isPending || update.isPending;

  function set<K extends keyof CreateCampusPayload>(k: K, v: CreateCampusPayload[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit() {
    if (!form.name.trim()) return;
    setErrorMsg('');
    const payload: CreateCampusPayload = {
      ...form,
      siglas:      form.siglas?.trim()      || undefined,
      address:     form.address?.trim()     || undefined,
      city:        form.city?.trim()        || undefined,
      country:     form.country?.trim()     || undefined,
      phone:       form.phone?.trim()       || undefined,
      email:       form.email?.trim()       || undefined,
      website:     form.website?.trim()     || undefined,
      description: form.description?.trim() || undefined,
    };
    const opts = {
      onSuccess: onClose,
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? 'Error al guardar';
        setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    };
    if (isEdit) update.mutate({ id: campus!.id, data: payload }, opts);
    else        create.mutate(payload, opts);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] overflow-hidden my-8" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${ACCENT}18` }}>
            🏛️
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">{isEdit ? 'Editar campus' : 'Nuevo campus'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{isEdit ? campus!.name : 'Registra un nuevo campus en el sistema'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-5">

          {/* Identidad */}
          <p className={sectionCls}>Identidad</p>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nombre <span className="text-red-400">*</span></label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="Campus Santiago Centro" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Siglas</label>
              <input type="text" value={form.siglas ?? ''} onChange={(e) => set('siglas', e.target.value.toUpperCase())}
                placeholder="SCT" maxLength={10}
                className={`${inputCls} font-mono font-bold uppercase tracking-widest`} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Descripción</label>
            <textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)}
              rows={2} placeholder="Breve descripción del campus…"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition resize-none" />
          </div>

          {/* Ubicación */}
          <p className={sectionCls}>Ubicación</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ciudad</label>
              <input type="text" value={form.city ?? ''} onChange={(e) => set('city', e.target.value)}
                placeholder="Santiago" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>País</label>
              <input type="text" value={form.country ?? ''} onChange={(e) => set('country', e.target.value)}
                placeholder="Chile" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Dirección</label>
            <input type="text" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)}
              placeholder="Av. Libertador 1234" className={inputCls} />
          </div>

          {/* Contacto */}
          <p className={sectionCls}>Contacto</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Teléfono</label>
              <input type="text" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)}
                placeholder="+56 9 1234 5678" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)}
                placeholder="campus@iglesia.com" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Sitio web</label>
            <input type="url" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)}
              placeholder="https://www.campus.com" className={inputCls} />
          </div>

          {/* Liderazgo */}
          <p className={sectionCls}>Liderazgo</p>

          <UserSelector label="Pastores de campus" ids={form.pastorIds ?? []} users={allUsers}
            onChange={(ids) => set('pastorIds', ids)} />

          <UserSelector label="Administradores de campus" ids={form.adminIds ?? []} users={allUsers}
            onChange={(ids) => set('adminIds', ids)} />

          {/* Horarios */}
          <p className={sectionCls}>Horarios</p>

          <ScheduleEditor schedules={form.schedules ?? []} onChange={(s) => set('schedules', s)} />

          {/* Error */}
          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-[12px] text-red-700">{errorMsg}</span>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-1 border-t border-slate-100">
            <button onClick={handleSubmit} disabled={!form.name.trim() || isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: ACCENT }}>
              {isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
                : isEdit ? 'Guardar cambios' : 'Crear campus'
              }
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({ campus, onConfirm, onCancel, isPending }: {
  campus: Campus; onConfirm: () => void; onCancel: () => void; isPending: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[380px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-slate-900">¿Eliminar campus?</p>
            <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              Estás a punto de eliminar{' '}
              <span className="font-semibold text-slate-700">"{campus.name}"</span>.
              Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="flex gap-2 w-full pt-1">
            <button onClick={onCancel} disabled={isPending}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={onConfirm} disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
              {isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Eliminando...</>
                : 'Sí, eliminar'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ScheduleBadges ────────────────────────────────────────────────────────────

function ScheduleBadges({ schedules }: { schedules: CampusSchedule[] }) {
  if (!schedules.length) return <span className="text-[11px] text-slate-300 italic">Sin horarios</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {schedules.map((s, i) => (
        <span key={i} title={s.descripcion || undefined}
          className="inline-flex flex-col px-2 py-1 rounded-lg bg-teal-50 border border-teal-100 cursor-default">
          <span className="text-[11px] font-bold text-teal-700 leading-tight">
            {s.dia.slice(0, 3)} {s.hora}
          </span>
          {s.descripcion && (
            <span className="text-[10px] text-teal-500 leading-tight truncate max-w-[110px]">{s.descripcion}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ── FilterSelect ──────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, placeholder, children }: {
  value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode;
}) {
  const active = value !== '';
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={`pl-3 pr-8 py-2 rounded-xl border text-[12.5px] font-medium appearance-none transition focus:outline-none focus:ring-2 focus:ring-teal-100 bg-white ${
          active ? 'border-teal-400 text-teal-700 bg-teal-50' : 'border-slate-200 text-slate-600 hover:border-slate-300'
        }`}>
        <option value="">{placeholder}</option>
        {children}
      </select>
      <svg className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${active ? 'text-teal-500' : 'text-slate-400'}`}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  const btnCls = (active: boolean, disabled?: boolean) =>
    `min-w-[32px] h-8 px-2 rounded-lg text-[12px] font-medium transition-colors flex items-center justify-center ${
      disabled ? 'text-slate-300 cursor-not-allowed' :
      active   ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;
  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className={btnCls(false, page === 1)}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="w-8 text-center text-slate-400 text-[12px]">…</span>
          : <button key={p} onClick={() => onChange(p as number)} className={btnCls(p === page)}>{p}</button>
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className={btnCls(false, page === totalPages)}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </div>
  );
}

// ── CampusPage ────────────────────────────────────────────────────────────────

export default function CampusPage() {
  const { data: campuses = [], isLoading } = useAllCampuses();
  const { data: allUsers = [] }            = useUsers();
  const update  = useUpdateCampus();
  const destroy = useDeleteCampus();

  const [modal,         setModal]         = useState<'create' | Campus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Campus | null>(null);
  const [togglingId,    setTogglingId]    = useState<number | null>(null);

  const [search,        setSearch]        = useState('');
  const [debounced,     setDebounced]     = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [page,          setPage]          = useState(1);
  const debRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(debRef.current);
  }, [search]);

  useEffect(() => setPage(1), [debounced, statusFilter, countryFilter]);

  const countries = useMemo(() => {
    const seen: Record<string, true> = {};
    campuses.forEach((c) => { if (c.country) seen[c.country] = true; });
    return Object.keys(seen).sort();
  }, [campuses]);

  function handleToggle(c: Campus) {
    setTogglingId(c.id);
    update.mutate({ id: c.id, data: { isActive: !c.isActive } }, { onSettled: () => setTogglingId(null) });
  }

  function handleDeleteConfirm() {
    if (!confirmDelete) return;
    destroy.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) });
  }

  const filtered = useMemo(() => {
    let list = campuses;
    if (debounced.trim()) list = list.filter((c) =>
      c.name.toLowerCase().includes(debounced.toLowerCase()) ||
      (c.siglas   ?? '').toLowerCase().includes(debounced.toLowerCase()) ||
      (c.city     ?? '').toLowerCase().includes(debounced.toLowerCase()) ||
      (c.country  ?? '').toLowerCase().includes(debounced.toLowerCase()),
    );
    if (statusFilter === 'active')   list = list.filter((c) =>  c.isActive);
    if (statusFilter === 'inactive') list = list.filter((c) => !c.isActive);
    if (countryFilter) list = list.filter((c) => c.country === countryFilter);
    return list;
  }, [campuses, debounced, statusFilter, countryFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = !!statusFilter || !!countryFilter;

  function usersForIds(ids: number[]) {
    return allUsers.filter((u) => ids.includes(u.id));
  }

  return (
    <div className="space-y-5">

      {/* Volver */}
      <Link href="/dashboard/directorio"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-400 hover:text-slate-700 transition-colors group">
        <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Directorio
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Campus</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {filtered.length !== campuses.length
              ? `${filtered.length} de ${campuses.length} campus`
              : `${campuses.length} campus registrado${campuses.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <button onClick={() => setModal('create')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: ACCENT }}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo campus
        </button>
      </div>

      {/* Búsqueda + Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, siglas, ciudad o país…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-[12.5px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
          )}
        </div>

        {countries.length > 0 && (
          <FilterSelect value={countryFilter} onChange={setCountryFilter} placeholder="País">
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </FilterSelect>
        )}

        <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="Estado">
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </FilterSelect>

        {(hasFilters || search) && (
          <button onClick={() => { setStatusFilter(''); setCountryFilter(''); setSearch(''); }}
            className="text-[12px] text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 && campuses.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: `${ACCENT}15` }}>
            🏛️
          </div>
          <div>
            <p className="text-[14px] font-semibold text-slate-700">No hay campus registrados</p>
            <p className="text-[12.5px] text-slate-400 mt-1">Crea el primer campus para comenzar</p>
          </div>
          <button onClick={() => setModal('create')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white"
            style={{ background: ACCENT }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo campus
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Campus', 'Horarios', 'Pastores', 'Contacto', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => {
                  const isToggling = togglingId === c.id;
                  const pastores   = usersForIds(c.pastorIds ?? []);
                  const location   = [c.city, c.country].filter(Boolean).join(', ');

                  return (
                    <tr key={c.id}
                      className={`border-b border-slate-100 last:border-0 transition-colors ${!c.isActive ? 'opacity-60 bg-slate-50/40' : 'hover:bg-slate-50/60'}`}>

                      {/* Campus */}
                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ background: `${ACCENT}15` }}>
                            🏛️
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[13.5px] font-semibold text-slate-900">{c.name}</p>
                              {c.siglas && (
                                <span className="text-[10.5px] font-bold font-mono px-2 py-0.5 rounded-full"
                                  style={{ background: `${ACCENT}15`, color: ACCENT }}>
                                  {c.siglas}
                                </span>
                              )}
                            </div>
                            {location && (
                              <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{location}</p>
                            )}
                            {c.description && (
                              <p className="text-[11px] text-slate-400 italic truncate max-w-[200px]">{c.description}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Horarios */}
                      <td className="px-4 py-3 min-w-[160px]">
                        <ScheduleBadges schedules={c.schedules ?? []} />
                      </td>

                      {/* Pastores */}
                      <td className="px-4 py-3 min-w-[160px]">
                        {pastores.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {pastores.map((u) => <UserPill key={u.id} user={u} />)}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300 italic">Sin asignar</span>
                        )}
                      </td>

                      {/* Contacto */}
                      <td className="px-4 py-3 min-w-[140px]">
                        <div className="flex flex-col gap-0.5">
                          {c.phone && (
                            <span className="text-[12px] text-slate-600 flex items-center gap-1">
                              <svg className="w-3 h-3 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                              {c.phone}
                            </span>
                          )}
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="text-[12px] text-teal-600 hover:underline flex items-center gap-1 truncate max-w-[140px]">
                              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                              </svg>
                              {c.email}
                            </a>
                          )}
                          {c.website && (
                            <a href={c.website} target="_blank" rel="noreferrer" className="text-[12px] text-teal-600 hover:underline flex items-center gap-1 truncate max-w-[140px]">
                              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                              </svg>
                              {c.website.replace(/^https?:\/\//, '')}
                            </a>
                          )}
                          {!c.phone && !c.email && !c.website && (
                            <span className="text-[11px] text-slate-300 italic">—</span>
                          )}
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        {c.isActive
                          ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo</span>
                          : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactivo</span>
                        }
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setModal(c)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Editar">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button onClick={() => handleToggle(c)} disabled={isToggling}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${c.isActive ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                            title={c.isActive ? 'Desactivar' : 'Activar'}>
                            {isToggling
                              ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                              : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                                </svg>
                            }
                          </button>
                          <button onClick={() => setConfirmDelete(c)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Eliminar">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && campuses.length > 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <p className="text-slate-400 text-sm">Sin resultados para los filtros aplicados.</p>
                      <button onClick={() => { setStatusFilter(''); setCountryFilter(''); setSearch(''); }}
                        className="mt-2 text-[12px] text-teal-500 hover:text-teal-700 underline underline-offset-2">
                        Limpiar todos los filtros
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="border-t border-slate-100 px-4">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] text-slate-400">
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                </span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {modal !== null && (
        <CampusModal
          campus={modal !== 'create' ? (modal as Campus) : undefined}
          onClose={() => setModal(null)}
        />
      )}
      {confirmDelete && (
        <DeleteConfirmModal
          campus={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
          isPending={destroy.isPending}
        />
      )}
    </div>
  );
}
