'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth.store';
import { useUpdateUser, useUploadUserAvatar } from '@/hooks/useUsers';
import { useActiveCampuses } from '@/hooks/useCampus';
import { useOnboardingList, type OnboardingTeam } from '@/hooks/useOnboarding';
import { useActiveArmCatalogos } from '@/hooks/useArmCatalogos';
import { usePermissions } from '@/hooks/usePermissions';
import type { UserGender, MinisterialTitle, ServingStatus } from '@/types/user';
import { displayName, MINISTERIAL_LABEL } from '@/types/user';
import { CHANNEL_OPTIONS, SERVING_OPTIONS, INVITED_VALUE, OTHER_AREA_VALUE } from '@/types/onboarding';
import { COUNTRIES } from '@/components/CountryPicker';

// ── Mis Onboardings ─────────────────────────────────────────────────────────────

function OnboardingCard({ team }: { team: OnboardingTeam }) {
  return (
    <Link
      href={`/dashboard/bienvenida/${team.slug}`}
      className="group flex items-center gap-3 px-3.5 py-3 rounded-lg transition-all hover:bg-white/5"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: team.color ? `${team.color}22` : 'rgba(99,102,241,0.15)' }}
      >
        {team.emoji ?? '👋'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white truncate">{team.teamName}</p>
        {team.welcomeTitle && <p className="text-[11px] text-white/40 truncate mt-0.5">{team.welcomeTitle}</p>}
      </div>
      <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}

// ── Labels ────────────────────────────────────────────────────────────────────

const PERMISSION_LABELS: Record<string, string> = {
  'orgchart:view':    'Ver organigrama',
  'orgchart:manage':  'Gestionar organigrama',
  'users:view':       'Ver usuarios',
  'users:manage':     'Gestionar usuarios',
  'content:view':     'Ver noticias',
  'content:manage':   'Gestionar noticias',
  'documents:view':   'Ver documentos',
  'documents:manage': 'Gestionar documentos',
  'directory:view':   'Ver directorio',
  'directory:manage': 'Gestionar directorio',
  'roles:manage':     'Gestionar roles',
  'campus:manage':    'Gestionar campus',
  'fichas:view':      'Ver fichas técnicas',
  'fichas:edit':      'Editar fichas técnicas',
  'fichas:create':    'Crear fichas técnicas',
  'fichas:admin':     'Administrar fichas técnicas',
};

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

const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Sin especificar' },
  ...COUNTRIES.map((c) => ({ value: c, label: c })),
];

const STATUS_LABELS: Record<string, string> = {
  active:    'Activo',
  inactive:  'Inactivo',
  suspended: 'Suspendido',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 60 }, (_, i) => CURRENT_YEAR - i);

