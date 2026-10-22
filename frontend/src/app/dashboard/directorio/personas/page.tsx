'use client';

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { CanDo } from '@/components/shared/CanDo';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useUsers,
  useUpdateUser,
  useDeleteUser,
  useToggleUserStatus,
  useApproveUser,
  useRejectUser,
  useRoles,
} from '@/hooks/useUsers';
import { useAllJobTitles } from '@/hooks/useJobTitles';
import type { JobTitle }                      from '@/hooks/useJobTitles';
import { useActiveCampuses, useAllCampuses }  from '@/hooks/useCampus';
import type { User, UpdateUserDto, MinisterialTitle } from '@/types/user';
import { MINISTERIAL_LABEL, MINISTERIAL_PREFIX, displayName } from '@/types/user';
import type { Role }                          from '@/hooks/useUsers';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { userJobTitleNames } from '@/types/user';
import { useOrgUserProfile } from '@/hooks/useOrgChart';
import { apiErrorMessage } from '@/lib/api';
import CountryPicker from '@/components/CountryPicker';
import UserPicker, { PickableUser } from '@/components/UserPicker';
import {
  useMatchReconciliation, useApplyReconciliation,
  ExcelRowInput, MatchResult, ApplyResult,
} from '@/hooks/useReconciliation';
import { ROLE_LABELS, ORG_ROLE_LABELS, MultiJobTitleSelect, CampusSelect, TeamSelect, avatarColor, userInitials } from './_shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ── ApprovePersonaModal ───────────────────────────────────────────────────────

interface ApprovePersonaModalProps {
  user:      User;
  roles:     Role[];
  onConfirm: (roleId: number) => void;
  onCancel:  () => void;
  isPending: boolean;
}

