'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { usePermissions } from '@/hooks/usePermissions';
import { api } from '@/lib/api';
import {
  useOrgAreas, useOrgAreaTree, useOrgSearch, useOrgUserProfile,
  useUpdateOrgArea, useUpdateOrgTeam, useCreateOrgTeam, useDeleteOrgTeam,
  useCreateOrgMembership, useUpdateOrgMembership, useDeleteOrgMembership,
  useUploadTeamLogo, useUploadAreaLogo,
} from '@/hooks/useOrgChart';
import { useAllJobTitles, useCreateJobTitle } from '@/hooks/useJobTitles';
import { useCreateUser, useUpdateUser, useRoles } from '@/hooks/useUsers';
import { useActiveCampuses } from '@/hooks/useCampus';
import type { CampusOption } from '@/hooks/useCampus';
import type { OrgArea, OrgAreaTree, OrgTeam, OrgMembership, OrgMembershipFull, OrgUser, OrgSearchUser, OrgRole } from '@/types/orgchart';
import { orgUserJobTitle, membershipArea, MINISTERIAL_PREFIX } from '@/types/orgchart';
import CountryPicker from '@/components/CountryPicker';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(u: OrgUser) {
  const first = u.firstName?.[0] ?? '';
  const last  = u.lastName?.[0] ?? '';
  return (first + (last || first)).toUpperCase();
}

function fullName(u: OrgUser) {
  const prefix = u.ministerialTitle ? MINISTERIAL_PREFIX[u.ministerialTitle] + ' ' : '';
  return prefix + [u.firstName, u.lastName].filter(Boolean).join(' ');
}

const ROLE_LABEL: Record<OrgRole, string> = {
  area_leader: 'Líder de Área',
  team_leader: 'Líder de Equipo',
  member:      'Miembro',
};

// ── OrgToast ───────────────────────────────────────────────────────────────────
function OrgToast({ msg, kind, onDismiss }: { msg: string; kind: 'success' | 'error'; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium animate-fade-in ${kind === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
      {kind === 'error'
        ? <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        : <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      <span>{msg}</span>
      <button onClick={onDismiss} className="ml-1 opacity-70 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
}

// ── ConfirmModal ───────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  title:         string;
  message:       string;
  confirmLabel?: string;
  danger?:       boolean;
  onConfirm:     () => void;
  onCancel:      () => void;
}
function ConfirmModal({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel }: ConfirmModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9998] p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[360px] p-6 flex flex-col items-center gap-4 text-center" onClick={(e) => e.stopPropagation()}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-50' : 'bg-amber-50'}`}>
          {danger
            ? <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            : <svg className="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          }
        </div>
        <div>
          <p className="text-[15px] font-bold text-slate-900">{title}</p>
          <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2.5 w-full">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Redimensiona una imagen a máx 512×512 px y la convierte a WebP (calidad 85%).
 *  Esto mantiene los archivos pequeños y aptos para uso como avatar. */
function resizeImage(file: File, maxPx = 512): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => blob
          ? resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }))
          : reject(new Error('No se pudo redimensionar la imagen')),
        'image/webp',
        0.85,
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── UserAvatar ─────────────────────────────────────────────────────────────────

function UserAvatar({ user, color, size = 38 }: { user: OrgUser; color: string; size?: number }) {
  const sz = `${size}px`;
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatarUrl} alt={fullName(user)} className="rounded-full object-cover flex-shrink-0" style={{ width: sz, height: sz }} />
    );
  }
  return (
    <div className="rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ width: sz, height: sz, background: color }}>
      {initials(user)}
    </div>
  );
}

// ── MemberCard ─────────────────────────────────────────────────────────────────

interface MemberCardProps {
  membership: OrgMembership;
  color:      string;
  canEdit:    boolean;
  onSelect:   (m: OrgMembership) => void;
  onRemove:   (id: number) => void;
}

function MemberCard({ membership, color, canEdit, onSelect, onRemove }: MemberCardProps) {
  const { user, role } = membership;
  const isInactive = user.status !== 'active';

  return (
    <div
      className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 shadow-sm cursor-pointer group transition-shadow hover:shadow-md border ${
        isInactive
          ? 'bg-orange-50 border-dashed border-orange-200'
          : 'bg-white border-slate-200'
      }`}
      onClick={() => onSelect(membership)}
    >
      <UserAvatar user={user} color={color} size={36} />

      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-semibold leading-snug truncate ${isInactive ? 'text-orange-700' : 'text-slate-900'}`}>
          {fullName(user)}
        </div>
        <div className="text-[10.5px] font-medium uppercase tracking-wide mt-0.5 text-slate-400 truncate">
          {membership.customTitle ?? orgUserJobTitle(user) ?? ROLE_LABEL[role]}
        </div>
      </div>

      {canEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(membership.id); }}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
          title="Quitar del equipo"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── TeamCard ───────────────────────────────────────────────────────────────────

interface TeamCardProps {
  team:         OrgTeam;
  color:        string;
  canEdit:      boolean;
  forceOpen:    boolean | null;
  isDragging?:  boolean;
  dragHandle?:  React.ReactNode;
  onSelect:     (m: OrgMembership) => void;
  onSelectTeam: (t: OrgTeam) => void;
}

