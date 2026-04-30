'use client';

import { useState, useEffect, useRef } from 'react';
import { useUsers, useUpdateUser } from '@/hooks/useUsers';
import type { User, UpdateUserDto } from '@/types/user';

// ── Colores de avatar determinísticos ─────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: '#E1F5EE', text: '#0F6E56' },
  { bg: '#E6F1FB', text: '#185FA5' },
  { bg: '#FAEEDA', text: '#854F0B' },
  { bg: '#EEEDFE', text: '#534AB7' },
  { bg: '#FAECE7', text: '#993C1D' },
  { bg: '#FBEAF0', text: '#993556' },
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function userInitials(u: User) {
  return (u.firstName[0] + (u.lastName[0] ?? '')).toUpperCase();
}

// ── Avatar ────────────────────────────────────────────────────────────────────

interface AvatarProps {
  user: User;
  size?: number;
  className?: string;
}

function Avatar({ user, size = 48, className = '' }: AvatarProps) {
  const sz = `${size}px`;
  const { bg, text } = avatarColor(user.id);

  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={`${user.firstName} ${user.lastName}`}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: sz, height: sz }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex-shrink-0 flex items-center justify-center font-semibold ${className}`}
      style={{
        width: sz,
        height: sz,
        background: bg,
        color: text,
        fontSize: size > 40 ? '15px' : '12px',
      }}
    >
      {userInitials(user)}
    </div>
  );
}

// ── UserCard ──────────────────────────────────────────────────────────────────

interface UserCardProps {
  user: User;
  onEdit: (u: User) => void;
}

function UserCard({ user, onEdit }: UserCardProps) {
  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <Avatar user={user} size={48} />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-slate-900 leading-snug truncate">{fullName}</p>
          {user.jobTitle ? (
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mt-0.5 truncate">
              {user.jobTitle}
            </p>
          ) : (
            <p className="text-[11px] text-slate-300 italic mt-0.5">Sin cargo</p>
          )}
        </div>
      </div>

      {/* Contacto */}
      <div className="flex flex-col gap-1.5">
        <a
          href={`mailto:${user.email}`}
          className="flex items-center gap-2 text-[11.5px] text-slate-500 hover:text-blue-600 transition-colors truncate"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          <span className="truncate">{user.email}</span>
        </a>
        {user.phone && (
          <a
            href={`tel:${user.phone}`}
            className="flex items-center gap-2 text-[11.5px] text-slate-500 hover:text-blue-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {user.phone}
          </a>
        )}
        {user.country && (
          <div className="flex items-center gap-2 text-[11.5px] text-slate-400">
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {user.country}
          </div>
        )}
        {user.department && (
          <div className="flex items-center gap-2 text-[11.5px] text-slate-400">
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            {user.department.name}
          </div>
        )}
      </div>

      {/* Bio */}
      {user.bio && (
        <p className="text-[11.5px] text-slate-500 leading-relaxed line-clamp-2 border-t border-slate-100 pt-2.5">
          {user.bio}
        </p>
      )}

      {/* Acción */}
      <button
        onClick={() => onEdit(user)}
        className="mt-auto flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-slate-200 text-[12px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Editar perfil
      </button>
    </div>
  );
}

// ── EditModal ─────────────────────────────────────────────────────────────────

interface EditModalProps {
  user: User;
  onClose: () => void;
}

function EditModal({ user, onClose }: EditModalProps) {
  const [form, setForm] = useState<UpdateUserDto>({
    firstName: user.firstName,
    lastName:  user.lastName,
    jobTitle:  user.jobTitle ?? '',
    phone:     user.phone ?? '',
    country:   user.country ?? '',
    bio:       user.bio ?? '',
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const updateUser = useUpdateUser();

  function set(field: keyof UpdateUserDto, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    setSaveState('saving');
    // Limpiar strings vacíos → undefined para no sobreescribir con vacío
    const payload: UpdateUserDto = {
      firstName: form.firstName?.trim() || undefined,
      lastName:  form.lastName?.trim()  || undefined,
      jobTitle:  form.jobTitle?.trim()  || undefined,
      phone:     form.phone?.trim()     || undefined,
      country:   form.country?.trim()   || undefined,
      bio:       form.bio?.trim()       || undefined,
    };
    updateUser.mutate(
      { id: user.id, data: payload },
      {
        onSuccess: () => {
          setSaveState('saved');
          setTimeout(onClose, 800);
        },
        onError: () => setSaveState('idle'),
      },
    );
  }

  // Cerrar con Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const fullName = `${user.firstName} ${user.lastName}`;
  const { bg, text } = avatarColor(user.id);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[440px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={fullName}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-[13px]"
              style={{ background: bg, color: text }}
            >
              {userInitials(user)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-[14px] truncate">{fullName}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Editar información de perfil</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <div className="p-5 flex flex-col gap-3.5">
          {/* Nombre y apellido en row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Nombre</label>
              <input
                type="text"
                value={form.firstName ?? ''}
                onChange={(e) => set('firstName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                placeholder="Nombre"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Apellido</label>
              <input
                type="text"
                value={form.lastName ?? ''}
                onChange={(e) => set('lastName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                placeholder="Apellido"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Cargo</label>
            <input
              type="text"
              value={form.jobTitle ?? ''}
              onChange={(e) => set('jobTitle', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
              placeholder="Ej: Guitarrista, Director de medios..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Teléfono</label>
              <input
                type="tel"
                value={form.phone ?? ''}
                onChange={(e) => set('phone', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                placeholder="+57 300 000 0000"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">País</label>
              <input
                type="text"
                value={form.country ?? ''}
                onChange={(e) => set('country', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                placeholder="Ej: Colombia, Chile..."
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Biografía
              <span className="text-slate-300 font-normal ml-1">— aparece en la tarjeta del directorio</span>
            </label>
            <textarea
              value={form.bio ?? ''}
              onChange={(e) => set('bio', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none"
              placeholder="Cuéntanos algo sobre ti..."
            />
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={saveState === 'saving' || saveState === 'saved'}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-70"
              style={{ background: saveState === 'saved' ? '#1D9E75' : '#334155' }}
            >
              {saveState === 'idle' && (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Guardar cambios
                </>
              )}
              {saveState === 'saving' && (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              )}
              {saveState === 'saved' && (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  ¡Guardado!
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={saveState === 'saving'}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <p className="text-[14px] font-medium text-slate-700 mb-1">
        {query ? `Sin resultados para "${query}"` : 'No hay personas registradas'}
      </p>
      <p className="text-[12.5px] text-slate-400 max-w-xs">
        {query
          ? 'Intenta con otro nombre, cargo o email'
          : 'Los usuarios aparecerán aquí cuando se agreguen al sistema'}
      </p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex-shrink-0" />
        <div className="flex-1">
          <div className="h-3.5 bg-slate-100 rounded w-3/4 mb-2" />
          <div className="h-2.5 bg-slate-100 rounded w-1/2" />
        </div>
      </div>
      <div className="h-2.5 bg-slate-100 rounded w-full" />
      <div className="h-2.5 bg-slate-100 rounded w-2/3" />
      <div className="h-8 bg-slate-100 rounded-xl mt-1" />
    </div>
  );
}

// ── Main DirectorioClient ─────────────────────────────────────────────────────

export function DirectorioClient() {
  const [query, setQuery]           = useState('');
  const [debouncedQuery, setDebounced] = useState('');
  const [editing, setEditing]       = useState<User | null>(null);
  const debounceRef                 = useRef<ReturnType<typeof setTimeout>>();

  // Debounce 350ms sobre la búsqueda
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const { data: users, isLoading } = useUsers(debouncedQuery || undefined);

  const total  = users?.length ?? 0;
  const active = users?.filter((u) => u.status === 'active').length ?? 0;

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Barra superior */}
      <div className="bg-slate-900 px-5 py-3 flex items-center gap-4 flex-shrink-0">
        {/* Título + contadores */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div>
            <h1 className="text-white font-semibold text-[14px] leading-none">Directorio</h1>
            <p className="text-slate-400 text-[11px] mt-0.5">
              {isLoading ? '...' : `${active} activos · ${total} total`}
            </p>
          </div>
        </div>

        {/* Buscador */}
        <div className="flex-1 max-w-lg relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, cargo o email…"
            className="w-full pl-10 pr-9 py-2 bg-white/10 border border-white/10 rounded-lg text-[13px] text-white placeholder-slate-500 focus:outline-none focus:bg-white/15 focus:border-white/20 transition"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : !users || users.length === 0 ? (
          <EmptyState query={debouncedQuery} />
        ) : (
          <>
            {/* Indicador de búsqueda activa */}
            {debouncedQuery && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-[12.5px] text-slate-500">
                  {users.length} resultado{users.length !== 1 ? 's' : ''} para
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[11.5px] font-medium">
                  {debouncedQuery}
                  <button
                    onClick={() => setQuery('')}
                    className="text-slate-400 hover:text-white ml-0.5"
                  >
                    ✕
                  </button>
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {users.map((user) => (
                <UserCard key={user.id} user={user} onEdit={setEditing} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal de edición */}
      {editing && (
        <EditModal user={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