function ApprovePersonaModal({ user, roles, onConfirm, onCancel, isPending }: ApprovePersonaModalProps) {
  const [roleId, setRoleId] = useState(user.role?.id ?? 0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  const { bg, text } = avatarColor(user.id);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[380px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div>
            <p className="text-[15px] font-bold text-slate-900">
              {user.status === 'rejected' ? 'Reconsiderar solicitud' : 'Aprobar registro'}
            </p>
            <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              {user.status === 'rejected' ? (
                <>Esta solicitud había sido rechazada. Vas a aprobar de todos modos a{' '}
                  <span className="font-semibold text-slate-700">{displayName(user)}</span>.
                  Confirma el rol con el que ingresará al sistema.</>
              ) : (
                <>Vas a aprobar a <span className="font-semibold text-slate-700">{displayName(user)}</span>.
                  Confirma el rol con el que ingresará al sistema.</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100 w-full">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              : <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold" style={{ background: bg, color: text }}>{userInitials(user)}</div>
            }
            <div className="min-w-0 text-left">
              <p className="text-[12px] font-semibold text-slate-800 truncate">{displayName(user)}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          <div className="w-full text-left">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Rol del sistema <span className="text-red-400">*</span></label>
            <select value={roleId || ''} onChange={(e) => setRoleId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition bg-white">
              <option value="">Seleccionar rol...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{ROLE_LABELS[r.name] ?? r.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 w-full pt-1">
            <button onClick={onCancel} disabled={isPending}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={() => onConfirm(roleId)} disabled={isPending || !roleId}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
              {isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Aprobando...</>
                : 'Aprobar'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  user:      User;
  onConfirm: () => void;
  onCancel:  () => void;
  isPending: boolean;
}

function DeleteConfirmModal({ user, onConfirm, onCancel, isPending }: DeleteConfirmModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  const { bg, text } = avatarColor(user.id);
  const { data: orgProfile } = useOrgUserProfile(user.id);
  const memberships = orgProfile?.orgMemberships ?? [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[380px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          {/* Warning icon */}
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </div>

          <div>
            <p className="text-[15px] font-bold text-slate-900">¿Eliminar persona?</p>
            <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              Estás a punto de eliminar a{' '}
              <span className="font-semibold text-slate-700">{displayName(user)}</span>.
              Esta acción no se puede deshacer.
            </p>
          </div>

          {/* User preview */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100 w-full">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              : <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold" style={{ background: bg, color: text }}>{userInitials(user)}</div>
            }
            <div className="min-w-0 text-left">
              <p className="text-[12px] font-semibold text-slate-800 truncate">{displayName(user)}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          {memberships.length > 0 && (
            <div className="w-full text-left p-3 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-[11.5px] font-semibold text-amber-800">
                ⚠ Esta persona pertenece a {memberships.length} equipo{memberships.length !== 1 ? 's' : ''}/área{memberships.length !== 1 ? 's' : ''} del organigrama
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {memberships.map((m) => (
                  <span key={m.id} className="inline-block bg-amber-100 text-amber-800 text-[10.5px] font-medium px-2 py-0.5 rounded-full">
                    {m.team?.name ?? m.area?.name ?? '—'}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-amber-700 mt-1.5">Al eliminarla, también se le quitará de esos equipos.</p>
            </div>
          )}

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

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, kind, onDismiss }: { msg: string; kind: 'success' | 'error'; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium ${kind === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
      {kind === 'error'
        ? <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        : <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      <span>{msg}</span>
      <button onClick={onDismiss} className="ml-1 opacity-70 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: User['status'] }) {
  if (status === 'active')
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo</span>;
  if (status === 'pending')
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Pendiente</span>;
  if (status === 'rejected')
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Rechazado</span>;
  if (status === 'suspended')
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Suspendido</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactivo</span>;
}

// ── FilterSelect ─────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, placeholder, children }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  const active = value !== '';
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pl-3 pr-8 py-2 rounded-xl border text-[12.5px] font-medium appearance-none transition focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white ${
          active
            ? 'border-blue-400 text-blue-700 bg-blue-50'
            : 'border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <svg className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${active ? 'text-blue-500' : 'text-slate-400'}`}
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
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  const btnCls = (active: boolean, disabled?: boolean) =>
    `min-w-[32px] h-8 px-2 rounded-lg text-[12px] font-medium transition-colors flex items-center justify-center ${
      disabled ? 'text-slate-300 cursor-not-allowed' :
      active   ? 'bg-slate-900 text-white' :
                 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className={btnCls(false, page === 1)}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="w-8 text-center text-slate-400 text-[12px]">…</span>
          : <button key={p} onClick={() => onChange(p)} className={btnCls(p === page)}>{p}</button>
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className={btnCls(false, page === totalPages)}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </div>
  );
}

// ── ReconciliarExcelModal ────────────────────────────────────────────────────
// Importa un Excel de datos reales y hace match por nombre contra las personas
// ya existentes (útil para reemplazar emails/datos de prueba por los reales),
// permitiendo también crear personas nuevas cuando no hay match.

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.95)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10.5px] font-medium">Match exacto</span>;
  if (confidence >= 0.5)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10.5px] font-medium">Revisar sugerencia</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10.5px] font-medium">Sin sugerencia clara</span>;
}

async function parseReconciliationExcel(file: File): Promise<ExcelRowInput[]> {
  const XLSX = await import('xlsx');
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  // range: 2 salta título + fila en blanco; la fila real de encabezados es la índice 2
  const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { range: 2, defval: '' });

  return data
    .filter((r) => String(r['Nombre completo'] ?? '').trim())
    .map((r, i) => ({
      rowKey:           `row-${i}`,
      nombreCompleto:   String(r['Nombre completo'] ?? '').trim(),
      area:             String(r['Área'] ?? '').trim(),
      correo:           String(r['Correo Electronico'] ?? '').trim(),
      fechaNacimiento:  String(r['Fecha Nacimiento'] ?? '').trim(),
      campus:           String(r['Campus'] ?? '').trim(),
    }));
}

function ReconciliarExcelModal({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const { data: allUsers = [] } = useUsers();
  const { data: campuses = [] } = useAllCampuses();
  const matchMutation = useMatchReconciliation();
  const applyMutation = useApplyReconciliation();

  const [phase,        setPhase]        = useState<'idle' | 'preview' | 'done'>('idle');
  const [fileName,     setFileName]     = useState('');
  const [results,      setResults]      = useState<MatchResult[]>([]);
  const [selections,   setSelections]   = useState<Record<string, number | null>>({});
  const [createFlags,  setCreateFlags]  = useState<Record<string, boolean>>({});
  const [applyResults, setApplyResults] = useState<Record<string, ApplyResult>>({});
  const [error,        setError]        = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<'exact' | 'suggestions' | 'none'>('exact');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const pickableUsers: PickableUser[] = useMemo(
    () => allUsers.map((u) => ({ id: u.id, name: displayName(u), email: u.email, campus: u.campus?.name ?? null })),
    [allUsers],
  );
  const campusNameById = useMemo(() => new Map(campuses.map((c) => [c.id, c.name])), [campuses]);

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    try {
      const rows = await parseReconciliationExcel(file);
      if (rows.length === 0) {
        setError('No se encontraron filas con "Nombre completo" en el archivo.');
        return;
      }
      const matched = await matchMutation.mutateAsync(rows);
      setResults(matched);
      const initialSelections: Record<string, number | null> = {};
      const initialCreateFlags: Record<string, boolean> = {};
      matched.forEach((r) => {
        initialSelections[r.rowKey] = r.suggestedUserId;
        initialCreateFlags[r.rowKey] = true;
      });
      setSelections(initialSelections);
      setCreateFlags(initialCreateFlags);
      setActiveTab('exact');
      setPhase('preview');
    } catch (err: any) {
      setError(apiErrorMessage(err, 'No se pudo procesar el archivo.'));
    }
  }

  // "Aplicar cambios" siempre opera sobre TODAS las filas (results), sin importar la pestaña activa.
  const rowsToUpdate = results.filter((r) => selections[r.rowKey] != null);
  const rowsToCreate = results.filter((r) => selections[r.rowKey] == null && createFlags[r.rowKey] && !!r.excelRow.correo);
  const totalActionable = rowsToUpdate.length + rowsToCreate.length;

  // Pestañas por confianza — solo afectan qué se muestra en la tabla, no qué se aplica.
  const exactRows       = results.filter((r) => r.confidence >= 0.95);
  const suggestionRows  = results.filter((r) => r.confidence >= 0.5 && r.confidence < 0.95);
  const noMatchRows     = results.filter((r) => r.confidence < 0.5);
  const visibleResults  = activeTab === 'exact' ? exactRows : activeTab === 'suggestions' ? suggestionRows : noMatchRows;

  async function handleApply() {
    const matches = [
      ...rowsToUpdate.map((r) => ({
        rowKey: r.rowKey, action: 'update' as const, userId: selections[r.rowKey]!,
        nombreCompleto: r.excelRow.nombreCompleto,
        email: r.excelRow.correo || undefined, birthDate: r.parsedBirthDate ?? undefined,
        campusId: r.resolvedCampusId ?? undefined,
      })),
      ...rowsToCreate.map((r) => ({
        rowKey: r.rowKey, action: 'create' as const, nombreCompleto: r.excelRow.nombreCompleto,
        email: r.excelRow.correo, birthDate: r.parsedBirthDate ?? undefined,
        campusId: r.resolvedCampusId ?? undefined,
      })),
    ];
    if (matches.length === 0) return;

    try {
      const res = await applyMutation.mutateAsync(matches);
      const byRowKey: Record<string, ApplyResult> = {};
      res.forEach((r) => { byRowKey[r.rowKey] = r; });
      setApplyResults(byRowKey);
      setPhase('done');
      onApplied();
    } catch (err: any) {
      setError(apiErrorMessage(err, 'No se pudo aplicar los cambios.'));
    }
  }

  const successCount = Object.values(applyResults).filter((r) => r.status === 'success').length;
  const skippedCount = Object.values(applyResults).filter((r) => r.status === 'skipped').length;
  const errorCount    = Object.values(applyResults).filter((r) => r.status === 'error').length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1100px] overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">Importar personas desde Excel</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Sube un Excel real y haz match contra las personas ya registradas, o crea las que falten</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">

          {/* IDLE — drop zone */}
          {phase === 'idle' && (
            <>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-3">
                <label className="flex flex-col items-center gap-3 cursor-pointer">
                  <svg className="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-slate-700">Haz clic para seleccionar un archivo</p>
                    <p className="text-[11.5px] text-slate-400 mt-0.5">Formatos soportados: .xlsx, .xls</p>
                    <p className="text-[11px] text-slate-400 mt-1">Columnas esperadas: Nombre completo, Correo Electronico, Fecha Nacimiento, Campus</p>
                  </div>
                  <input type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </label>
              </div>
              {matchMutation.isPending && (
                <p className="text-center text-[12.5px] text-slate-400">Calculando coincidencias…</p>
              )}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-[11.5px] text-red-700">{error}</p>
                </div>
              )}
            </>
          )}

          {/* PREVIEW — tabla de reconciliación */}
          {phase === 'preview' && (
            <>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-[12px] text-slate-600 font-medium truncate">{fileName}</span>
                <span className="ml-auto text-[11.5px] text-slate-400 flex-shrink-0">
                  {totalActionable} de {results.length} con acción asignada (en total)
                  <span className="text-slate-400"> · {rowsToUpdate.length} actualizar, {rowsToCreate.length} crear</span>
                </span>
              </div>

              {/* Tabs por confianza */}
              <div className="flex items-center gap-1.5">
                {([
                  ['exact',       `Match exacto (${exactRows.length})`],
                  ['suggestions', `Revisar sugerencia (${suggestionRows.length})`],
                  ['none',        `Sin coincidencia (${noMatchRows.length})`],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors ${
                      activeTab === key
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        {['Excel', 'Área (Excel)', 'Campus', 'Fecha nacimiento', 'Confianza', 'Persona en el sistema'].map((h) => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleResults.map((r) => {
                        const campusName = r.resolvedCampusId != null ? campusNameById.get(r.resolvedCampusId) : null;
                        return (
                          <tr key={r.rowKey} className="border-t border-slate-100 align-top">
                            <td className="px-3 py-2">
                              <p className="text-[12px] font-semibold text-slate-900">{r.excelRow.nombreCompleto}</p>
                              <p className="text-[10.5px] text-slate-400">{r.excelRow.correo || '—'}</p>
                            </td>
                            <td className="px-3 py-2 text-[11.5px] text-slate-600">
                              {r.excelRow.area || <span className="text-slate-300 italic">sin dato</span>}
                            </td>
                            <td className="px-3 py-2 text-[11.5px] text-slate-600">
                              {campusName ?? <span className="text-slate-300 italic">{r.excelRow.campus || 'sin dato'}</span>}
                            </td>
                            <td className="px-3 py-2 text-[11.5px] text-slate-600">
                              {r.parsedBirthDate ?? <span className="text-amber-500 italic">fecha inválida</span>}
                            </td>
                            <td className="px-3 py-2"><ConfidenceBadge confidence={r.confidence} /></td>
                            <td className="px-3 py-2 min-w-[260px]">
                              <UserPicker
                                users={pickableUsers}
                                suggestions={r.topCandidates.map((c) => ({ id: c.userId, name: c.name, email: c.email, score: c.score, campus: c.campus, area: c.area }))}
                                value={selections[r.rowKey] ?? null}
                                onChange={(userId) => setSelections((s) => ({ ...s, [r.rowKey]: userId }))}
                              />
                              {selections[r.rowKey] != null && (() => {
                                const chosen = r.topCandidates.find((c) => c.userId === selections[r.rowKey]);
                                return (
                                  <div className="text-[10.5px] mt-1.5 space-y-0.5">
                                    {chosen && (chosen.campus || chosen.area) && (
                                      <p className="text-slate-400">
                                        cuenta actual — {chosen.campus && `campus: ${chosen.campus}`}
                                        {chosen.campus && chosen.area && ' · '}
                                        {chosen.area && `área: ${chosen.area}`}
                                      </p>
                                    )}
                                    <p className="text-emerald-600">→ nombre: <span className="font-medium">{r.excelRow.nombreCompleto}</span></p>
                                    <p className="text-emerald-600">→ correo: <span className="font-medium">{r.excelRow.correo || 'sin correo en el Excel'}</span></p>
                                  </div>
                                );
                              })()}
                              {selections[r.rowKey] == null && (
                                r.excelRow.correo ? (
                                  <label className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={createFlags[r.rowKey] ?? true}
                                      onChange={(e) => setCreateFlags((f) => ({ ...f, [r.rowKey]: e.target.checked }))}
                                      className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                                    />
                                    Crear persona nueva
                                  </label>
                                ) : (
                                  <p className="text-[10.5px] text-amber-500 italic mt-1.5">Sin email — no se puede crear</p>
                                )
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {visibleResults.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-slate-400">
                            No hay filas en esta pestaña.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-[11.5px] text-red-700">{error}</p>
                </div>
              )}
            </>
          )}

          {/* DONE */}
          {phase === 'done' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${errorCount === 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                <span className="text-2xl">{errorCount === 0 ? '✓' : '⚠'}</span>
              </div>
              <div className="text-center">
                <p className="text-[15px] font-bold text-slate-900">Reconciliación aplicada</p>
                <p className="text-[12.5px] text-slate-500 mt-1">
                  {successCount} actualizada{successCount !== 1 ? 's' : ''}/creada{successCount !== 1 ? 's' : ''}
                  {skippedCount > 0 ? ` · ${skippedCount} sin cambios` : ''}
                  {errorCount > 0 ? ` · ${errorCount} con error` : ''}
                </p>
              </div>
              {errorCount > 0 && (
                <div className="w-full border border-red-200 rounded-xl overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-[11.5px]">
                      <thead className="bg-red-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-red-400">Fila</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-red-400">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(applyResults).filter((r) => r.status === 'error').map((r) => (
                          <tr key={r.rowKey} className="border-t border-red-100">
                            <td className="px-3 py-2 text-slate-600">{r.rowKey}</td>
                            <td className="px-3 py-2 text-red-600">{r.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center gap-2 pt-1">
            {phase === 'idle' && (
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
            )}
            {phase === 'preview' && (
              <>
                <button onClick={() => { setResults([]); setFileName(''); setPhase('idle'); setError(null); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50 transition-colors">
                  ← Atrás
                </button>
                <button
                  onClick={handleApply}
                  disabled={totalActionable === 0 || applyMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {applyMutation.isPending ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Aplicando...</>
                  ) : (
                    `Aplicar cambios (${totalActionable})`
                  )}
                </button>
              </>
            )}
            {phase === 'done' && (
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-900 text-[13px] font-semibold text-white hover:bg-slate-700 transition-colors">
                Cerrar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PersonasPage ──────────────────────────────────────────────────────────────

export default function PersonasPage() {
  return (
    <Suspense fallback={null}>
      <PersonasPageInner />
    </Suspense>
  );
}

function PersonasPageInner() {
  const allowed = useRequirePermission('users:view');
  const searchParams = useSearchParams();
  const [search,    setSearch]    = useState('');
  const [debounced, setDebounced] = useState('');
  const debRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(debRef.current);
  }, [search]);

  // Filters
  const [cargoFilter,  setCargoFilter]  = useState('');
  const [campusFilter, setCampusFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams?.get('status') ?? '');
  const [page, setPage] = useState(1);

  const { data: users = [], isLoading } = useUsers(debounced || undefined);
  const { data: allJobTitles = [] }     = useAllJobTitles();
  const { data: campuses = [] }         = useActiveCampuses();
  const { data: roles = [] }            = useRoles();

  const toggleStatus = useToggleUserStatus();
  const deleteUser   = useDeleteUser();
  const approveUser  = useApproveUser();
  const rejectUser   = useRejectUser();

  const [importing,      setImporting]      = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState<User | null>(null);
  const [approving,      setApproving]      = useState<User | null>(null);
  const [togglingId,     setTogglingId]     = useState<number | null>(null);
  const [decidingId,     setDecidingId]     = useState<number | null>(null);
  const [toast,          setToast]          = useState<{ msg: string; kind: 'success' | 'error' } | null>(null);

  // Reset page when filters change
  useEffect(() => setPage(1), [debounced, cargoFilter, campusFilter, statusFilter]);

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = users;
    if (cargoFilter)  list = list.filter((u) => u.jobTitles.some((jt) => String(jt.jobTitle.id) === cargoFilter));
    if (campusFilter) list = list.filter((u) => String(u.campusId) === campusFilter);
    if (statusFilter) list = list.filter((u) => u.status === statusFilter);
    return list;
  }, [users, cargoFilter, campusFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageUsers  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = cargoFilter || campusFilter || statusFilter;

  function handleToggle(user: User) {
    const next = user.status === 'active' ? 'inactive' : 'active';
    setTogglingId(user.id);
    toggleStatus.mutate({ id: user.id, status: next }, { onSettled: () => setTogglingId(null) });
  }

  function handleApproveConfirm(user: User, roleId: number) {
    setDecidingId(user.id);
    approveUser.mutate({ id: user.id, roleId }, {
      onSuccess: () => { setToast({ msg: `${displayName(user)} fue aprobado y ya puede iniciar sesión.`, kind: 'success' }); setApproving(null); },
      onError:   (err) => setToast({ msg: apiErrorMessage(err, 'No se pudo aprobar el registro.'), kind: 'error' }),
      onSettled: () => setDecidingId(null),
    });
  }

  function handleReject(user: User) {
    setDecidingId(user.id);
    rejectUser.mutate(user.id, {
      onSuccess: () => setToast({ msg: `Se rechazó la solicitud de ${displayName(user)}.`, kind: 'success' }),
      onError:   (err) => setToast({ msg: apiErrorMessage(err, 'No se pudo rechazar el registro.'), kind: 'error' }),
      onSettled: () => setDecidingId(null),
    });
  }

  function handleDeleteConfirm() {
    if (!confirmDelete) return;
    deleteUser.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) });
  }

  // Active job titles for the cargo filter dropdown
  const activeJobTitles = allJobTitles.filter((jt) => jt.isActive);

  if (!allowed) return null;

  return (
    <div className="space-y-5">

      {/* Back button */}
      <Link
        href="/dashboard/directorio"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-400 hover:text-slate-700 transition-colors group"
      >
        <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Configuración
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Personas</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {filtered.length !== users.length
              ? `${filtered.length} de ${users.length} persona${users.length !== 1 ? 's' : ''}`
              : `${users.length} persona${users.length !== 1 ? 's' : ''} registrada${users.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Importar Excel
          </button>
          <CanDo permission="users:create">
            <Link href="/dashboard/directorio/personas/nueva"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-semibold text-white transition-all bg-violet-600 hover:bg-violet-700">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nueva persona
            </Link>
          </CanDo>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o cargo..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-[12.5px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
          )}
        </div>

        {/* Cargo filter */}
        <FilterSelect value={cargoFilter} onChange={setCargoFilter} placeholder="Cargo">
          {activeJobTitles.map((jt) => (
            <option key={jt.id} value={String(jt.id)}>{jt.name}</option>
          ))}
        </FilterSelect>

        {/* Campus filter */}
        <FilterSelect value={campusFilter} onChange={setCampusFilter} placeholder="Campus">
          {campuses.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </FilterSelect>

        {/* Estado filter */}
        <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="Estado">
          <option value="pending">Pendiente</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="suspended">Suspendido</option>
          <option value="rejected">Rechazado</option>
        </FilterSelect>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setCargoFilter(''); setCampusFilter(''); setStatusFilter(''); }}
            className="text-[12px] text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Persona', 'Cargos', 'Campus', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageUsers.map((u) => {
                  const { bg, text } = avatarColor(u.id);
                  const titles       = userJobTitleNames(u);
                  return (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                            : <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-semibold" style={{ background: bg, color: text }}>{userInitials(u)}</div>
                          }
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{displayName(u)}</p>
                            <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {titles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {titles.map((t) => (
                              <span key={t} className="inline-block bg-blue-50 text-blue-700 text-[10px] font-medium px-2 py-0.5 rounded-full border border-blue-200">{t}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300 italic">Sin cargo</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.campus
                          ? <span className="text-[12px] text-slate-600">{u.campus.name}</span>
                          : <span className="text-[11px] text-slate-300 italic">—</span>
                        }
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <CanDo permission="users:edit">
                            <Link href={`/dashboard/directorio/personas/${u.id}/editar`}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Editar">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </Link>
                          </CanDo>
                          {u.status === 'pending' ? (
                            <CanDo permission="users:edit">
                              <button onClick={() => setApproving(u)} disabled={decidingId === u.id}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                title="Aprobar registro">
                                {decidingId === u.id
                                  ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                }
                              </button>
                              <button onClick={() => handleReject(u)} disabled={decidingId === u.id}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                                title="Rechazar registro">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </CanDo>
                          ) : u.status === 'rejected' ? (
                            <CanDo permission="users:edit">
                              <button onClick={() => setApproving(u)} disabled={decidingId === u.id}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                title="Reconsiderar y aprobar">
                                {decidingId === u.id
                                  ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                    </svg>
                                }
                              </button>
                            </CanDo>
                          ) : (
                            <CanDo permission="users:edit">
                              <button onClick={() => handleToggle(u)} disabled={togglingId === u.id}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${u.status === 'active' ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                                title={u.status === 'active' ? 'Desactivar' : 'Activar'}>
                                {togglingId === u.id
                                  ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                                    </svg>
                                }
                              </button>
                            </CanDo>
                          )}
                          <CanDo permission="users:delete">
                            <button
                              onClick={() => setConfirmDelete(u)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Eliminar">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                              </svg>
                            </button>
                          </CanDo>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center">
                      <p className="text-slate-400 text-sm">
                        {search || hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay personas registradas'}
                      </p>
                      {hasFilters && (
                        <button
                          onClick={() => { setCargoFilter(''); setCampusFilter(''); setStatusFilter(''); setSearch(''); }}
                          className="mt-2 text-[12px] text-blue-500 hover:text-blue-700 underline underline-offset-2"
                        >
                          Limpiar todos los filtros
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
      {importing && (
        <ReconciliarExcelModal
          onClose={() => setImporting(false)}
          onApplied={() => {}}
        />
      )}
      {confirmDelete && (
        <DeleteConfirmModal
          user={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
          isPending={deleteUser.isPending}
        />
      )}
      {approving && (
        <ApprovePersonaModal
          user={approving}
          roles={roles}
          onConfirm={(roleId) => handleApproveConfirm(approving, roleId)}
          onCancel={() => setApproving(null)}
          isPending={approveUser.isPending}
        />
      )}
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />}
    </div>
  );
}