function TeamCard({ team, color, canEdit, forceOpen, isDragging, dragHandle, onSelect, onSelectTeam }: TeamCardProps) {
  const [open,            setOpen]            = useState(false);
  const [descOpen,        setDescOpen]        = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  const deleteMembership = useDeleteOrgMembership();

  useEffect(() => {
    if (forceOpen !== null) {
      setOpen(forceOpen);
      setDescOpen(forceOpen);
    }
  }, [forceOpen]);

  const total = team.memberships.length;

  function handleRemove(id: number) {
    setConfirmRemoveId(id);
  }

  return (
    <div style={{ opacity: isDragging ? 0.5 : 1 }}>
      {/* Header del equipo */}
      <div
        className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 shadow-sm cursor-pointer transition-shadow hover:shadow-md"
        style={{ background: '#d1d0cc' }}
        onClick={() => onSelectTeam(team)}
      >
        {/* Drag handle — solo en modo edición */}
        {dragHandle}

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-slate-800 leading-snug truncate">{team.name}</div>
          <div className="text-[10.5px] text-slate-500 mt-0.5 uppercase tracking-wide">
            {total} persona{total !== 1 ? 's' : ''}
          </div>
        </div>

        {team.desc && (
          <button
            onClick={(e) => { e.stopPropagation(); setDescOpen((v) => !v); }}
            className={`w-[22px] h-[22px] rounded-md flex-shrink-0 border flex items-center justify-center text-[11px] font-bold italic font-serif transition-all ${
              descOpen ? 'text-white border-transparent' : 'border-slate-400/40 text-slate-500 hover:bg-slate-300/30'
            }`}
            style={descOpen ? { background: color, borderColor: color } : {}}
            title="Ver descripción"
          >
            i
          </button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className={`w-7 h-7 rounded-[7px] flex-shrink-0 border flex items-center justify-center transition-all ${
            open ? 'text-white border-transparent' : 'border-slate-400/40 text-slate-500 hover:bg-slate-300/30'
          }`}
          style={open ? { background: color, borderColor: color } : {}}
        >
          <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Descripción */}
      {descOpen && team.desc && (
        <div className="text-[12.5px] leading-relaxed rounded-b-[9px] px-3.5 py-2.5 whitespace-pre-line border border-t-0 mt-[-2px] mb-1 text-slate-500" style={{ background: `${color}08`, borderColor: `${color}30` }}>
          {team.desc}
        </div>
      )}

      {/* Miembros */}
      {open && (
        <div className="ml-[18px] pl-[26px] mt-1.5 flex flex-col gap-1.5 border-l-2" style={{ borderColor: `${color}2a` }}>
          {team.memberships.map((m) => (
            <MemberCard key={m.id} membership={m} color={color} canEdit={canEdit} onSelect={onSelect} onRemove={handleRemove} />
          ))}
          {team.memberships.length === 0 && (
            <p className="text-xs text-slate-400 italic px-2 py-1">Sin miembros asignados</p>
          )}
        </div>
      )}

      {confirmRemoveId !== null && (
        <ConfirmModal
          title="¿Quitar persona?"
          message="La persona será removida de este equipo. Puedes volver a agregarla después."
          confirmLabel="Quitar"
          danger
          onConfirm={() => { deleteMembership.mutate(confirmRemoveId); setConfirmRemoveId(null); }}
          onCancel={() => setConfirmRemoveId(null)}
        />
      )}
    </div>
  );
}


// ── AreaLeaderCard ─────────────────────────────────────────────────────────────

function AreaLeaderCard({ membership, color, onSelect }: { membership: OrgMembership; color: string; onSelect: (m: OrgMembership) => void }) {
  const { user } = membership;
  return (
    <div
      className="flex items-center gap-3 bg-white border-l-[3px] rounded-[10px] px-4 py-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow flex-shrink-0"
      style={{ borderLeftColor: color }}
      onClick={() => onSelect(membership)}
    >
      <UserAvatar user={user} color={color} size={40} />
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900 leading-snug truncate max-w-[160px]">{fullName(user)}</div>
        <div className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400 mt-0.5 truncate">{membership.customTitle ?? orgUserJobTitle(user) ?? 'Líder'}</div>
      </div>
    </div>
  );
}

// ── FunctionPicker ─────────────────────────────────────────────────────────────
// Selector de función/cargo para membresías del organigrama.
// Abre un dropdown que permite:
//   1. Buscar un cargo existente (filtra todos los cargos globales)
//   2. Seleccionar un cargo asignado a la persona (aparecen cuando el campo está vacío)
//   3. Crear un nuevo cargo global si el texto no coincide con ninguno
//   4. Escribir una descripción libre (se guarda como customTitle sin crear cargo)

interface FunctionPickerProps {
  user:         OrgUser;
  value:        string;
  onChange:     (v: string) => void;
  color:        string;
  placeholder?: string;
}

function FunctionPicker({ user, value, onChange, color, placeholder }: FunctionPickerProps) {
  const [open, setOpen] = useState(false);
  const { data: allJobTitles = [] } = useAllJobTitles();
  const createJobTitle = useCreateJobTitle();

  const trimmed    = value.trim();
  const userJTs    = user.jobTitles.map((jt) => jt.jobTitle);
  // Cuando hay texto: filtra todos los cargos globales; cuando no hay: muestra los del usuario
  const filtered   = trimmed.length >= 1
    ? allJobTitles.filter((jt) => jt.name.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 6)
    : userJTs.slice(0, 6);
  const exactMatch = allJobTitles.some((jt) => jt.name.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length >= 1 && !exactMatch;
  const showDrop   = open && (filtered.length > 0 || showCreate);

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder ?? 'Buscar cargo o escribir descripción…'}
          className="w-full text-[11.5px] px-2.5 py-1.5 pr-6 rounded-lg border border-slate-200 bg-white text-slate-700 placeholder-slate-300 focus:outline-none focus:border-blue-300 transition-colors"
        />
        {value && (
          <button
            type="button"
            onMouseDown={() => { onChange(''); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors text-xs leading-none"
          >×</button>
        )}
      </div>

      {/* Hint: escribir libremente es válido */}
      <p className="mt-1 text-[10px] text-slate-400 leading-snug px-0.5">
        Puedes elegir un cargo existente o escribir una descripción libre
      </p>

      {showDrop && (
        <div className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.length > 0 && (
            <>
              {!trimmed && userJTs.length > 0 && (
                <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50 border-b border-slate-100">
                  Cargos de esta persona
                </div>
              )}
              {filtered.map((jt) => (
                <button
                  key={jt.id}
                  type="button"
                  onMouseDown={() => { onChange(jt.name); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  {jt.name}
                </button>
              ))}
            </>
          )}
          {showCreate && (
            <>
              {/* Opción 1: usar como descripción libre (no crea cargo global) */}
              <button
                type="button"
                onMouseDown={() => setOpen(false)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 text-left transition-colors${filtered.length > 0 ? ' border-t border-slate-100' : ''}`}
              >
                <svg className="w-3 h-3 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Usar &ldquo;{trimmed}&rdquo; como descripción libre
              </button>
              {/* Opción 2: crear cargo global */}
              <button
                type="button"
                onMouseDown={() => { createJobTitle.mutate({ name: trimmed }); setOpen(false); }}
                disabled={createJobTitle.isPending}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-left border-t border-slate-100 transition-colors"
                style={{ color }}
              >
                {createJobTitle.isPending
                  ? <><div className="w-2.5 h-2.5 border border-current/30 border-t-current rounded-full animate-spin" />Creando...</>
                  : <><svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Crear cargo &ldquo;{trimmed}&rdquo;</>
                }
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── AreaDetailPanel ────────────────────────────────────────────────────────────

interface AreaDetailPanelProps {
  slug:    string;
  canEdit: boolean;
  onClose: () => void;
}

function AreaDetailPanel({ slug, canEdit, onClose }: AreaDetailPanelProps) {
  const { data, isLoading } = useOrgAreaTree(slug);
  const updateArea       = useUpdateOrgArea();
  const uploadAreaLogo   = useUploadAreaLogo();
  const createTeam       = useCreateOrgTeam();
  const deleteTeam       = useDeleteOrgTeam();
  const createMembership = useCreateOrgMembership();
  const updateMembership = useUpdateOrgMembership();
  const deleteMembership = useDeleteOrgMembership();
  const logoInputRef     = useRef<HTMLInputElement>(null);

  // ── Info del área ──
  const [name,         setName]         = useState('');
  const [desc,         setDesc]         = useState('');
  const [leaderDesc,   setLeaderDesc]   = useState('');
  const [color,        setColor]        = useState('');
  const [saveStatus,   setSaveStatus]   = useState<'idle' | 'saving' | 'saved'>('idle');
  const [logoPreview,  setLogoPreview]  = useState<string | null>(null);

  // ── Búsqueda de líderes ──
  const [leaderQuery,     setLeaderQuery]     = useState('');
  const [leaderResults,   setLeaderResults]   = useState<OrgUser[]>([]);
  const [searchingLeader, setSearchingLeader] = useState(false);

  // ── Estado diferido de líderes (no toca la BD hasta guardar) ──
  const [toAddLeaders,     setToAddLeaders]     = useState<{ user: OrgUser; title: string; tempId: number }[]>([]);
  const [toRemoveLeaders,  setToRemoveLeaders]  = useState<number[]>([]);
  const [leaderTitleEdits, setLeaderTitleEdits] = useState<Record<number, string>>({});

  // ── Creación de equipo ──
  const [showNewTeam,  setShowNewTeam]  = useState(false);
  const [newTeamName,  setNewTeamName]  = useState('');
  const [newTeamDesc,  setNewTeamDesc]  = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Sincronizar info del área cuando carga
  useEffect(() => {
    if (data) {
      setName(data.name);
      setDesc(data.desc ?? '');
      setLeaderDesc(data.leaderDesc ?? '');
      setColor(data.color);
    }
  }, [data?.name, data?.desc, data?.leaderDesc, data?.color]);

  // Limpiar estado diferido al cambiar de área
  useEffect(() => {
    setToAddLeaders([]);
    setToRemoveLeaders([]);
    setLeaderTitleEdits({});
  }, [data?.id]);

  // Búsqueda de usuarios para agregar como líderes
  useEffect(() => {
    if (leaderQuery.trim().length < 2) { setLeaderResults([]); return; }
    setSearchingLeader(true);
    const ctrl = new AbortController();
    api.get('/users', { params: { search: leaderQuery, limit: 8 }, signal: ctrl.signal })
      .then((r) => {
        const d = r.data;
        setLeaderResults(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []);
      })
      .catch(() => {})
      .finally(() => setSearchingLeader(false));
    return () => ctrl.abort();
  }, [leaderQuery]);

  // Agregar líder al estado local (sin tocar la BD)
  function handleAddLeaderPending(u: OrgUser) {
    const alreadyPending = toAddLeaders.some((a) => a.user.id === u.id);
    const alreadyLeader  = visibleLeaders.some((m) => m.userId === u.id);
    if (alreadyPending || alreadyLeader) return;
    setToAddLeaders((prev) => [...prev, { user: u, title: orgUserJobTitle(u) ?? '', tempId: -Date.now() }]);
    setLeaderQuery('');
    setLeaderResults([]);
  }

  // Marcar líder existente para quitar (local)
  function handleRemoveLeaderPending(membId: number) {
    setToRemoveLeaders((prev) => [...prev, membId]);
  }

  // Descartar una adición pendiente de líder
  function handleDiscardLeaderAdd(tempId: number) {
    setToAddLeaders((prev) => prev.filter((a) => a.tempId !== tempId));
  }

  const [areaToast,       setAreaToast]       = useState<{ msg: string; kind: 'success' | 'error' } | null>(null);
  const [confirmDelTeam,  setConfirmDelTeam]  = useState<number | null>(null);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw || !data) return;
    try {
      const file    = await resizeImage(raw);
      const preview = URL.createObjectURL(file);
      setLogoPreview(preview);
      uploadAreaLogo.mutate(
        { id: data.id, file },
        { onError: () => { setLogoPreview(null); setAreaToast({ msg: 'Error al subir la imagen. Intenta nuevamente.', kind: 'error' }); } },
      );
    } catch { setAreaToast({ msg: 'No se pudo procesar la imagen.', kind: 'error' }); }
  }

  function handleDeleteTeam(teamId: number) {
    setConfirmDelTeam(teamId);
  }

  function handleCreateTeam() {
    if (!data || !newTeamName.trim()) return;
    setCreatingTeam(true);
    createTeam.mutate(
      {
        areaId:    data.id,
        name:      newTeamName.trim(),
        desc:      newTeamDesc.trim() || undefined,
        sortOrder: data.teams.length,
      },
      {
        onSuccess: () => {
          setNewTeamName(''); setNewTeamDesc('');
          setShowNewTeam(false); setCreatingTeam(false);
        },
        onError: () => setCreatingTeam(false),
      },
    );
  }

  // Guardar todos los cambios del panel
  async function handleSave() {
    if (!data) return;
    setSaveStatus('saving');
    try {
      // 1. Info del área
      await updateArea.mutateAsync({ id: data.id, data: { name, desc, leaderDesc: leaderDesc.trim() || null, color } });

      // 2. Quitar líderes marcados
      await Promise.all(toRemoveLeaders.map((id) => deleteMembership.mutateAsync(id)));

      // 3. Agregar nuevos líderes con customTitle
      await Promise.all(
        toAddLeaders.map((a) =>
          createMembership.mutateAsync({
            userId: a.user.id, areaId: data.id, role: 'area_leader',
            customTitle: a.title.trim() || null,
          }),
        ),
      );

      // 4. Actualizar customTitle de líderes existentes
      await Promise.all(
        Object.entries(leaderTitleEdits)
          .filter(([id, title]) => {
            const original = data.leaders.find((m) => m.id === Number(id))?.customTitle ?? '';
            return title !== original;
          })
          .map(([id, title]) =>
            updateMembership.mutateAsync({ id: Number(id), data: { customTitle: title.trim() || null } }),
          ),
      );

      setSaveStatus('saved');
      setToAddLeaders([]); setToRemoveLeaders([]); setLeaderTitleEdits({});
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('idle');
    }
  }

  function handleCancel() {
    if (data) { setName(data.name); setDesc(data.desc ?? ''); setColor(data.color); }
    setToAddLeaders([]); setToRemoveLeaders([]); setLeaderTitleEdits({});
    setLeaderQuery(''); setLeaderResults([]);
  }

  const liveColor      = color || data?.color || '#64748b';
  const areaImage      = logoPreview ?? data?.iconUrl ?? null;
  const visibleLeaders = (data?.leaders ?? []).filter((m) => !toRemoveLeaders.includes(m.id));
  const totalLeaders   = visibleLeaders.length + toAddLeaders.length;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" style={{ left: '224px' }} onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 bg-white z-40 flex flex-col" style={{ width: '420px', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0" style={{ borderTop: `3px solid ${liveColor}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base overflow-hidden" style={{ background: `${liveColor}20` }}>
              {data?.iconUrl
                ? <img src={data.iconUrl} alt="" className="w-full h-full object-cover" />
                : (data?.icon ?? '📌')}
            </div>
            <span className="text-sm font-bold text-slate-900 truncate max-w-[260px]">{data?.name ?? 'Área'}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">

              {/* ── Logo del área ── */}
              {canEdit && (
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-2xl shadow-sm"
                      style={{ background: `${liveColor}22`, border: `1.5px solid ${liveColor}30` }}
                    >
                      {areaImage
                        ? <img src={areaImage} alt={data?.name} className="w-full h-full object-cover" />
                        : data?.icon
                      }
                    </div>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadAreaLogo.isPending}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-md transition-opacity hover:opacity-90"
                      style={{ background: liveColor }}
                      title="Cambiar logo del área"
                    >
                      {uploadAreaLogo.isPending
                        ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                        : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      }
                    </button>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{data?.name}</p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      {areaImage ? 'Click en la imagen para cambiarla' : 'Sin logo — click en el ícono para subir uno'}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Información del área ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Información del área</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">Nombre</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">Descripción</label>
                    <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Descripción del área…" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:border-blue-400 transition-colors" />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[10.5px] font-semibold text-slate-500">Color</label>
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white" />
                    <span className="text-[11px] font-mono text-slate-500">{color}</span>
                  </div>
                </div>
              </div>

              {/* ── Líderes ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Líderes del área ({totalLeaders})
                </p>
                <div className="flex flex-col gap-2 mb-3">

                  {/* Líderes existentes */}
                  {visibleLeaders.map((m) => (
                    <div key={m.id} className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar user={m.user} color={liveColor} size={28} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{fullName(m.user)}</p>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => handleRemoveLeaderPending(m.id)}
                            className="text-xs text-slate-300 hover:text-red-500 transition-colors px-1 flex-shrink-0"
                            title="Quitar líder"
                          >×</button>
                        )}
                      </div>
                      {canEdit && (
                        <FunctionPicker
                          user={m.user}
                          value={leaderTitleEdits[m.id] !== undefined ? leaderTitleEdits[m.id] : (m.customTitle ?? '')}
                          onChange={(v) => setLeaderTitleEdits((prev) => ({ ...prev, [m.id]: v }))}
                          color={liveColor}
                          placeholder={`Función (ej: ${orgUserJobTitle(m.user) ?? 'Pastor, Director…'})`}
                        />
                      )}
                      {!canEdit && (
                        <p className="text-[10px] text-slate-400 truncate">
                          {m.customTitle ?? orgUserJobTitle(m.user) ?? 'Líder de Área'}
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Adiciones pendientes de líder */}
                  {toAddLeaders.map((a) => (
                    <div key={a.tempId} className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border border-dashed bg-white" style={{ borderColor: `${liveColor}50` }}>
                      <div className="flex items-center gap-2.5">
                        <UserAvatar user={a.user} color={liveColor} size={28} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{fullName(a.user)}</p>
                          <p className="text-[10px] font-medium" style={{ color: liveColor }}>Por agregar como líder</p>
                        </div>
                        <button
                          onClick={() => handleDiscardLeaderAdd(a.tempId)}
                          className="text-xs text-slate-300 hover:text-red-500 transition-colors px-1 flex-shrink-0"
                          title="Descartar"
                        >×</button>
                      </div>
                      <FunctionPicker
                        user={a.user}
                        value={a.title}
                        onChange={(v) => setToAddLeaders((prev) => prev.map((x) => x.tempId === a.tempId ? { ...x, title: v } : x))}
                        color={liveColor}
                        placeholder="Función como líder…"
                      />
                    </div>
                  ))}

                  {totalLeaders === 0 && (
                    <p className="text-xs text-slate-400 italic py-1">Sin líderes asignados</p>
                  )}
                </div>

                {canEdit && (
                  <div>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        value={leaderQuery}
                        onChange={(e) => setLeaderQuery(e.target.value)}
                        placeholder="Agregar líder — buscar por nombre…"
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors"
                      />
                    </div>
                    {(leaderResults.length > 0 || searchingLeader) && (
                      <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden">
                        {searchingLeader && <div className="flex justify-center py-3"><div className="w-4 h-4 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin" /></div>}
                        {leaderResults.map((u) => {
                          const alreadyIn = visibleLeaders.some((m) => m.userId === u.id) || toAddLeaders.some((a) => a.user.id === u.id);
                          return (
                            <div key={u.id} className="flex items-center gap-2.5 px-3 py-2 border-b border-slate-100 last:border-0">
                              <UserAvatar user={u} color={liveColor} size={26} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-900 truncate">{fullName(u)}</p>
                                <p className="text-[10px] text-slate-400 truncate">{orgUserJobTitle(u) ?? u.email}</p>
                              </div>
                              {alreadyIn ? (
                                <span className="text-[10px] text-slate-400 italic flex-shrink-0">Ya está</span>
                              ) : (
                                <button
                                  onClick={() => handleAddLeaderPending(u)}
                                  className="text-[10px] px-2 py-1 rounded-lg border font-semibold transition-colors hover:text-white flex-shrink-0"
                                  style={{ borderColor: liveColor, color: liveColor }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = liveColor)}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                  +
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Descripción del rol del líder ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Descripción del rol del líder
                </p>
                {canEdit ? (
                  <textarea
                    value={leaderDesc}
                    onChange={(e) => setLeaderDesc(e.target.value)}
                    rows={2}
                    placeholder="Ej: Responsable de supervisar y guiar a todos los equipos del área..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[12px] focus:outline-none focus:border-blue-300 transition-colors resize-none text-slate-700 placeholder:text-slate-300"
                  />
                ) : (
                  leaderDesc ? (
                    <p className="text-[12px] text-slate-500 leading-relaxed italic">{leaderDesc}</p>
                  ) : (
                    <p className="text-[11px] text-slate-300 italic">Sin descripción del rol</p>
                  )
                )}
              </div>

              {/* ── Equipos ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Equipos ({data?.teams.length ?? 0})
                </p>
                <div className="flex flex-col gap-1.5 mb-3">
                  {data?.teams.map((t) => (
                    <div key={t.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{t.name}</p>
                        <p className="text-[10px] text-slate-400">{t.memberships.length} miembro{t.memberships.length !== 1 ? 's' : ''}</p>
                      </div>
                      {canEdit && (
                        <button onClick={() => handleDeleteTeam(t.id)} className="text-xs text-slate-300 hover:text-red-500 transition-colors px-1 flex-shrink-0" title="Eliminar equipo">×</button>
                      )}
                    </div>
                  ))}
                  {(data?.teams.length ?? 0) === 0 && (
                    <p className="text-xs text-slate-400 italic py-1">Sin equipos</p>
                  )}
                </div>

                {canEdit && (
                  !showNewTeam ? (
                    <button
                      onClick={() => setShowNewTeam(true)}
                      className="w-full py-2 rounded-xl border-2 border-dashed border-slate-200 text-xs font-semibold text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-all flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Crear nuevo equipo
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nuevo equipo</p>
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">Nombre *</label>
                        <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Ej: Diseño Gráfico" className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:outline-none focus:border-blue-400 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-500 mb-1">Descripción</label>
                        <textarea value={newTeamDesc} onChange={(e) => setNewTeamDesc(e.target.value)} rows={2} placeholder="Descripción opcional…" className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm resize-none focus:outline-none focus:border-blue-400 transition-colors" />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateTeam}
                          disabled={!newTeamName.trim() || creatingTeam}
                          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                          style={{ background: liveColor }}
                        >
                          {creatingTeam
                            ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Creando...</>
                            : 'Crear equipo'
                          }
                        </button>
                        <button onClick={() => { setShowNewTeam(false); setNewTeamName(''); setNewTeamDesc(''); }} className="px-4 py-2 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button>
                      </div>
                    </div>
                  )
                )}
              </div>

            </div>

            {/* ── Footer: Guardar cambios ── */}
            {canEdit && (
              <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 flex flex-col gap-2">
                <button
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: liveColor }}
                >
                  {saveStatus === 'saving'
                    ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
                    : saveStatus === 'saved'
                    ? <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Guardado</>
                    : 'Guardar cambios'
                  }
                </button>
                {(toAddLeaders.length > 0 || toRemoveLeaders.length > 0 || Object.keys(leaderTitleEdits).length > 0) && saveStatus === 'idle' && (
                  <button
                    onClick={handleCancel}
                    className="w-full py-2 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar cambios
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {areaToast && <OrgToast msg={areaToast.msg} kind={areaToast.kind} onDismiss={() => setAreaToast(null)} />}

      {confirmDelTeam !== null && (
        <ConfirmModal
          title="¿Eliminar equipo?"
          message="El equipo quedará desactivado. Esta acción se puede revertir contactando al administrador."
          confirmLabel="Eliminar"
          danger
          onConfirm={() => { deleteTeam.mutate(confirmDelTeam); setConfirmDelTeam(null); }}
          onCancel={() => setConfirmDelTeam(null)}
        />
      )}
    </>
  );
}

// ── TreeView ───────────────────────────────────────────────────────────────────

interface TreeViewProps {
  data:         OrgAreaTree;
  color:        string;
  canEdit:      boolean;
  forceOpen:    boolean | null;
  onSelectUser: (m: OrgMembership) => void;
  onSelectTeam: (t: OrgTeam) => void;
}

function TreeView({ data, color, canEdit, forceOpen, onSelectUser, onSelectTeam }: TreeViewProps) {
  const updateTeam = useUpdateOrgTeam();

  const [localTeams, setLocalTeams] = useState<OrgTeam[]>(data.teams);
  useEffect(() => { setLocalTeams(data.teams); }, [data.teams]);

  const maxCol = Math.max(1, ...localTeams.map((t) => t.colPosition ?? 1));
  const byCol: Record<number, OrgTeam[]> = {};
  for (let c = 1; c <= maxCol; c++) byCol[c] = [];
  localTeams.forEach((t) => { byCol[t.colPosition ?? 1].push(t); });
  // sort each column by sortOrder
  Object.values(byCol).forEach((arr) => arr.sort((a, b) => a.sortOrder - b.sortOrder));

  function swapInCol(teamId: number, dir: 'up' | 'down') {
    const col = localTeams.find((t) => t.id === teamId)?.colPosition ?? 1;
    const colArr = [...byCol[col]];
    const idx = colArr.findIndex((t) => t.id === teamId);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= colArr.length) return;

    [colArr[idx], colArr[swapIdx]] = [colArr[swapIdx], colArr[idx]];

    const updated = localTeams.map((t) => {
      const ni = colArr.findIndex((c) => c.id === t.id);
      return ni !== -1 ? { ...t, sortOrder: ni } : t;
    });
    setLocalTeams(updated);
    updateTeam.mutate({ id: colArr[idx].id,     data: { sortOrder: idx } });
    updateTeam.mutate({ id: colArr[swapIdx].id, data: { sortOrder: swapIdx } });
  }

  function changeCol(teamId: number, delta: number) {
    const team = localTeams.find((t) => t.id === teamId);
    if (!team) return;
    const newCol = (team.colPosition ?? 1) + delta;
    if (newCol < 1 || newCol > maxCol + 1) return;

    // Put at end of target column
    const targetColTeams = localTeams.filter((t) => t.id !== teamId && (t.colPosition ?? 1) === newCol);
    const newSortOrder = targetColTeams.length;

    const updated = localTeams.map((t) =>
      t.id === teamId ? { ...t, colPosition: newCol, sortOrder: newSortOrder } : t,
    );
    setLocalTeams(updated);
    updateTeam.mutate({ id: teamId, data: { colPosition: newCol, sortOrder: newSortOrder } });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Líderes del área + descripción del rol */}
      {data.leaders.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap gap-3 justify-center">
            {data.leaders.map((m) => (
              <AreaLeaderCard key={m.id} membership={m} color={color} onSelect={onSelectUser} />
            ))}
          </div>
          {data.leaderDesc && (
            <p className="text-[11.5px] text-slate-500 italic text-center max-w-lg leading-relaxed px-2">
              {data.leaderDesc}
            </p>
          )}
        </div>
      )}

      {/* Grid de columnas */}
      <div className={`flex flex-col ${maxCol > 1 ? 'lg:flex-row' : ''} gap-3 items-start`}>
        {Array.from({ length: maxCol }, (_, i) => i + 1).map((col) => (
          <div key={col} className="flex flex-col gap-3 flex-1 min-w-0">
            {byCol[col].map((team, idx) => {
              const editControls = canEdit ? (
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Mover arriba/abajo dentro de la columna */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); swapInCol(team.id, 'up'); }}
                      disabled={idx === 0}
                      className="w-6 h-5 flex items-center justify-center rounded-md bg-white/15 text-white hover:bg-amber-400 hover:text-slate-900 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                      title="Subir"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); swapInCol(team.id, 'down'); }}
                      disabled={idx === byCol[col].length - 1}
                      className="w-6 h-5 flex items-center justify-center rounded-md bg-white/15 text-white hover:bg-amber-400 hover:text-slate-900 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                      title="Bajar"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>
                  {/* Mover entre columnas */}
                  <div className="flex items-center gap-0.5 bg-white/10 rounded-md px-1 py-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); changeCol(team.id, -1); }}
                      disabled={col <= 1}
                      className="w-4 h-5 flex items-center justify-center text-white/60 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Mover a columna anterior"
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <span className="text-[9px] font-bold text-white/50 w-5 text-center">C{col}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); changeCol(team.id, 1); }}
                      disabled={col >= maxCol && byCol[col].length <= 1}
                      className="w-4 h-5 flex items-center justify-center text-white/60 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Mover a columna siguiente"
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                </div>
              ) : null;

              return (
                <TeamCard
                  key={team.id}
                  team={team}
                  color={color}
                  canEdit={canEdit}
                  forceOpen={forceOpen}
                  dragHandle={editControls}
                  onSelect={onSelectUser}
                  onSelectTeam={onSelectTeam}
                />
              );
            })}
          </div>
        ))}
      </div>

      {localTeams.length === 0 && (
        <p className="text-slate-400 text-sm p-4">Sin equipos en esta área</p>
      )}
    </div>
  );
}

// ── UserDetailPanel ────────────────────────────────────────────────────────────

interface UserDetailPanelProps {
  membership: OrgMembership;
  color:      string;
  canEdit:    boolean;
  onClose:    () => void;
}

function MembershipRow({ m }: { m: OrgMembershipFull }) {
  const area   = membershipArea(m);
  const aColor = area?.color ?? '#64748b';
  return (
    <div className="flex items-start gap-3 px-3.5 py-3 rounded-xl border" style={{ borderColor: '#f1f5f9', background: '#f8fafc' }}>
      <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-base overflow-hidden" style={{ background: `${aColor}20` }}>
        {area?.iconUrl
          ? <img src={area.iconUrl} alt={area.name} className="w-full h-full object-cover" />
          : (area?.icon ?? '📌')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: aColor }}>
          {area?.name ?? '—'}
        </p>
        {m.team && (
          <p className="text-[12px] font-semibold text-slate-700 truncate mt-0.5">{m.team.name}</p>
        )}
        {m.customTitle ? (
          <p className="text-[11px] font-semibold mt-0.5 truncate" style={{ color: aColor }}>{m.customTitle}</p>
        ) : (
          <p className="text-[11px] text-slate-400 mt-0.5">{ROLE_LABEL[m.role]}</p>
        )}
      </div>
    </div>
  );
}

function UserDetailPanel({ membership, color, canEdit, onClose }: UserDetailPanelProps) {
  const { user } = membership;

  // Edición customTitle membresía
  const [localTitle,   setLocalTitle]   = useState(membership.customTitle ?? '');
  const [saveStatus,   setSaveStatus]   = useState<'idle' | 'saving' | 'saved'>('idle');
  const updateMembership = useUpdateOrgMembership();

  // Edición datos de persona
  const [editingInfo,  setEditingInfo]  = useState(false);
  const [localFirst,   setLocalFirst]   = useState(user.firstName ?? '');
  const [localLast,    setLocalLast]    = useState(user.lastName ?? '');
  const [localEmail,   setLocalEmail]   = useState(user.email ?? '');
  const [localPhone,   setLocalPhone]   = useState(user.phone ?? '');
  const [localCountry, setLocalCountry] = useState(user.country ?? '');
  const [localCampusId,setLocalCampusId]= useState<number | null>(user.campus?.id ?? null);
  const [infoErr,      setInfoErr]      = useState('');
  const updateUser = useUpdateUser();
  const { data: campuses } = useActiveCampuses();

  const { data: profile, isLoading: profileLoading } = useOrgUserProfile(user.id);
  const allMemberships: OrgMembershipFull[] = profile?.orgMemberships ?? [];
  const currentFull      = allMemberships.find((m) => m.id === membership.id);
  const otherMemberships = allMemberships.filter((m) => m.id !== membership.id);
  const currentArea      = currentFull ? membershipArea(currentFull) : null;
  const currentTeamName  = currentFull?.team?.name ?? null;

  async function handleSave() {
    setInfoErr('');
    if (editingInfo) {
      if (!localFirst.trim()) { setInfoErr('El nombre es obligatorio.'); return; }
      if (!localEmail.trim()) { setInfoErr('El correo es obligatorio.'); return; }
    }
    setSaveStatus('saving');
    try {
      await updateMembership.mutateAsync({ id: membership.id, data: { customTitle: localTitle.trim() || null } });
      if (editingInfo) {
        await updateUser.mutateAsync({ id: user.id, data: {
          firstName: localFirst.trim(),
          lastName:  localLast.trim() || undefined,
          email:     localEmail.trim(),
          phone:     localPhone.trim()   || undefined,
          country:   localCountry.trim() || undefined,
          campusId:  localCampusId,
        }});
      }
      setSaveStatus('saved');
      setEditingInfo(false);
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setInfoErr(msg ?? 'Error al guardar. Inténtalo de nuevo.');
      setSaveStatus('idle');
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" style={{ left: '224px' }} onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 bg-white z-40 flex flex-col" style={{ width: '400px', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0" style={{ borderTop: `3px solid ${color}` }}>
          <span className="text-sm font-bold text-slate-900 truncate max-w-[300px]">{fullName(user)}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Avatar + nombre */}
          <div className="flex items-center gap-4">
            <UserAvatar user={user} color={color} size={56} />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-slate-900 leading-snug">{fullName(user)}</div>
            </div>
          </div>

          {/* Info de contacto — read-only o editable */}
          <div className="rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
            {/* Header con toggle edición */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-slate-50">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Datos personales</p>
              {canEdit && (
                <button
                  onClick={() => { setEditingInfo((v) => !v); setInfoErr(''); }}
                  className="text-[10px] font-semibold transition-colors"
                  style={{ color: editingInfo ? '#94a3b8' : color }}
                >
                  {editingInfo ? 'Cancelar' : 'Editar'}
                </button>
              )}
            </div>

            {editingInfo ? (
              /* Modo edición */
              <div className="flex flex-col gap-3 p-3.5">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Nombre</label>
                    <input value={localFirst} onChange={(e) => setLocalFirst(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Apellido</label>
                    <input value={localLast} onChange={(e) => setLocalLast(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Correo</label>
                  <input type="email" value={localEmail} onChange={(e) => setLocalEmail(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Teléfono</label>
                  <input value={localPhone} onChange={(e) => setLocalPhone(e.target.value)} placeholder="+56 9 …" className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">País</label>
                    <CountryPicker value={localCountry} onChange={setLocalCountry} compact placeholder="Chile…" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Campus</label>
                    <select value={localCampusId ?? ''} onChange={(e) => setLocalCampusId(e.target.value ? Number(e.target.value) : null)} className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors">
                      <option value="">— Sin campus —</option>
                      {campuses?.map((c: CampusOption) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                {infoErr && <p className="text-[11px] text-red-500 font-medium">{infoErr}</p>}
              </div>
            ) : (
              /* Modo lectura */
              <div className="flex flex-col divide-y divide-slate-100">
                <a href={`mailto:${user.email}`} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors group">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  <span className="text-[12px] text-slate-600 truncate group-hover:text-blue-600">{user.email}</span>
                </a>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  {user.phone
                    ? <a href={`tel:${user.phone}`} className="text-[12px] text-slate-600 hover:text-blue-600 transition-colors">{user.phone}</a>
                    : <span className="text-[12px] text-slate-300 italic">Sin teléfono</span>}
                </div>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  {user.country
                    ? <span className="text-[12px] text-slate-600">{user.country}</span>
                    : <span className="text-[12px] text-slate-300 italic">Sin país</span>}
                </div>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  {user.campus
                    ? <span className="text-[12px] text-slate-600">{user.campus.name}</span>
                    : <span className="text-[12px] text-slate-300 italic">Sin campus</span>}
                </div>
              </div>
            )}
          </div>

          {/* ── Participación actual — editable ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">
              En este organigrama
            </p>
            <div className="flex flex-col gap-2 p-3.5 rounded-xl border-2" style={{ borderColor: `${color}40`, background: `${color}06` }}>
              {/* Área */}
              {profileLoading
                ? <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                : currentArea && (
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
                      {currentArea.name}
                    </p>
                  )
              }
              {/* Equipo */}
              {currentTeamName && (
                <p className="text-[13px] font-semibold text-slate-800">{currentTeamName}</p>
              )}
              {/* Cargo / Descripción — editable con FunctionPicker si tiene permiso */}
              {canEdit ? (
                <FunctionPicker
                  user={user}
                  value={localTitle}
                  onChange={setLocalTitle}
                  color={color}
                  placeholder="Cargo o función en este organigrama…"
                />
              ) : (
                <p className="text-[11.5px] text-slate-500">
                  {membership.customTitle || orgUserJobTitle(user) || '—'}
                </p>
              )}
            </div>
          </div>

          {/* ── Otras participaciones — solo informativas ── */}
          {(otherMemberships.length > 0 || (profileLoading && allMemberships.length === 0)) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">
                También participa en
              </p>
              {profileLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {otherMemberships.map((m) => (
                    <MembershipRow key={m.id} m={m} />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer: Guardar cambios */}
        {canEdit && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: color }}
            >
              {saveStatus === 'saving'
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
                : saveStatus === 'saved'
                ? <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Guardado</>
                : 'Guardar cambios'
              }
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── TeamDetailPanel ────────────────────────────────────────────────────────────

interface TeamDetailPanelProps {
  team:    OrgTeam;
  color:   string;
  canEdit: boolean;
  onClose: () => void;
}

function TeamDetailPanel({ team, color, canEdit, onClose }: TeamDetailPanelProps) {
  const [editingTeam, setEditingTeam] = useState(false);
  const [name,        setName]        = useState(team.name);
  const [desc,        setDesc]        = useState(team.desc ?? '');
  const [saveStatus,  setSaveStatus]  = useState<'idle' | 'saving' | 'saved'>('idle');

  // Estado local de miembros — no toca la BD ni el organigrama hasta guardar
  const [localMembers, setLocalMembers] = useState<OrgMembership[]>(team.memberships);
  const [toRemove,     setToRemove]     = useState<number[]>([]);
  const [toAdd,        setToAdd]        = useState<{ user: OrgUser; tempId: number; title: string }[]>([]);
  const [titleEdits,   setTitleEdits]   = useState<Record<number, string>>({});

  const [addQuery,   setAddQuery]   = useState('');
  const [addResults, setAddResults] = useState<OrgUser[]>([]);
  const [searching,  setSearching]  = useState(false);

  // Formulario crear nueva persona
  const [creatingUser, setCreatingUser] = useState(false);
  const [newFirst,     setNewFirst]     = useState('');
  const [newLast,      setNewLast]      = useState('');
  const [newEmail,     setNewEmail]     = useState('');
  const [newTitle,     setNewTitle]     = useState('');
  const [newCampusId,  setNewCampusId]  = useState<number | null>(null);
  const [newBirthDate, setNewBirthDate] = useState('');
  const [newPhone,     setNewPhone]     = useState('');
  const [newCountry,   setNewCountry]   = useState('');
  const [newUserErr,   setNewUserErr]   = useState('');
  const [teamToast,    setTeamToast]    = useState<{ msg: string; kind: 'success' | 'error' } | null>(null);

  const updateTeam       = useUpdateOrgTeam();
  const createMembership = useCreateOrgMembership();
  const updateMembership = useUpdateOrgMembership();
  const deleteMembership = useDeleteOrgMembership();
  const createUser       = useCreateUser();
  const { data: roles }   = useRoles();
  const { data: campuses } = useActiveCampuses();

  const isEditing = canEdit && editingTeam;

  // Lista visible: miembros originales menos los marcados para quitar
  const visibleMembers = localMembers.filter((m) => !toRemove.includes(m.id));
  const totalVisible   = visibleMembers.length + toAdd.length;

  // Búsqueda de usuarios
  useEffect(() => {
    if (addQuery.trim().length < 2) { setAddResults([]); return; }
    setSearching(true);
    const ctrl = new AbortController();
    api.get('/users', { params: { search: addQuery, limit: 8 }, signal: ctrl.signal })
      .then((r) => {
        const d = r.data;
        setAddResults(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []);
      })
      .catch(() => {})
      .finally(() => setSearching(false));
    return () => ctrl.abort();
  }, [addQuery]);

  // Agregar persona al estado local (sin tocar la BD)
  function handleAddMember(user: OrgUser, customTitle?: string) {
    const alreadyPending = toAdd.some((a) => a.user.id === user.id);
    const alreadyMember  = visibleMembers.some((m) => m.userId === user.id);
    if (alreadyPending || alreadyMember) return;
    setToAdd((prev) => [...prev, { user, tempId: -Date.now(), title: customTitle ?? orgUserJobTitle(user) ?? '' }]);
    setAddQuery('');
    setAddResults([]);
  }

  function resetNewUserForm() {
    setCreatingUser(false);
    setNewFirst(''); setNewLast(''); setNewEmail('');
    setNewTitle(''); setNewCampusId(null); setNewBirthDate('');
    setNewPhone(''); setNewCountry(''); setNewUserErr('');
  }

  async function handleCreateAndAdd() {
    setNewUserErr('');
    if (!newFirst.trim()) { setNewUserErr('El nombre es obligatorio.'); return; }
    if (!newLast.trim())  { setNewUserErr('El apellido es obligatorio.'); return; }
    if (!newEmail.trim()) { setNewUserErr('El correo es obligatorio.'); return; }

    const userRole = roles?.find((r) => r.name.toLowerCase() === 'user' || r.name.toLowerCase() === 'usuario');
    if (!userRole)  { setNewUserErr('No se pudo determinar el rol. Intenta de nuevo.'); return; }

    try {
      const created = await createUser.mutateAsync({
        firstName:  newFirst.trim(),
        lastName:   newLast.trim(),
        email:      newEmail.trim(),
        roleId:     userRole.id,
        campusId:   newCampusId ?? undefined,
        phone:      newPhone.trim()     || undefined,
        country:    newCountry.trim()   || undefined,
        birthDate:  newBirthDate        || undefined,
      });
      handleAddMember(created as OrgUser, newTitle.trim() || undefined);
      resetNewUserForm();
      setTeamToast({ msg: `${newFirst} ${newLast} creado y agregado al equipo.`, kind: 'success' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setNewUserErr(msg ?? 'No se pudo crear la persona. Verifica el correo.');
    }
  }

  // Marcar miembro existente para quitar (local)
  function handleRemoveExisting(id: number) {
    setToRemove((prev) => [...prev, id]);
  }

  // Descartar una adición pendiente
  function handleRemovePending(tempId: number) {
    setToAdd((prev) => prev.filter((a) => a.tempId !== tempId));
  }

  // Guardar: aplica todos los cambios a la BD y refresca el organigrama
  async function handleSave() {
    setSaveStatus('saving');
    try {
      // 1. Nombre / descripción del equipo
      await updateTeam.mutateAsync({ id: team.id, data: { name, desc } });

      // 2. Eliminar miembros marcados
      await Promise.all(toRemove.map((id) => deleteMembership.mutateAsync(id)));

      // 3. Agregar nuevos miembros
      await Promise.all(
        toAdd.map((a) => createMembership.mutateAsync({ userId: a.user.id, teamId: team.id, role: 'member', customTitle: a.title.trim() || null })),
      );

      // 4. Guardar ediciones de customTitle
      await Promise.all(
        Object.entries(titleEdits)
          .filter(([id, title]) => {
            const original = localMembers.find((m) => m.id === Number(id))?.customTitle ?? '';
            return title !== original;
          })
          .map(([id, title]) =>
            updateMembership.mutateAsync({ id: Number(id), data: { customTitle: title.trim() || null } }),
          ),
      );

      setSaveStatus('saved');
      setEditingTeam(false);
      setToRemove([]);
      setToAdd([]);
      setTitleEdits({});
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('idle');
    }
  }

  // Cancelar: descarta todos los cambios locales
  function handleCancel() {
    setEditingTeam(false);
    setLocalMembers(team.memberships);
    setToRemove([]);
    setToAdd([]);
    setTitleEdits({});
    setName(team.name);
    setDesc(team.desc ?? '');
    setAddQuery('');
    setAddResults([]);
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" style={{ left: '224px' }} onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 bg-white z-40 flex flex-col" style={{ width: '380px', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0" style={{ borderTop: `3px solid ${color}` }}>
          <span className="text-sm font-bold text-slate-900 truncate max-w-[240px]">{isEditing ? name : team.name}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Descripción — solo lectura */}
          {!isEditing && team.desc && (
            <p className="text-sm text-slate-500 leading-relaxed">{team.desc}</p>
          )}

          {/* Edición nombre / descripción */}
          {isEditing && (
            <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Nombre del equipo</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm focus:outline-none focus:border-slate-400 transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Descripción</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm resize-none focus:outline-none focus:border-slate-400 transition-colors" />
              </div>
            </div>
          )}

          {/* Lista de miembros */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Miembros ({totalVisible})
            </p>
            <div className="flex flex-col gap-1.5">

              {/* Miembros existentes (excl. los marcados para quitar) */}
              {visibleMembers.map((m) => (
                <div key={m.id} className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar user={m.user} color={color} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{fullName(m.user)}</p>
                      <p className="text-[10px] text-slate-400">
                        {(titleEdits[m.id] !== undefined ? titleEdits[m.id] : m.customTitle)
                          ? <span className="font-medium" style={{ color }}>{titleEdits[m.id] !== undefined ? titleEdits[m.id] : m.customTitle}</span>
                          : ROLE_LABEL[m.role]
                        }
                      </p>
                    </div>
                    {isEditing && (
                      <button onClick={() => handleRemoveExisting(m.id)} className="text-xs text-slate-300 hover:text-red-500 transition-colors px-1 flex-shrink-0" title="Quitar">×</button>
                    )}
                  </div>
                  {isEditing && (
                    <FunctionPicker
                      user={m.user}
                      value={titleEdits[m.id] !== undefined ? titleEdits[m.id] : (m.customTitle ?? '')}
                      onChange={(v) => setTitleEdits((prev) => ({ ...prev, [m.id]: v }))}
                      color={color}
                      placeholder={`Función (ej: ${orgUserJobTitle(m.user) ?? 'Guitarrista, Campus Santiago…'})`}
                    />
                  )}
                </div>
              ))}

              {/* Adiciones pendientes */}
              {toAdd.map((a) => (
                <div key={a.tempId} className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border border-dashed bg-white" style={{ borderColor: `${color}50` }}>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar user={a.user} color={color} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{fullName(a.user)}</p>
                      <p className="text-[10px] font-medium" style={{ color }}>Por agregar</p>
                    </div>
                    <button onClick={() => handleRemovePending(a.tempId)} className="text-xs text-slate-300 hover:text-red-500 transition-colors px-1 flex-shrink-0" title="Descartar">×</button>
                  </div>
                  <FunctionPicker
                    user={a.user}
                    value={a.title}
                    onChange={(v) => setToAdd((prev) => prev.map((x) => x.tempId === a.tempId ? { ...x, title: v } : x))}
                    color={color}
                    placeholder="Función en este equipo…"
                  />
                </div>
              ))}

              {totalVisible === 0 && (
                <p className="text-xs text-slate-400 italic py-2">Sin miembros</p>
              )}
            </div>
          </div>

          {/* Buscador + crear persona — solo en edición */}
          {isEditing && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Agregar persona</p>

              {!creatingUser && (
                <>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      value={addQuery}
                      onChange={(e) => setAddQuery(e.target.value)}
                      placeholder="Buscar por nombre…"
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors"
                    />
                  </div>

                  {(addResults.length > 0 || searching) && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      {searching && <div className="flex justify-center py-3"><div className="w-4 h-4 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin" /></div>}
                      {addResults.map((u) => {
                        const alreadyIn = visibleMembers.some((m) => m.userId === u.id) || toAdd.some((a) => a.user.id === u.id);
                        return (
                          <div key={u.id} className="flex items-center gap-2.5 px-3 py-2 border-b border-slate-100 last:border-0">
                            <UserAvatar user={u} color={color} size={28} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate">{fullName(u)}</p>
                              <p className="text-[10px] text-slate-400 truncate">{orgUserJobTitle(u) ?? u.email}</p>
                            </div>
                            {alreadyIn ? (
                              <span className="text-[10px] text-slate-400 italic flex-shrink-0">Ya está</span>
                            ) : (
                              <button
                                onClick={() => handleAddMember(u)}
                                className="w-6 h-6 rounded-full border font-bold text-sm flex items-center justify-center transition-colors hover:text-white flex-shrink-0"
                                style={{ borderColor: color, color }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = color)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                +
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Mostrar opción de crear si buscó y no hay resultados */}
                  {addQuery.trim().length >= 2 && !searching && addResults.length === 0 && (
                    <p className="text-[11px] text-slate-400 text-center py-1">
                      No se encontró &ldquo;{addQuery}&rdquo;
                    </p>
                  )}

                  <button
                    onClick={() => { setCreatingUser(true); setAddQuery(''); setAddResults([]); }}
                    className="flex items-center justify-center gap-1.5 text-[11px] font-semibold py-2 px-3 rounded-xl border border-dashed transition-colors hover:bg-slate-50"
                    style={{ borderColor: `${color}60`, color }}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Crear nueva persona
                  </button>
                </>
              )}

              {/* Formulario crear persona */}
              {creatingUser && (
                <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-dashed" style={{ borderColor: `${color}50`, background: `${color}05` }}>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color }}>Nueva persona</p>
                    <button onClick={resetNewUserForm} className="text-slate-400 hover:text-slate-600 text-xs">✕ Cancelar</button>
                  </div>

                  {/* Obligatorios */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Nombre *</label>
                      <input value={newFirst} onChange={(e) => setNewFirst(e.target.value)} placeholder="Nombre" className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Apellido *</label>
                      <input value={newLast} onChange={(e) => setNewLast(e.target.value)} placeholder="Apellido" className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Correo *</label>
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="correo@ejemplo.com" className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Cargo en el organigrama *</label>
                    <FunctionPicker
                      user={{ id: 0, firstName: newFirst || 'Nueva', lastName: newLast || 'Persona', email: newEmail, jobTitles: [], phone: null, country: null, bio: null, campus: null, avatarUrl: null, status: 'active' }}
                      value={newTitle}
                      onChange={setNewTitle}
                      color={color}
                      placeholder="Cargo o función en este equipo…"
                    />
                  </div>

                  {/* Separador opcionales */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Opcionales</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Campus</label>
                    <select value={newCampusId ?? ''} onChange={(e) => setNewCampusId(e.target.value ? Number(e.target.value) : null)} className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors">
                      <option value="">— Sin campus —</option>
                      {campuses?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Teléfono</label>
                      <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+56 9 …" className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">País</label>
                      <CountryPicker value={newCountry} onChange={setNewCountry} compact placeholder="Chile…" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Fecha de nacimiento</label>
                    <input type="date" value={newBirthDate} onChange={(e) => setNewBirthDate(e.target.value)} className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-[12px] focus:outline-none focus:border-blue-300 transition-colors" />
                  </div>

                  {newUserErr && (
                    <p className="text-[11px] text-red-500 font-medium px-0.5">{newUserErr}</p>
                  )}

                  <button
                    onClick={handleCreateAndAdd}
                    disabled={createUser.isPending}
                    className="w-full py-2 rounded-xl text-[12px] font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: color }}
                  >
                    {createUser.isPending
                      ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Creando...</>
                      : 'Crear y agregar al equipo'
                    }
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 flex flex-col gap-2.5">
            {!editingTeam ? (
              <button
                onClick={() => setEditingTeam(true)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar equipo
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: color }}
                >
                  {saveStatus === 'saving'
                    ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
                    : <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Guardar cambios</>
                  }
                </button>
                <button onClick={handleCancel} className="w-full py-2 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {teamToast && <OrgToast msg={teamToast.msg} kind={teamToast.kind} onDismiss={() => setTeamToast(null)} />}
    </>
  );
}

// ── SearchUserDetailPanel ──────────────────────────────────────────────────────

function SearchUserDetailPanel({ user, areas, onClose }: { user: OrgSearchUser; areas: OrgArea[]; onClose: () => void }) {
  function getArea(areaId?: number | null) {
    return areas.find((a) => a.id === areaId);
  }
  const primaryColor = getArea(user.orgMemberships[0]?.area?.id)?.color ?? '#64748b';

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" style={{ left: '224px' }} onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 bg-white z-40 flex flex-col" style={{ width: '400px', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0" style={{ borderTop: `3px solid ${primaryColor}` }}>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Perfil del colaborador</span>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Avatar + nombre + cargos */}
          <div className="flex items-center gap-4">
            <UserAvatar user={user} color={primaryColor} size={60} />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-slate-900 leading-snug">{fullName(user)}</div>
              {user.jobTitles.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {user.jobTitles.map((jt, i) => (
                    <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: primaryColor }}>
                      {jt.jobTitle.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-slate-400 italic mt-1">Sin cargo asignado</p>
              )}
            </div>
          </div>

          {/* Áreas y equipos */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Pertenece a</p>
            <div className="flex flex-col gap-2">
              {user.orgMemberships.map((m) => {
                const area = membershipArea(m);
                const aColor = area?.color ?? '#64748b';
                return (
                  <div key={m.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-100 bg-slate-50">
                    {area && (
                      <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-base overflow-hidden" style={{ background: `${aColor}20` }}>
                        {area.iconUrl
                          ? <img src={area.iconUrl} alt={area.name} className="w-full h-full object-cover" />
                          : area.icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {area && (
                        <p className="text-[11px] font-bold uppercase tracking-wide truncate" style={{ color: aColor }}>{area.name}</p>
                      )}
                      {m.team && (
                        <p className="text-[12px] font-semibold text-slate-700 truncate">{m.team.name}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: aColor }}>
                      {ROLE_LABEL[m.role]}
                    </span>
                  </div>
                );
              })}
              {user.orgMemberships.length === 0 && (
                <p className="text-xs text-slate-400 italic">Sin membresías en el organigrama</p>
              )}
            </div>
          </div>

          {/* Info de contacto */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex flex-col divide-y divide-slate-100">
              <a href={`mailto:${user.email}`} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors group">
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span className="text-[12px] text-slate-600 truncate group-hover:text-blue-600 transition-colors">{user.email}</span>
              </a>
              {user.phone ? (
                <a href={`tel:${user.phone}`} className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors group">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span className="text-[12px] text-slate-600 group-hover:text-blue-600 transition-colors">{user.phone}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span className="text-[12px] text-slate-300 italic">Sin teléfono</span>
                </div>
              )}
              {user.country ? (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span className="text-[12px] text-slate-600">{user.country}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span className="text-[12px] text-slate-300 italic">Sin país</span>
                </div>
              )}
              {user.campus ? (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span className="text-[12px] text-slate-600">{user.campus.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span className="text-[12px] text-slate-300 italic">Sin campus</span>
                </div>
              )}
            </div>
          </div>

          {/* Biografía */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Biografía</p>
            {user.bio
              ? <p className="text-[12.5px] text-slate-600 leading-relaxed">{user.bio}</p>
              : <p className="text-[12px] text-slate-300 italic">Sin biografía</p>
            }
          </div>
        </div>
      </div>
    </>
  );
}

// ── SearchBar ──────────────────────────────────────────────────────────────────

function SearchBar({ areas, onSelectUser }: { areas: OrgArea[]; onSelectUser: (u: OrgSearchUser) => void }) {
  const [q,      setQ]      = useState('');
  const [ddOpen, setDdOpen] = useState(false);
  const wrapRef             = useRef<HTMLDivElement>(null);
  const { data: results, isFetching } = useOrgSearch(q);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDdOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function getArea(areaId?: number | null) {
    return areas.find((a) => a.id === areaId);
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5 pointer-events-none w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setDdOpen(true); }}
          onFocus={() => q.length >= 2 && setDdOpen(true)}
          placeholder="Buscar persona por nombre o cargo…"
          className="w-full pl-12 pr-12 py-3.5 border-2 border-slate-200 rounded-2xl text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition shadow-sm"
        />
        {isFetching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin" />
          </div>
        )}
        {q && !isFetching && (
          <button onClick={() => { setQ(''); setDdOpen(false); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm transition-colors">✕</button>
        )}
      </div>

      {ddOpen && q.length >= 2 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto">
          {!results?.length && !isFetching ? (
            <div className="px-5 py-5 text-sm text-slate-400 text-center flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Sin resultados para &ldquo;{q}&rdquo;
            </div>
          ) : (
            results?.map((u) => {
              const firstArea = getArea(u.orgMemberships[0]?.area?.id);
              const color = firstArea?.color ?? '#64748b';
              return (
                <button
                  key={u.id}
                  onMouseDown={() => { onSelectUser(u); setDdOpen(false); setQ(''); }}
                  className="w-full flex items-center gap-3.5 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left transition-colors"
                >
                  <UserAvatar user={u} color={color} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{fullName(u)}</div>
                    {u.jobTitles.length > 0 && (
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{u.jobTitles[0].jobTitle.name}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {u.orgMemberships.slice(0, 3).map((m, i) => {
                        const a = membershipArea(m);
                        if (!a) return null;
                        return (
                          <span key={i} className="inline-flex items-center gap-1 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: a.color }}>
                            {a.iconUrl
                              ? <img src={a.iconUrl} alt="" className="w-3 h-3 rounded-full object-cover flex-shrink-0" />
                              : a.icon}
                            {a.name}
                          </span>
                        );
                      })}
                      {u.orgMemberships.length > 3 && (
                        <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">
                          +{u.orgMemberships.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── OverviewCard ───────────────────────────────────────────────────────────────

function OverviewCard({ area, onClick }: { area: OrgArea; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-white rounded-2xl p-5 flex-1 min-w-[160px] shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition-all text-left">
      <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center text-lg overflow-hidden flex-shrink-0" style={{ background: `${area.color}18` }}>
        {area.iconUrl
          ? <img src={area.iconUrl} alt={area.name} className="w-full h-full object-cover" />
          : area.icon}
      </div>
      <div className="text-[13px] font-bold mb-1" style={{ color: area.color }}>{area.name}</div>
      <div className="text-[11.5px] text-slate-500 leading-relaxed line-clamp-3">{area.desc}</div>
      <div className="mt-3 text-[11px] font-semibold flex items-center gap-1" style={{ color: area.color }}>
        Ver organigrama
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </button>
  );
}

// ── AreaTab ────────────────────────────────────────────────────────────────────

function AreaTab({ area, active, onClick }: { area: OrgArea; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
        active ? 'text-white' : 'text-slate-500 border-transparent hover:text-slate-300'
      }`}
      style={active ? { borderBottomColor: area.color } : {}}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: area.color }} />
      {area.name}
    </button>
  );
}

// ── AreaPage ───────────────────────────────────────────────────────────────────

interface AreaPageProps {
  slug:            string;
  canEdit:         boolean;
  onSelectUser:    (m: OrgMembership) => void;
  onSelectTeam:    (t: OrgTeam) => void;
  editingArea:     boolean;
  onToggleEdit:    () => void;
  onRegisterSave:  (fn: () => void) => void;
  onOpenAreaPanel: () => void;
}

function AreaPage({ slug, canEdit, onSelectUser, onSelectTeam, editingArea, onToggleEdit, onRegisterSave, onOpenAreaPanel }: AreaPageProps) {
  const { data, isLoading, error } = useOrgAreaTree(slug);
  const updateArea   = useUpdateOrgArea();
  const uploadLogo   = useUploadAreaLogo();
  const areaNameRef  = useRef<HTMLSpanElement>(null);
  const areaDescRef  = useRef<HTMLParagraphElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [forceOpen,    setForceOpen]    = useState<boolean | null>(null);
  const [allOpen,      setAllOpen]      = useState(false);
  const [logoPreview,  setLogoPreview]  = useState<string | null>(null);
  const [editColor,    setEditColor]    = useState<string>('');
  const [saving,       setSaving]       = useState(false);
  const [pageToast,    setPageToast]    = useState<{ msg: string; kind: 'success' | 'error' } | null>(null);

  const isEditing  = canEdit && editingArea;
  const liveColor  = isEditing && editColor ? editColor : (data?.color ?? '#64748b');

  // Sincronizar color al entrar en modo edición
  useEffect(() => {
    if (isEditing && data) setEditColor(data.color);
  }, [isEditing, data?.color]);

  // Limpiar preview al salir de edición
  useEffect(() => {
    if (!isEditing) setLogoPreview(null);
  }, [isEditing]);

  function toggleAll() {
    const next = !allOpen;
    setAllOpen(next);
    setForceOpen(next);
  }

  function handleSaveArea() {
    if (!data) return;
    setSaving(true);
    const name  = areaNameRef.current?.textContent?.trim() || undefined;
    const desc  = areaDescRef.current?.textContent?.trim() || undefined;
    const color = editColor || undefined;
    updateArea.mutate(
      { id: data.id, data: { name, desc, color } },
      { onSuccess: () => { setSaving(false); onToggleEdit(); }, onError: () => setSaving(false) },
    );
  }

  useEffect(() => { onRegisterSave(handleSaveArea); });

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw || !data) return;
    try {
      const file    = await resizeImage(raw);
      const preview = URL.createObjectURL(file);
      setLogoPreview(preview);
      uploadLogo.mutate(
        { id: data.id, file },
        { onError: () => { setLogoPreview(null); setPageToast({ msg: 'Error al subir la imagen. Intenta nuevamente.', kind: 'error' }); } },
      );
    } catch { setPageToast({ msg: 'No se pudo procesar la imagen.', kind: 'error' }); }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" /></div>;
  }
  if (error || !data) return <p className="text-red-500 text-sm p-4">Error cargando el organigrama.</p>;

  const totalMembers = new Set([
    ...data.leaders.map((m) => m.userId),
    ...data.teams.flatMap((t) => t.memberships.map((m) => m.userId)),
  ]).size;
  const areaImage    = logoPreview ?? data.iconUrl ?? null;

  return (
    <div>
      {/* ── Hero del área ───────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${liveColor}18 0%, ${liveColor}06 60%, transparent 100%)` }}
      >
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: liveColor }} />

        <div className="px-8 pt-8 pb-6 flex flex-col gap-5">

          {/* Fila principal: imagen + nombre + stats */}
          <div className="flex items-start justify-between gap-6">

            {/* Izquierda: imagen/icono + nombre + descripción */}
            <div className="flex items-start gap-4 min-w-0">

              {/* Imagen del área (clickeable en edición) */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-2xl shadow-sm"
                  style={{ background: `${liveColor}22`, border: `1.5px solid ${liveColor}30` }}
                >
                  {areaImage
                    ? <img src={areaImage} alt={data.name} className="w-full h-full object-cover" />
                    : data.icon
                  }
                </div>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadLogo.isPending}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-md transition-opacity hover:opacity-90"
                    style={{ background: liveColor }}
                    title="Cambiar imagen"
                  >
                    {uploadLogo.isPending
                      ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                      : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    }
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>

              <div className="min-w-0 flex-1">
                {/* Nombre */}
                <div className="flex items-start gap-1.5">
                  <span
                    ref={areaNameRef}
                    contentEditable={isEditing}
                    suppressContentEditableWarning
                    className={`block text-2xl font-bold tracking-tight leading-tight text-slate-900 ${
                      isEditing ? 'cursor-text focus:outline-none rounded-lg px-2 py-0.5 -mx-2 focus:bg-white/60 min-w-[80px]' : ''
                    }`}
                  >
                    {data.name}
                  </span>
                  {canEdit && (
                    <button
                      onClick={onOpenAreaPanel}
                      title="Editar organigrama"
                      className="mt-1.5 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Descripción */}
                <p
                  ref={areaDescRef}
                  contentEditable={isEditing}
                  suppressContentEditableWarning
                  className={`mt-1 text-[13px] leading-relaxed max-w-xl ${
                    isEditing
                      ? 'cursor-text focus:outline-none rounded-lg px-2 py-0.5 -mx-2 focus:bg-white/60 text-slate-600 border border-dashed border-slate-300'
                      : 'text-slate-500'
                  } ${!data.desc && isEditing ? 'text-slate-300 italic' : ''}`}
                >
                  {data.desc ?? (isEditing ? 'Agregar descripción...' : '')}
                </p>

                {/* Color picker — solo en edición */}
                {isEditing && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <label className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">Color del área</label>
                    <div className="relative flex items-center gap-1.5">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                        title="Cambiar color"
                      />
                      <span className="text-[11px] font-mono text-slate-500">{editColor}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Derecha: stats */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-center px-4 py-2.5 rounded-2xl bg-white/70 border border-slate-100 shadow-sm min-w-[64px]">
                <p className="text-xl font-bold text-slate-900 leading-none">{totalMembers}</p>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">personas</p>
              </div>
              <div className="text-center px-4 py-2.5 rounded-2xl bg-white/70 border border-slate-100 shadow-sm min-w-[64px]">
                <p className="text-xl font-bold leading-none" style={{ color: liveColor }}>{data.teams.length}</p>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">equipos</p>
              </div>
            </div>

          </div>

          {/* Fila inferior: toggle + botones edición */}
          <div className="flex items-center gap-5 flex-wrap">

            <button
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" style={{ transform: allOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              {allOpen ? 'Contraer todo' : 'Expandir todo'}
            </button>

            {/* Botones edición — alineados al final */}
            {canEdit && (
              <div className="ml-auto flex items-center gap-2">
                {!isEditing ? (
                  <button
                    onClick={onToggleEdit}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: liveColor }}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Editar organigrama
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveArea}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all disabled:opacity-60 hover:opacity-90"
                      style={{ background: liveColor }}
                    >
                      {saving
                        ? <><div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
                        : <><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Guardar</>
                      }
                    </button>
                    <button
                      onClick={onToggleEdit}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      <div className="px-5 pb-10 pt-2">
        <TreeView data={data} color={liveColor} canEdit={isEditing} forceOpen={forceOpen} onSelectUser={onSelectUser} onSelectTeam={onSelectTeam} />
      </div>

      {pageToast && <OrgToast msg={pageToast.msg} kind={pageToast.kind} onDismiss={() => setPageToast(null)} />}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

type SelectedItem =
  | { kind: 'membership'; data: OrgMembership; color: string }
  | { kind: 'team';       data: OrgTeam;       color: string };

export function OrgChartClient() {
  const { data: areas, isLoading: areasLoading } = useOrgAreas();
  const user    = useAuthStore((s) => s.user);
  const { can } = usePermissions();
  const canEdit = can('orgchart:edit');

  const [activeSlug,      setActiveSlug]      = useState<string | null>(null);
  const [selected,        setSelected]        = useState<SelectedItem | null>(null);
  const [searchSelected,  setSearchSelected]  = useState<OrgSearchUser | null>(null);
  const [editingArea,     setEditingArea]     = useState(false);
  const [showAreaPanel,   setShowAreaPanel]   = useState(false);
  const areaSaveFnRef = useRef<(() => void) | null>(null);

  function getColor(areaId?: number) {
    return areas?.find((a) => a.id === areaId)?.color ?? '#64748b';
  }

  function handleSelectUser(m: OrgMembership, color: string) {
    setSelected({ kind: 'membership', data: m, color });
  }

  function handleSelectTeam(t: OrgTeam, color: string) {
    setSelected({ kind: 'team', data: t, color });
  }

  if (areasLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" /></div>;
  }

  const activeArea   = areas?.find((a) => a.slug === activeSlug);
  const activeColor  = activeArea?.color ?? '#64748b';

  return (
    <div className="flex flex-col h-full -mx-6 -mt-6 -mb-6">
      {/* Tabs */}
      <div className="px-5 flex items-center gap-0.5 overflow-x-auto scrollbar-none border-b border-white/5 flex-shrink-0" style={{ background: '#0d0d0d' }}>
        <button
          onClick={() => { setActiveSlug(null); setSelected(null); setEditingArea(false); setShowAreaPanel(false); }}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${activeSlug === null ? 'text-white border-white/60' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
        >
          <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
          Vista General
        </button>
        {areas?.map((area) => (
          <AreaTab key={area.slug} area={area} active={activeSlug === area.slug} onClick={() => { setActiveSlug(area.slug); setSelected(null); setEditingArea(false); setShowAreaPanel(false); }} />
        ))}

        {/* Indicador modo edición en el tab bar */}
        {canEdit && editingArea && (
          <div className="ml-auto pl-4 flex-shrink-0">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Modo edición
            </span>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {activeSlug === null ? (
          <div>
            {/* Hero con buscador */}
            <div className="bg-white border-b border-slate-100 px-6 pt-8 pb-7 flex flex-col items-center gap-3">
              <div className="text-center mb-1">
                <h1 className="inline-block bg-slate-900 text-white text-[13px] font-black uppercase tracking-widest px-5 py-2 rounded-full">Organigramas</h1>
              </div>
              <p className="text-[12.5px] text-slate-400 text-center max-w-sm">
                Selecciona un área para ver el detalle o busca una persona por su nombre en todas las áreas.
              </p>
              <SearchBar areas={areas ?? []} onSelectUser={(u) => { setSearchSelected(u); setSelected(null); }} />
            </div>
            <div className="px-6 pt-6 pb-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {areas?.map((area) => (
                <OverviewCard key={area.slug} area={area} onClick={() => setActiveSlug(area.slug)} />
              ))}
            </div>
          </div>
        ) : (
          <AreaPage
            slug={activeSlug}
            canEdit={canEdit}
            onSelectUser={(m) => handleSelectUser(m, activeColor)}
            onSelectTeam={(t) => handleSelectTeam(t, activeColor)}
            editingArea={editingArea}
            onToggleEdit={() => setEditingArea((v) => !v)}
            onRegisterSave={(fn) => { areaSaveFnRef.current = fn; }}
            onOpenAreaPanel={() => setShowAreaPanel(true)}
          />
        )}
      </div>

      {/* Panel lateral */}
      {searchSelected && (
        <SearchUserDetailPanel
          key={searchSelected.id}
          user={searchSelected}
          areas={areas ?? []}
          onClose={() => setSearchSelected(null)}
        />
      )}
      {!searchSelected && selected?.kind === 'membership' && (
        <UserDetailPanel
          key={selected.data.id}
          membership={selected.data}
          color={selected.color}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
        />
      )}
      {!searchSelected && selected?.kind === 'team' && (
        <TeamDetailPanel
          key={selected.data.id}
          team={selected.data}
          color={selected.color}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
        />
      )}
      {showAreaPanel && activeSlug && (
        <AreaDetailPanel
          key={activeSlug}
          slug={activeSlug}
          canEdit={canEdit}
          onClose={() => setShowAreaPanel(false)}
        />
      )}
    </div>
  );
}