function formatMonthYear(ym: string | null | undefined): string {
  if (!ym) return '—';
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return '—';
  return `${MONTH_NAMES[m - 1]} de ${y}`;
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d     = new Date(dateStr);
  const now   = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (months < 1)  return 'hace menos de un mes';
  if (months === 1) return 'hace 1 mes';
  if (months < 12) return `hace ${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'hace 1 año' : `hace ${years} años`;
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function Avatar({ avatarUrl, initials, size = 20 }: { avatarUrl?: string | null; initials: string; size?: number }) {
  const px = `${size * 4}px`;
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="avatar" className="rounded-full object-cover flex-shrink-0" style={{ width: px, height: px }} />;
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{ width: px, height: px, background: 'rgba(99,102,241,0.2)', color: 'rgba(165,180,252,0.9)', fontSize: `${size * 1.2}px` }}>
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
    green:  'bg-emerald-950/60 text-emerald-300 border-emerald-800/50',
    red:    'bg-red-950/60 text-red-300 border-red-800/50',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[color] ?? colors.slate}`}>
      {label}
    </span>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border" style={{ background: '#111', borderColor: '#1f1f1f' }}>
      <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid #1f1f1f' }}>
        {icon && <span style={{ color: 'rgba(255,255,255,0.25)' }}>{icon}</span>}
        <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-1.5" style={{ borderBottom: '1px solid #1a1a1a' }}>
      <span className="text-[11px] w-32 flex-shrink-0 pt-0.5 leading-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
      <span className={`text-[12px] text-white/75 flex-1 leading-normal ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-[13px] text-white outline-none"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }} />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-[13px] text-white outline-none appearance-none"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        {options.map((o) => <option key={o.value} value={o.value} style={{ background: '#1a1a1a' }}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PerfilPage() {
  const { user, updateUser } = useAuthStore();
  const updateMutation = useUpdateUser();
  const uploadMutation = useUploadUserAvatar();
  const { data: campuses = [] } = useActiveCampuses();
  const { isAdmin, can } = usePermissions();
  const { data: onboardingTeams = [], isLoading: loadingOnboarding } = useOnboardingList();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName:     '',
    lastName:      '',
    preferredName: '',
    phone:         '',
    country:       '',
    bio:           '',
    birthDate:     '',
    gender:        '' as UserGender | '',
  });

  // Historia y participación (cómo llegó, quién lo invitó, si sirve, áreas
  // de interés) — mismos datos que pide el wizard de bienvenida, editables
  // acá después. Se editan como grupo, igual que el Panel 1.
  const [editingHistory, setEditingHistory] = useState(false);
  const [savingHistory,  setSavingHistory]  = useState(false);
  const [historyForm, setHistoryForm] = useState({
    referralChannel: '',
    referredByName:  '',
    servingStatus:   '' as ServingStatus | '',
    interestAreas:   [] as string[],
    otherAreaText:   '',
  });
  const { data: areaOptions = [] } = useActiveArmCatalogos('voluntarios');

  // Campus (panel organizacional) — edición independiente
  const [editingCampus, setEditingCampus] = useState(false);
  const [campusForm,    setCampusForm]    = useState('');
  const [savingCampus,  setSavingCampus]  = useState(false);

  // Antigüedad / mes-año de ingreso (panel organizacional) — edición independiente
  const [editingMemberSince, setEditingMemberSince] = useState(false);
  const [memberSinceMonth,   setMemberSinceMonth]   = useState('');
  const [memberSinceYear,    setMemberSinceYear]    = useState('');
  const [savingMemberSince,  setSavingMemberSince]  = useState(false);

  // Correo (panel de cuenta) — edición independiente
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailForm,    setEmailForm]    = useState('');
  const [savingEmail,  setSavingEmail]  = useState(false);
  const [emailError,   setEmailError]   = useState('');

  // Cambiar contraseña (panel de cuenta)
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [savingPassword,   setSavingPassword]   = useState(false);
  const [passwordError,    setPasswordError]    = useState('');
  const [passwordSaved,    setPasswordSaved]    = useState(false);

  const initials = user
    ? ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() || '??'
    : '??';

  function startEdit() {
    setForm({
      firstName:     user?.firstName     ?? '',
      lastName:      user?.lastName      ?? '',
      preferredName: user?.preferredName ?? '',
      phone:         user?.phone         ?? '',
      country:       user?.country       ?? '',
      bio:           user?.bio           ?? '',
      birthDate:     user?.birthDate     ?? '',
      gender:        (user?.gender       ?? '') as UserGender | '',
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateMutation.mutateAsync({
        id: user.id,
        data: {
          firstName:     form.firstName,
          lastName:      form.lastName,
          preferredName: form.preferredName || undefined,
          phone:         form.phone    || undefined,
          country:       form.country  || undefined,
          bio:           form.bio      || undefined,
          birthDate:     form.birthDate || null,
          gender:        (form.gender as UserGender) || null,
        },
      });
      updateUser({
        firstName:     updated.firstName,
        lastName:      updated.lastName,
        preferredName: updated.preferredName,
        phone:         updated.phone,
        country:       updated.country,
        bio:           updated.bio,
        birthDate:     updated.birthDate,
        gender:        updated.gender,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function startEditHistory() {
    setHistoryForm({
      referralChannel: user?.referralChannel ?? '',
      referredByName:  user?.referredByName  ?? '',
      servingStatus:   (user?.servingStatus  ?? '') as ServingStatus | '',
      interestAreas:   user?.interestAreas   ?? [],
      otherAreaText:   user?.otherAreaText   ?? '',
    });
    setEditingHistory(true);
  }

  function toggleHistoryArea(value: string) {
    setHistoryForm((f) => {
      const has = f.interestAreas.includes(value);
      const interestAreas = has ? f.interestAreas.filter((v) => v !== value) : [...f.interestAreas, value];
      return { ...f, interestAreas, otherAreaText: value === OTHER_AREA_VALUE && has ? '' : f.otherAreaText };
    });
  }

  async function handleSaveHistory() {
    if (!user) return;
    setSavingHistory(true);
    try {
      const updated = await updateMutation.mutateAsync({
        id: user.id,
        data: {
          referralChannel: historyForm.referralChannel || undefined,
          referredByName:  historyForm.referralChannel === INVITED_VALUE ? (historyForm.referredByName || undefined) : undefined,
          servingStatus:   (historyForm.servingStatus as ServingStatus) || undefined,
          interestAreas:   historyForm.interestAreas,
          otherAreaText:   historyForm.interestAreas.includes(OTHER_AREA_VALUE) ? (historyForm.otherAreaText || undefined) : undefined,
        },
      });
      updateUser({
        referralChannel: updated.referralChannel,
        referredByName:  updated.referredByName,
        servingStatus:   updated.servingStatus,
        interestAreas:   updated.interestAreas,
        otherAreaText:   updated.otherAreaText,
      });
      setEditingHistory(false);
    } finally {
      setSavingHistory(false);
    }
  }

  function startEditCampus() {
    setCampusForm(user?.campusId != null ? String(user.campusId) : '');
    setEditingCampus(true);
  }

  async function handleSaveCampus() {
    if (!user) return;
    setSavingCampus(true);
    try {
      const campusIdVal = campusForm ? parseInt(campusForm, 10) : null;
      const updated = await updateMutation.mutateAsync({ id: user.id, data: { campusId: campusIdVal } });
      updateUser({ campus: updated.campus, campusId: updated.campusId });
      setEditingCampus(false);
    } finally {
      setSavingCampus(false);
    }
  }

  function startEditMemberSince() {
    const base = user?.memberSince ?? (user?.createdAt ? user.createdAt.slice(0, 7) : '');
    const [y, m] = base ? base.split('-') : ['', ''];
    setMemberSinceYear(y ?? '');
    setMemberSinceMonth(m ? String(Number(m)) : '');
    setEditingMemberSince(true);
  }

  async function handleSaveMemberSince() {
    if (!user) return;
    setSavingMemberSince(true);
    try {
      const value = memberSinceYear && memberSinceMonth
        ? `${memberSinceYear}-${memberSinceMonth.padStart(2, '0')}`
        : null;
      const updated = await updateMutation.mutateAsync({ id: user.id, data: { memberSince: value } });
      updateUser({ memberSince: updated.memberSince });
      setEditingMemberSince(false);
    } finally {
      setSavingMemberSince(false);
    }
  }

  function startEditEmail() {
    setEmailForm(user?.email ?? '');
    setEmailError('');
    setEditingEmail(true);
  }

  async function handleSaveEmail() {
    if (!user) return;
    setEmailError('');
    if (!emailForm.trim()) { setEmailError('El correo es obligatorio.'); return; }
    setSavingEmail(true);
    try {
      const updated = await updateMutation.mutateAsync({ id: user.id, data: { email: emailForm.trim() } });
      updateUser({ email: updated.email });
      setEditingEmail(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'No se pudo actualizar el correo.';
      setEmailError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSavingEmail(false);
    }
  }

  function startChangePassword() {
    setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setPasswordSaved(false);
    setChangingPassword(true);
  }

  async function handleSavePassword() {
    if (!user) return;
    setPasswordError('');
    if (newPassword.length < 6) { setPasswordError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Las contraseñas no coinciden.'); return; }
    setSavingPassword(true);
    try {
      await updateMutation.mutateAsync({ id: user.id, data: { password: newPassword } });
      setPasswordSaved(true);
      setNewPassword(''); setConfirmPassword('');
      setTimeout(() => { setChangingPassword(false); setPasswordSaved(false); }, 1200);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'No se pudo cambiar la contraseña.';
      setPasswordError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSavingPassword(false);
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
  const campus                = (user as any).campus;

  const campusOptions = [
    { value: '', label: 'Sin campus' },
    ...campuses.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const statusColor = user.status === 'active' ? 'green' : user.status === 'suspended' ? 'red' : 'slate';

  // Calcular edad si hay birthDate
  const age = user.birthDate
    ? Math.floor((Date.now() - new Date(user.birthDate + 'T12:00:00').getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>

      {/* ── Header / Hero ── */}
      <div className="relative">
        {/* Banner con breadcrumb y estado */}
        <div className="relative h-28 w-full" style={{ background: 'linear-gradient(135deg, #1a1030 0%, #0f1a2e 50%, #0a1a15 100%)' }}>
          <div className="absolute inset-x-0 top-0 px-8 pt-4 flex items-center justify-between">
            <Link href="/dashboard"
              className="inline-flex items-center gap-1.5 text-[12px] transition-colors"
              style={{ color: 'rgba(255,255,255,0.35)' }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              onMouseOut={(e)  => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Inicio
            </Link>
            <Badge label={STATUS_LABELS[user.status ?? ''] ?? user.status ?? '—'} color={statusColor} />
          </div>
        </div>

        <div className="px-8 pb-6">
          <div className="flex items-start gap-5">
            {/* Avatar flotando sobre el banner */}
            <div className="relative group flex-shrink-0 -mt-11">
              <Avatar avatarUrl={user.avatarUrl} initials={initials} size={22} />
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
              <input ref={fileInputRef} type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* Nombre y correo, en flujo normal debajo del banner (sin solaparse con él) */}
            <div className="pt-3 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-[22px] font-bold text-white leading-tight">
                  {displayName(user)}
                </h1>
                {user.role?.name && <Badge label={user.role.name} color="indigo" />}
              </div>
              <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{user.email}</p>
              {avatarError && <p className="text-[11px] mt-1.5 text-red-400">{avatarError}</p>}
            </div>
          </div>
        </div>

        <div style={{ borderBottom: '1px solid #1a1a1a' }} />
      </div>

      {/* ── Contenido: 3 paneles principales ── */}
      <div className="px-8 py-7 grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-6xl">

        {/* Panel 1 — Información personal */}
        <SectionCard title="Información personal" icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        }>
          {editing ? (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="Nombre" value={form.firstName} onChange={(v) => setForm((f) => ({ ...f, firstName: v }))} />
                <FieldInput label="Apellido" value={form.lastName} onChange={(v) => setForm((f) => ({ ...f, lastName: v }))} />
              </div>
              <FieldInput label="Nombre preferido" value={form.preferredName} onChange={(v) => setForm((f) => ({ ...f, preferredName: v }))} placeholder="Cómo quieres que te llamemos en la app" />
              <FieldInput label="Fecha de nacimiento" value={form.birthDate} onChange={(v) => setForm((f) => ({ ...f, birthDate: v }))} type="date" />
              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="Teléfono" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+56 9 xxxx xxxx" />
                <FieldSelect label="País" value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} options={COUNTRY_OPTIONS} />
              </div>
              <FieldSelect label="Género" value={form.gender as string}
                onChange={(v) => setForm((f) => ({ ...f, gender: v as UserGender | '' }))}
                options={GENDER_OPTIONS} />
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Biografía</label>
                <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3} className="w-full px-3 py-2 rounded-lg text-[13px] text-white outline-none resize-none"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
                  placeholder="Cuéntanos algo sobre ti…" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: '#2563eb' }}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button onClick={() => setEditing(false)} disabled={saving}
                  className="px-4 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white/70 transition-all"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="space-y-0 divide-y divide-[#1a1a1a]">
                <Row label="Nombre completo" value={displayName(user)} />
                <Row label="Nombre preferido" value={user.preferredName || '—'} />
                <Row label="Nacimiento"
                  value={user.birthDate ? `${formatDate(user.birthDate)}${age !== null ? ` (${age} años)` : ''}` : '—'} />
                <Row label="Teléfono" value={user.phone || '—'} />
                <Row label="País"     value={user.country || '—'} />
                <Row label="Género"   value={user.gender ? (GENDER_LABELS[user.gender as UserGender] ?? user.gender) : '—'} />
                <div className="py-3">
                  <p className="text-[11px] mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Biografía</p>
                  <p className="text-[13px] text-white/65 leading-relaxed">{user.bio || '—'}</p>
                </div>
              </div>
              <div className="pt-4">
                <button onClick={startEdit}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white/50 hover:text-white transition-all"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
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

        {/* Panel 2 — Información organizacional */}
        <SectionCard title="Información organizacional" icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
        }>
          <div className="space-y-4">
            {/* Cargos */}
            <div>
              <p className="text-[10px] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Cargos</p>
              {jobTitles.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {jobTitles.map((jt: any, i: number) => (
                    <span key={i}
                      title={jt.source === 'orgchart' ? 'Cargo del organigrama' : undefined}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{ background: 'rgba(251,191,36,0.12)', color: 'rgba(251,191,36,0.9)', border: '1px solid rgba(251,191,36,0.2)' }}>
                      {jt.source === 'orgchart' && (
                        <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="11" width="14" height="9" rx="2" ry="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                        </svg>
                      )}
                      {jt.jobTitle?.name ?? jt.name ?? '—'}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Sin cargos asignados</p>
              )}
            </div>

            {/* Nombramiento ministerial */}
            {user.ministerialTitle && (
              <div>
                <p className="text-[10px] font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Nombramiento ministerial</p>
                <p className="text-[13px] font-semibold text-white">
                  {MINISTERIAL_LABEL[user.ministerialTitle as MinisterialTitle] ?? user.ministerialTitle}
                </p>
              </div>
            )}

            {/* Campus */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Campus</p>
                {!editingCampus && (
                  <button onClick={startEditCampus} className="text-[10px] font-medium text-white/30 hover:text-white/60 transition-colors">
                    Cambiar
                  </button>
                )}
              </div>
              {editingCampus ? (
                <div className="flex items-center gap-2 mt-1">
                  <select value={campusForm} onChange={(e) => setCampusForm(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-[12.5px] text-white outline-none appearance-none"
                    style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                    {campusOptions.map((o) => <option key={o.value} value={o.value} style={{ background: '#1a1a1a' }}>{o.label}</option>)}
                  </select>
                  <button onClick={handleSaveCampus} disabled={savingCampus}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-50" style={{ background: '#2563eb' }}>
                    {savingCampus ? '…' : 'OK'}
                  </button>
                  <button onClick={() => setEditingCampus(false)} disabled={savingCampus}
                    className="px-2 py-1.5 rounded-lg text-[11px] text-white/40 hover:text-white/70 transition-all">
                    ✕
                  </button>
                </div>
              ) : (
                <p className="text-[13px] font-semibold text-white">{campus?.name ?? 'Sin campus asignado'}</p>
              )}
            </div>

            {/* Antigüedad */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>En la organización desde</p>
                {!editingMemberSince && (
                  <button onClick={startEditMemberSince} className="text-[10px] font-medium text-white/30 hover:text-white/60 transition-colors">
                    Cambiar
                  </button>
                )}
              </div>
              {editingMemberSince ? (
                <div className="space-y-2 mt-1">
                  <div className="flex items-center gap-2">
                    <select value={memberSinceMonth} onChange={(e) => setMemberSinceMonth(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] text-white outline-none appearance-none"
                      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                      <option value="" style={{ background: '#1a1a1a' }}>Mes</option>
                      {MONTH_NAMES.map((name, i) => (
                        <option key={name} value={String(i + 1)} style={{ background: '#1a1a1a' }}>
                          {name.charAt(0).toUpperCase() + name.slice(1)}
                        </option>
                      ))}
                    </select>
                    <select value={memberSinceYear} onChange={(e) => setMemberSinceYear(e.target.value)}
                      className="w-24 px-2.5 py-1.5 rounded-lg text-[12.5px] text-white outline-none appearance-none"
                      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                      <option value="" style={{ background: '#1a1a1a' }}>Año</option>
                      {YEAR_OPTIONS.map((y) => (
                        <option key={y} value={String(y)} style={{ background: '#1a1a1a' }}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveMemberSince} disabled={savingMemberSince || !memberSinceMonth || !memberSinceYear}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-50" style={{ background: '#2563eb' }}>
                      {savingMemberSince ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button onClick={() => setEditingMemberSince(false)} disabled={savingMemberSince}
                      className="px-3 py-1.5 rounded-lg text-[11px] text-white/40 hover:text-white/70 transition-all"
                      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : user.memberSince ? (
                <>
                  <p className="text-[13px] text-white/75 capitalize">{formatMonthYear(user.memberSince)}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{timeAgo(user.memberSince)}</p>
                </>
              ) : (
                <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Sin especificar</p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Panel 3 — Información de la cuenta */}
        <SectionCard title="Información de la cuenta" icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          </svg>
        }>
          <div className="space-y-4">
            {/* Rol + estado */}
            <div>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Rol y estado</p>
              <div className="flex items-center gap-2">
                <Badge label={user.role?.name ?? '—'} color="indigo" />
                <Badge label={STATUS_LABELS[user.status ?? ''] ?? user.status ?? '—'} color={statusColor} />
              </div>
            </div>

            {/* Correo */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Correo</p>
                {!editingEmail && (
                  <button onClick={startEditEmail} className="text-[10px] font-medium text-white/30 hover:text-white/60 transition-colors">
                    Cambiar
                  </button>
                )}
              </div>
              {editingEmail ? (
                <div className="space-y-1.5 mt-1">
                  <div className="flex items-center gap-2">
                    <input type="email" value={emailForm} onChange={(e) => setEmailForm(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg text-[12.5px] text-white outline-none"
                      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }} />
                    <button onClick={handleSaveEmail} disabled={savingEmail}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-50" style={{ background: '#2563eb' }}>
                      {savingEmail ? '…' : 'OK'}
                    </button>
                    <button onClick={() => setEditingEmail(false)} disabled={savingEmail}
                      className="px-2 py-1.5 rounded-lg text-[11px] text-white/40 hover:text-white/70 transition-all">
                      ✕
                    </button>
                  </div>
                  {emailError && <p className="text-[11px] text-red-400">{emailError}</p>}
                </div>
              ) : (
                <p className="text-[13px] text-white/75 font-mono">{user.email}</p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <p className="text-[10px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Contraseña</p>
              {!changingPassword ? (
                <button onClick={startChangePassword}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white/50 hover:text-white transition-all"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                  Cambiar contraseña
                </button>
              ) : (
                <div className="space-y-2">
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nueva contraseña (mín. 6 caracteres)"
                    className="w-full px-3 py-1.5 rounded-lg text-[12.5px] text-white outline-none"
                    style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }} />
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmar contraseña"
                    className="w-full px-3 py-1.5 rounded-lg text-[12.5px] text-white outline-none"
                    style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }} />
                  {passwordError && <p className="text-[11px] text-red-400">{passwordError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleSavePassword} disabled={savingPassword}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-50"
                      style={{ background: passwordSaved ? '#1D9E75' : '#2563eb' }}>
                      {savingPassword ? 'Guardando…' : passwordSaved ? '✓ Cambiada' : 'Guardar'}
                    </button>
                    <button onClick={() => setChangingPassword(false)} disabled={savingPassword}
                      className="px-3 py-1.5 rounded-lg text-[11px] text-white/40 hover:text-white/70 transition-all"
                      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Permisos */}
            {permissions.length > 0 && (
              <div>
                <p className="text-[10px] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Permisos de acceso</p>
                <div className="flex flex-wrap gap-1.5">
                  {permissions.map((p) => (
                    <Badge key={p} label={PERMISSION_LABELS[p] ?? p} color="slate" />
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-3" style={{ borderTop: '1px solid #1a1a1a' }}>
              <p className="text-[10.5px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>ID #{user.id}</p>
              {user.updatedAt && (
                <p className="text-[10.5px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Última actualización: {formatDate(user.updatedAt)}
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Panel 4 — Historia y participación */}
        <SectionCard title="Historia y participación" icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        }>
          {editingHistory ? (
            <div className="space-y-3.5">
              <FieldSelect label="Cómo llegaste a ARM Global" value={historyForm.referralChannel}
                onChange={(v) => setHistoryForm((f) => ({ ...f, referralChannel: v }))}
                options={[{ value: '', label: 'Sin especificar' }, ...CHANNEL_OPTIONS]} />
              {historyForm.referralChannel === INVITED_VALUE && (
                <FieldInput label="Quién te invitó" value={historyForm.referredByName}
                  onChange={(v) => setHistoryForm((f) => ({ ...f, referredByName: v }))} placeholder="Escribe su nombre" />
              )}
              <FieldSelect label="¿Sirves actualmente?" value={historyForm.servingStatus}
                onChange={(v) => setHistoryForm((f) => ({ ...f, servingStatus: v as ServingStatus | '', interestAreas: v === 'yes' ? f.interestAreas : [] }))}
                options={[{ value: '', label: 'Sin especificar' }, ...SERVING_OPTIONS]} />
              {historyForm.servingStatus === 'yes' && (
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>En qué área sirves</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...areaOptions.map((o) => o.label), OTHER_AREA_VALUE].map((label) => {
                      const selected = historyForm.interestAreas.includes(label);
                      return (
                        <button key={label} type="button" onClick={() => toggleHistoryArea(label)}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                          style={{
                            background: selected ? 'rgba(37,99,235,0.18)' : '#1a1a1a',
                            border: `1px solid ${selected ? 'rgba(37,99,235,0.5)' : '#2a2a2a'}`,
                            color: selected ? '#93c5fd' : 'rgba(255,255,255,0.5)',
                          }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {historyForm.interestAreas.includes(OTHER_AREA_VALUE) && (
                    <input value={historyForm.otherAreaText} onChange={(e) => setHistoryForm((f) => ({ ...f, otherAreaText: e.target.value }))}
                      placeholder="Escribe el área" className="w-full mt-2 px-3 py-2 rounded-lg text-[13px] text-white outline-none"
                      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }} />
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveHistory} disabled={savingHistory}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: '#2563eb' }}>
                  {savingHistory ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button onClick={() => setEditingHistory(false)} disabled={savingHistory}
                  className="px-4 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white/70 transition-all"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="space-y-0 divide-y divide-[#1a1a1a]">
                <Row label="Cómo llegaste"
                  value={CHANNEL_OPTIONS.find((o) => o.value === user.referralChannel)?.label ?? '—'} />
                {user.referralChannel === INVITED_VALUE && (
                  <Row label="Quién lo invitó" value={user.referredByName || '—'} />
                )}
                <Row label="¿Sirve actualmente?"
                  value={SERVING_OPTIONS.find((o) => o.value === user.servingStatus)?.label ?? '—'} />
                {user.servingStatus === 'yes' && (
                  <div className="py-3">
                    <p className="text-[11px] mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>En qué área sirve</p>
                    {user.interestAreas && user.interestAreas.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {user.interestAreas.map((a) => (
                          <Badge key={a} label={a === OTHER_AREA_VALUE && user.otherAreaText ? user.otherAreaText : a} color="teal" />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-white/65">—</p>
                    )}
                  </div>
                )}
              </div>
              <div className="pt-4">
                <button onClick={startEditHistory}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white/50 hover:text-white transition-all"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Editar
                </button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Mis Onboardings */}
        {(isAdmin || can('onboarding:view')) && (
          <div className="lg:col-span-3">
            <SectionCard title="Mis Onboardings" icon={
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            }>
              {loadingOnboarding ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }} />
                  ))}
                </div>
              ) : onboardingTeams.length === 0 ? (
                <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {isAdmin ? 'No hay onboardings creados aún.' : 'No tienes onboardings asignados aún.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {onboardingTeams.map((team) => (
                    <OnboardingCard key={team.id} team={team} />
                  ))}
                </div>
              )}
              {isAdmin && (
                <div className="pt-4">
                  <Link href="/dashboard/bienvenida/admin"
                    className="flex items-center gap-1.5 w-fit px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white/50 hover:text-white transition-all"
                    style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Gestionar onboardings
                  </Link>
                </div>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
