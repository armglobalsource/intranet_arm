'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  useSystemRoles, useCreateRole, useUpdateRole, useDeleteRole,
  type SystemRole,
} from '@/hooks/useRoles';
import { PERMISSION_CATALOG } from '@/lib/permissions';

// ── PermissionsPanel ──────────────────────────────────────────────────────────

interface PermissionsPanelProps {
  rol:     SystemRole;
  onClose: () => void;
}

function PermissionsPanel({ rol, onClose }: PermissionsPanelProps) {
  const update = useUpdateRole();
  const isWildcard = rol.permissions.includes('*');

  const [selected,   setSelected]   = useState<Set<string>>(new Set(rol.permissions));
  const [wildcard,   setWildcard]   = useState(isWildcard);
  const [saveState,  setSaveState]  = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  function toggle(perm: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm); else next.add(perm);
      return next;
    });
  }

  function toggleWildcard() {
    setWildcard((w) => !w);
    setSelected(new Set());
  }

  function handleSave() {
    setSaveState('saving');
    const permissions = wildcard ? ['*'] : Array.from(selected);
    update.mutate(
      { id: rol.id, data: { permissions } },
      {
        onSuccess: () => { setSaveState('saved'); setTimeout(onClose, 700); },
        onError:   () => { setSaveState('error'); setTimeout(() => setSaveState('idle'), 2000); },
      },
    );
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[620px] overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-lg">🛡️</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">Permisos — <span className="font-mono text-indigo-600">{rol.name}</span></p>
            <p className="text-[11px] text-slate-400 mt-0.5">Configura qué puede hacer este rol en el sistema</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        {/* Acceso total */}
        <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <label className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${wildcard ? 'bg-indigo-50 border border-indigo-200' : 'border border-slate-200 hover:bg-slate-50'}`}>
            <div
              className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${wildcard ? 'bg-indigo-600' : 'border-2 border-slate-300'}`}
              onClick={toggleWildcard}
            >
              {wildcard && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <div className="flex-1" onClick={toggleWildcard}>
              <p className="text-[13px] font-semibold text-slate-900">Acceso total <span className="font-mono text-[11px] text-indigo-500 ml-1">*</span></p>
              <p className="text-[11px] text-slate-400">Este rol puede hacer todo en el sistema sin restricciones</p>
            </div>
          </label>
        </div>

        {/* Grid de permisos */}
        <div className={`overflow-y-auto flex-1 px-5 py-4 ${wildcard ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex flex-col gap-4">
            {Object.entries(PERMISSION_CATALOG).map(([resource, cfg]) => (
              <div key={resource}>
                {/* Recurso header */}
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[11.5px] font-bold text-slate-700 uppercase tracking-wider">{cfg.label}</p>
                    <div className="flex-1 h-px bg-slate-100"/>
                  </div>
                  {'description' in cfg && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{(cfg as any).description}</p>
                  )}
                </div>
                {/* Acciones */}
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(cfg.actions).map(([action, label]) => {
                    const perm    = `${resource}:${action}`;
                    const checked = selected.has(perm);
                    return (
                      <label
                        key={perm}
                        onClick={() => toggle(perm)}
                        className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer border transition-colors ${
                          checked
                            ? 'bg-indigo-50 border-indigo-200'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${checked ? 'bg-indigo-600' : 'border-2 border-slate-300'}`}>
                          {checked && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <p className="text-[12px] font-medium text-slate-800 leading-tight">{label}</p>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50">
          <span className="text-[12px] text-slate-400 flex-1">
            {wildcard ? 'Acceso total activado' : `${selected.size} permiso${selected.size !== 1 ? 's' : ''} seleccionado${selected.size !== 1 ? 's' : ''}`}
          </span>
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saveState === 'saving' || saveState === 'saved'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: saveState === 'saved' ? '#1D9E75' : saveState === 'error' ? '#DC2626' : '#4F46E5' }}
          >
            {saveState === 'idle'   && 'Guardar permisos'}
            {saveState === 'saving' && <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Guardando...</>}
            {saveState === 'saved'  && '✓ Guardado'}
            {saveState === 'error'  && '✕ Error'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RolModal ──────────────────────────────────────────────────────────────────

interface RolModalProps {
  rol:     SystemRole | null;
  onClose: () => void;
}

function RolModal({ rol, onClose }: RolModalProps) {
  const isEdit = !!rol;
  const [name,        setName]        = useState(rol?.name ?? '');
  const [description, setDescription] = useState(rol?.description ?? '');
  const [saveState,   setSaveState]   = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg,    setErrorMsg]    = useState('');

  const create = useCreateRole();
  const update = useUpdateRole();

  const canSubmit   = name.trim().length >= 2;
  const isSystemRol = isEdit && rol!.isSystem;

  function handleSubmit() {
    if (!canSubmit) return;
    setSaveState('saving');
    setErrorMsg('');

    const onError = (err: any) => {
      const msg = err?.response?.data?.message ?? 'Error al guardar';
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2500);
    };
    const onSuccess = () => { setSaveState('saved'); setTimeout(onClose, 800); };

    const data = { name: name.trim(), description: description.trim() || undefined };
    if (isEdit) update.mutate({ id: rol!.id, data }, { onSuccess, onError });
    else        create.mutate(data, { onSuccess, onError });
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[440px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-lg">🔐</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">{isEdit ? 'Editar rol' : 'Nuevo rol del sistema'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isEdit ? `Editando: ${rol!.name}` : 'Define un nuevo rol para controlar acceso y funcionalidades'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {isSystemRol && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-amber-500 mt-0.5">⚠️</span>
              <span className="text-[12px] text-amber-800">Este es un rol del sistema. El nombre no puede modificarse.</span>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Nombre del rol <span className="text-red-400">*</span>
            </label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              disabled={isSystemRol} autoFocus={!isSystemRol}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition disabled:bg-slate-50 disabled:text-slate-400"
              placeholder="Ej: branding, editor, supervisor..."
            />
            <p className="text-[11px] text-slate-400 mt-1">Identificador interno del rol</p>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Descripción <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              autoFocus={isSystemRol} rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition resize-none"
              placeholder="Describe las responsabilidades y accesos de este rol..."
            />
          </div>
          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-[12px] text-red-700">{errorMsg}</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSubmit} disabled={!canSubmit || saveState === 'saving' || saveState === 'saved'}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: saveState === 'saved' ? '#1D9E75' : saveState === 'error' ? '#DC2626' : '#4F46E5' }}
            >
              {saveState === 'idle'   && (isEdit ? 'Guardar cambios' : '+ Crear rol')}
              {saveState === 'saving' && <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Guardando...</>}
              {saveState === 'saved'  && '✓ ¡Guardado!'}
              {saveState === 'error'  && '✕ Error'}
            </button>
            <button onClick={onClose} disabled={saveState === 'saving'}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PermBadges ────────────────────────────────────────────────────────────────

function permLabel(perm: string): string {
  const [resource, action] = perm.split(':');
  const cat = (PERMISSION_CATALOG as any)[resource];
  if (!cat) return perm;
  const actionLabel = cat.actions?.[action];
  return actionLabel ?? `${cat.label}: ${action}`;
}

function PermBadges({ permissions }: { permissions: string[] }) {
  if (permissions.includes('*')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10.5px] font-semibold">
        ✦ Acceso total
      </span>
    );
  }
  if (permissions.length === 0) {
    return <span className="text-[11px] italic text-slate-300">Sin permisos</span>;
  }
  const shown = permissions.slice(0, 2);
  const rest  = permissions.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((p) => (
        <span key={p} className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10.5px]">{permLabel(p)}</span>
      ))}
      {rest > 0 && <span className="text-[10.5px] text-slate-400 self-center">+{rest} más</span>}
    </div>
  );
}

