'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth.store';
import { useUpdateUser, useUploadUserAvatar } from '@/hooks/useUsers';
import { useActiveCampuses } from '@/hooks/useCampus';
import type { UserGender } from '@/types/user';

const GENDER_LABELS: Record<UserGender, string> = {
  male:              'Masculino',
  female:            'Femenino',
  other:             'Otro',
  prefer_not_to_say: 'Prefiero no decir',
};

const GENDER_OPTIONS: { value: UserGender | ''; label: string }[] = [
  { value: '',       label: 'Sin especificar' },
  { value: 'male',   label: 'Masculino' },
  { value: 'female', label: 'Femenino' },
];

function Avatar({ avatarUrl, initials, size = 20 }: { avatarUrl?: string | null; initials: string; size?: number }) {
  const px = `${size * 4}px`;
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="avatar" className="rounded-full object-cover flex-shrink-0" style={{ width: px, height: px }} />;
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: px, height: px,
        background: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.7)',
        fontSize: `${size * 1.2}px`,
      }}
    >
      {initials}
    </div>
  );
}

function Badge({ label, color = 'slate' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    slate:  'bg-slate-800 text-slate-300 border-slate-700',
    violet: 'bg-violet-950/60 text-violet-300 border-violet-800/50',
    amber:  'bg-amber-950/60 text-amber-300 border-amber-800/50',
    teal:   'bg-teal-950/60 text-teal-300 border-teal-800/50',
    indigo: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[color] ?? colors.slate}`}>
      {label}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border" style={{ background: '#111', borderColor: '#1f1f1f' }}>
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #1f1f1f' }}>
        <h2 className="text-[12px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-[13px] text-white outline-none"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }: {
  label: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-[13px] text-white outline-none appearance-none"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: '#1a1a1a' }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[12px] w-28 flex-shrink-0 pt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
      <span className="text-[13px] text-white/75 flex-1">{value}</span>
    </div>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function PerfilPage() {
  const { user, updateUser } = useAuthStore();
  const updateMutation = useUpdateUser();
  const uploadMutation = useUploadUserAvatar();
  const { data: campuses = [] } = useActiveCampuses();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName:  '',
    phone:     '',
    country:   '',
    bio:       '',
    birthDate: '',
    gender:    '' as UserGender | '',
    campusId:  '' as string,
  });

  const initials = user
    ? (user.firstName[0] + user.lastName[0]).toUpperCase()
    : '??';

  function startEdit() {
    setForm({
      firstName: user?.firstName ?? '',
      lastName:  user?.lastName  ?? '',
      phone:     user?.phone     ?? '',
      country:   user?.country   ?? '',
      bio:       user?.bio       ?? '',
      birthDate: user?.birthDate ?? '',
      gender:    (user?.gender ?? '') as UserGender | '',
      campusId:  user?.campusId != null ? String(user.campusId) : '',
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const campusIdVal = form.campusId ? parseInt(form.campusId, 10) : null;
      const updated = await updateMutation.mutateAsync({
        id: user.id,
        data: {
          firstName: form.firstName,
          lastName:  form.lastName,
          phone:     form.phone  || undefined,
          country:   form.country || undefined,
          bio:       form.bio    || undefined,
          birthDate: form.birthDate || null,
          gender:    (form.gender as UserGender) || null,
          campusId:  campusIdVal,
        },
      });
      updateUser({
        firstName: updated.firstName,
        lastName:  updated.lastName,
        campus:    updated.campus,
        campusId:  updated.campusId,
        birthDate: updated.birthDate,
        gender:    updated.gender,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const updated = await uploadMutation.mutateAsync({ id: user.id, file });
      updateUser({ avatarUrl: updated.avatarUrl ?? undefined });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Error al subir la imagen';
      setAvatarError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [user, uploadMutation, updateUser]);

  if (!user) return null;

  const permissions: string[] = (user as any).permissions ?? [];
  const jobTitles: any[]      = (user as any).jobTitles   ?? [];
  const campus               = (user as any).campus;

  const campusOptions = [
    { value: '', label: 'Sin campus' },
    ...campuses.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div className="px-8 pt-8 pb-6" style={{ borderBottom: '1px solid #1a1a1a' }}>
        <Link
          href="/dashboard/directorio"
          className="inline-flex items-center gap-1.5 text-[12px] mb-5 transition-colors"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseOver={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
          onMouseOut={(e)  => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Volver
        </Link>

        <div className="flex items-center gap-5">
          {/* Avatar con botón de carga */}
          <div className="relative group">
            <Avatar avatarUrl={user.avatarUrl} initials={initials} size={20} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
              style={{ background: 'rgba(0,0,0,0.55)' }}
              title="Cambiar foto"
            >
              {uploadingAvatar ? (
                <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[22px] font-bold text-white leading-none">
                {user.firstName} {user.lastName}
              </h1>
              {user.role?.name && <Badge label={user.role.name} color="indigo" />}
            </div>
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{user.email}</p>
            {campus && (
              <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {campus.name}
              </p>
            )}
            {avatarError && (
              <p className="text-[11px] mt-1.5 text-red-400">{avatarError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-7 grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl">

        {/* Información personal (editable) */}
        <div className="lg:col-span-2 space-y-5">
          <SectionCard title="Información personal">
            {editing ? (
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput label="Nombre" value={form.firstName} onChange={(v) => setForm((f) => ({ ...f, firstName: v }))} />
                  <FieldInput label="Apellido" value={form.lastName} onChange={(v) => setForm((f) => ({ ...f, lastName: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput label="Teléfono" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+56 9 xxxx xxxx" />
                  <FieldInput label="País" value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} placeholder="Chile" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput label="Fecha de nacimiento" value={form.birthDate} onChange={(v) => setForm((f) => ({ ...f, birthDate: v }))} type="date" />
                  <FieldSelect
                    label="Género"
                    value={form.gender as string}
                    onChange={(v) => setForm((f) => ({ ...f, gender: v as UserGender | '' }))}
                    options={GENDER_OPTIONS}
                  />
                </div>
                <FieldSelect
                  label="Campus"
                  value={form.campusId}
                  onChange={(v) => setForm((f) => ({ ...f, campusId: v }))}
                  options={campusOptions}
                />
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Biografía</label>
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg text-[13px] text-white outline-none resize-none"
                    style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
                    placeholder="Cuéntanos algo sobre ti..."
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: '#2563eb' }}
                  >
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="px-4 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white/70 transition-all"
                    style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Row label="Nombre" value={`${user.firstName} ${user.lastName}`} />
                <Row label="Email" value={user.email} />
                {user.phone    && <Row label="Teléfono" value={user.phone} />}
                {user.country  && <Row label="País" value={user.country} />}
                {user.birthDate && <Row label="Nacimiento" value={formatDate(user.birthDate)} />}
                {user.gender   && <Row label="Género" value={GENDER_LABELS[user.gender as UserGender] ?? user.gender} />}
                {campus        && <Row label="Campus" value={campus.name} />}
                {user.bio      && <Row label="Biografía" value={user.bio} />}
                <div className="pt-2">
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white/60 hover:text-white transition-all"
                    style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Editar información
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Permisos */}
          {permissions.length > 0 && (
            <SectionCard title="Permisos">
              <div className="flex flex-wrap gap-1.5">
                {permissions.map((p) => (
                  <Badge key={p} label={p} color="slate" />
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Sidebar derecho */}
        <div className="space-y-5">
          {/* Rol */}
          <SectionCard title="Rol">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.15)' }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="rgba(165,180,252,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white leading-none">{user.role?.name ?? '—'}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Rol del sistema</p>
              </div>
            </div>
          </SectionCard>

          {/* Cargos */}
          {jobTitles.length > 0 && (
            <SectionCard title="Cargos">
              <div className="space-y-2">
                {jobTitles.map((jt: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'rgba(251,191,36,0.7)' }} />
                    <span className="text-[12px] text-white/65">
                      {jt.jobTitle?.name ?? jt.name ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Campus */}
          {campus && (
            <SectionCard title="Campus">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(20,184,166,0.12)' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="rgba(94,234,212,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white leading-none">{campus.name}</p>
                  {campus.address && <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{campus.address}</p>}
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