// ── RolesPage ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const router = useRouter();
  const { data: roles = [], isLoading } = useSystemRoles();
  const update = useUpdateRole();
  const remove = useDeleteRole();

  const [modal,      setModal]      = useState<'create' | 'edit' | null>(null);
  const [permsFor,   setPermsFor]   = useState<SystemRole | null>(null);
  const [selected,   setSelected]   = useState<SystemRole | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [search,     setSearch]     = useState('');

  function openEdit(r: SystemRole) { setSelected(r); setModal('edit'); }
  function openCreate()            { setSelected(null); setModal('create'); }
  function closeModal()            { setModal(null); setSelected(null); }

  function handleToggle(r: SystemRole) {
    setTogglingId(r.id);
    update.mutate({ id: r.id, data: { isActive: !r.isActive } }, { onSettled: () => setTogglingId(null) });
  }

  function handleDelete(r: SystemRole) {
    if (r.isSystem) return;
    if (deletingId !== r.id) { setDeletingId(r.id); return; }
    remove.mutate(r.id, { onSettled: () => setDeletingId(null) });
  }

  const filtered = roles.filter(
    (r) => !search.trim() ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const total  = roles.length;
  const active = roles.filter((r) => r.isActive).length;

  return (
    <div className="min-h-full bg-slate-50 p-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/directorio')}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div>
            <h1 className="text-[22px] font-bold text-slate-900 leading-tight">Roles del Sistema</h1>
            <p className="text-slate-400 text-[13px] mt-0.5">
              {isLoading ? 'Cargando...' : `${active} activos · ${total} en total`}
            </p>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo rol
        </button>
      </div>

      {/* Info banner */}
      <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100">
        <span className="text-indigo-400 mt-0.5 text-lg">🔐</span>
        <div>
          <p className="text-[13px] font-medium text-indigo-900">Roles del sistema vs. Cargos</p>
          <p className="text-[12px] text-indigo-600 mt-0.5 leading-relaxed">
            Los <strong>roles</strong> controlan el acceso y funcionalidades (ej: admin, branding).
            Los <strong>cargos</strong> son los títulos organizacionales de la persona (ej: Líder de Worship).
          </p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar rol por nombre o descripción…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white transition"/>
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[160px_1fr_2fr_80px_80px_150px] gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50">
          {['ROL', 'TIPO', 'PERMISOS', 'USUARIOS', 'ESTADO', 'ACCIONES'].map((h) => (
            <span key={h} className="text-[10.5px] font-bold tracking-widest text-slate-400 uppercase">{h}</span>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl">🔐</div>
            <div>
              <p className="text-[13px] font-medium text-slate-700">
                {search ? `Sin resultados para "${search}"` : 'No hay roles creados'}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">
                {search ? 'Prueba con otro término' : 'Crea el primer rol con el botón de arriba'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((rol) => {
              const isInactive   = !rol.isActive;
              const isToggling   = togglingId === rol.id;
              const isDelConfirm = deletingId === rol.id;

              return (
                <div key={rol.id}
                  className={`grid grid-cols-[160px_1fr_2fr_80px_80px_150px] gap-3 items-center px-5 py-3.5 transition-colors ${
                    isInactive ? 'opacity-55 bg-slate-50/60' : 'hover:bg-slate-50/50'
                  }`}
                >
                  {/* Nombre */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${rol.isSystem ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                      {rol.isSystem ? '🔒' : '🔓'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-slate-900 truncate font-mono">{rol.name}</p>
                      {rol.description && <p className="text-[10.5px] text-slate-400 truncate">{rol.description}</p>}
                    </div>
                  </div>

                  {/* Tipo */}
                  {rol.isSystem
                    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-medium w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"/>Sistema
                      </span>
                    : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>Custom
                      </span>
                  }

                  {/* Permisos */}
                  <PermBadges permissions={rol.permissions}/>

                  {/* Usuarios */}
                  <span className="text-[12.5px] text-slate-500 font-mono">{rol.userCount ?? 0}</span>

                  {/* Estado */}
                  {rol.isActive
                    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>Activo
                      </span>
                    : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>Inactivo
                      </span>
                  }

                  {/* Acciones */}
                  <div className="flex items-center gap-1">

                    {/* Permisos */}
                    <button onClick={() => setPermsFor(rol)} title="Configurar permisos"
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </button>

                    {/* Editar */}
                    <button onClick={() => openEdit(rol)} title="Editar"
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>

                    {/* Habilitar / Deshabilitar */}
                    <button
                      onClick={() => handleToggle(rol)}
                      disabled={isToggling || rol.isSystem}
                      title={rol.isSystem ? 'Los roles del sistema no pueden deshabilitarse' : isInactive ? 'Habilitar' : 'Deshabilitar'}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                        isInactive ? 'border-emerald-200 text-emerald-500 hover:bg-emerald-50' : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {isToggling
                        ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin"/>
                        : isInactive
                          ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                      }
                    </button>

                    {/* Eliminar */}
                    <button onClick={() => handleDelete(rol)} disabled={rol.isSystem}
                      title={rol.isSystem ? 'Los roles del sistema no pueden eliminarse' : isDelConfirm ? 'Confirmar eliminación' : 'Eliminar'}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                        isDelConfirm ? 'border-red-300 bg-red-50 text-red-500 hover:bg-red-100' : 'border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200'
                      }`}
                    >
                      {isDelConfirm
                        ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deletingId !== null && (
        <p className="mt-3 text-center text-[12px] text-slate-400">
          Haz clic en ✓ nuevamente para confirmar la eliminación
        </p>
      )}

      {modal    && <RolModal rol={modal === 'edit' ? selected : null} onClose={closeModal}/>}
      {permsFor && <PermissionsPanel rol={permsFor} onClose={() => setPermsFor(null)}/>}
    </div>
  );
}
