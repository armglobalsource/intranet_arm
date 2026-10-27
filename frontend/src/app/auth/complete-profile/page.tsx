'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { api, apiErrorMessage } from '@/lib/api';
import type { ServingStatus } from '@/types/user';
import { INVITED_VALUE, CHANNEL_OPTIONS, SERVING_OPTIONS, OTHER_AREA_VALUE } from '@/types/onboarding';

// ── Datos estáticos del wizard ─────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: '+56',  flag: '🇨🇱', name: 'Chile',           example: '9 1234 5678'   },
  { code: '+54',  flag: '🇦🇷', name: 'Argentina',        example: '11 2345 6789'  },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay',          example: '99 123 456'    },
  { code: '+1',   flag: '🇺🇸', name: 'Estados Unidos',   example: '832 555 0123'  },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela',        example: '412 123 4567'  },
  { code: '+57',  flag: '🇨🇴', name: 'Colombia',         example: '300 123 4567'  },
  { code: '+51',  flag: '🇵🇪', name: 'Perú',             example: '912 345 678'   },
  { code: '+52',  flag: '🇲🇽', name: 'México',           example: '55 1234 5678'  },
  { code: '+34',  flag: '🇪🇸', name: 'España',           example: '612 345 678'   },
];

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type StepKey = 'name' | 'gender' | 'birthday' | 'phone' | 'password' | 'channel' | 'inviter' | 'member-since' | 'campus' | 'serving' | 'areas' | 'consent';

interface Answers {
  preferredName:     string;
  gender:            'male' | 'female' | '';
  birthDay:          string;
  birthMonth:        string;
  birthYear:         string;
  phoneCountryCode:  string;
  phone:             string;
  password:          string;
  referralChannel:   string;
  referredByName:    string;
  memberSinceMonth:  string;
  memberSinceYear:   string;
  campusId:          string;
  servingStatus:     ServingStatus | '';
  interestAreas:     string[];
  otherAreaText:     string;
  consentAccepted:   boolean;
}

const EMPTY_ANSWERS: Answers = {
  preferredName: '', gender: '', birthDay: '', birthMonth: '', birthYear: '',
  phoneCountryCode: '+56', phone: '', password: '',
  referralChannel: '', referredByName: '',
  memberSinceMonth: '', memberSinceYear: '', campusId: '',
  servingStatus: '',
  interestAreas: [], otherAreaText: '', consentAccepted: false,
};

function pad2(v: string) { return v.padStart(2, '0'); }

/** Rellena las respuestas necesarias para calcular la categoría a partir de
 * un usuario ya guardado — para cuando una cuenta pending vuelve a esta
 * página (ya llenó el wizard antes, solo falta que la aprueben). */
function seedFromUser(u: any): Partial<Answers> {
  const patch: Partial<Answers> = {};
  if (u?.preferredName || u?.firstName) patch.preferredName = u.preferredName || u.firstName;
  if (u?.servingStatus) patch.servingStatus = u.servingStatus;
  if (u?.memberSince) {
    const [y, m] = String(u.memberSince).split('-');
    if (y && m) { patch.memberSinceYear = y; patch.memberSinceMonth = String(Number(m)); }
  }
  return patch;
}

function activeSteps(a: Answers, hasPassword: boolean): StepKey[] {
  const keys: StepKey[] = ['name', 'gender', 'birthday', 'phone'];
  if (!hasPassword) keys.push('password');
  keys.push('channel');
  if (a.referralChannel === INVITED_VALUE) keys.push('inviter');
  keys.push('member-since', 'campus', 'serving');
  if (a.servingStatus === 'yes') keys.push('areas');
  keys.push('consent');
  return keys;
}

function validateStep(key: StepKey, a: Answers): string | null {
  switch (key) {
    case 'name':
      return a.preferredName.trim() ? null : 'Escribe el nombre que quieres usar en la app.';
    case 'birthday': {
      if (!a.birthDay || !a.birthMonth || !a.birthYear) return 'Selecciona tu fecha de nacimiento.';
      const d = new Date(Number(a.birthYear), Number(a.birthMonth) - 1, Number(a.birthDay));
      if (d > new Date()) return 'La fecha de nacimiento no puede estar en el futuro.';
      return null;
    }
    case 'phone': {
      const digits = a.phone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) return 'Ingresa un número de teléfono válido.';
      return null;
    }
    case 'password':
      return a.password.length >= 6 ? null : 'Mínimo 6 caracteres.';
    case 'channel':
      return a.referralChannel ? null : 'Selecciona cómo llegaste a ARM Global.';
    case 'member-since': {
      if (!a.memberSinceMonth || !a.memberSinceYear) return 'Indica aproximadamente hace cuánto eres parte de ARM Global.';
      const today = new Date();
      const sel = Number(a.memberSinceYear) * 12 + Number(a.memberSinceMonth);
      const cur = today.getFullYear() * 12 + today.getMonth() + 1;
      if (sel > cur) return 'Esa fecha no puede estar en el futuro.';
      return null;
    }
    case 'campus':
      return a.campusId ? null : 'Selecciona tu campus principal.';
    case 'serving':
      return a.servingStatus ? null : 'Selecciona tu situación actual de servicio.';
    case 'areas': {
      if (!a.interestAreas.length) return 'Selecciona al menos un área.';
      if (a.interestAreas.includes(OTHER_AREA_VALUE) && !a.otherAreaText.trim()) return 'Escribe el nombre de la otra área.';
      return null;
    }
    case 'consent':
      return a.consentAccepted ? null : 'Debes aceptar las políticas para finalizar.';
    default:
      return null;
  }
}

interface ServiceLevel {
  name: string;
  stars: number;
  material: 'none' | 'silver' | 'gold' | 'diamond';
  detail: string;
}

/** Calcula la categoría según antigüedad como parte de la iglesia (memberSince),
 * no según servingStatus — alguien puede llevar años en ARM Global sin servir. */
function computeServiceLevel(a: Answers): ServiceLevel {
  if (!a.memberSinceMonth || !a.memberSinceYear) {
    return { name: 'Conectando', stars: 0, material: 'none', detail: 'Cada historia comienza conectando con la comunidad.' };
  }
  const year = Number(a.memberSinceYear);
  const month = Number(a.memberSinceMonth);
  const today = new Date();
  const months = (today.getFullYear() - year) * 12 + (today.getMonth() + 1 - month);
  if (months < 6)  return { name: 'Primer paso', stars: 1, material: 'silver', detail: 'Tus primeros meses en ARM Global son el comienzo de una gran historia.' };
  if (months < 18) return { name: 'En marcha',   stars: 2, material: 'silver', detail: 'Ya eres parte activa de esta comunidad.' };
  if (months < 36) return { name: 'Constante',   stars: 3, material: 'gold',   detail: 'Tu presencia constante fortalece a tu equipo y a todo el campus.' };
  if (months < 60) return { name: 'Inspirando',  stars: 4, material: 'gold',   detail: 'Gracias por inspirar a otros con tu constancia.' };
  return { name: 'Legado', stars: 5, material: 'diamond', detail: 'Tu trayectoria es parte viva de la historia de ARM Global.' };
}

const MATERIAL_COLOR: Record<ServiceLevel['material'], string> = {
  none: '#52675a', silver: '#64756b', gold: '#8a630c', diamond: '#176986',
};
const MATERIAL_LABEL: Record<ServiceLevel['material'], string> = {
  none: '', silver: 'Plata', gold: 'Oro', diamond: 'Diamante',
};

function Star({ color }: { color: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill={color}>
      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.86L12 17.77l-6.18 3.23L7 14.14 2 9.27l7.1-1.01L12 2z" />
    </svg>
  );
}

// ── Estilos compartidos de acceso ─────────────

const inputStyle: React.CSSProperties = { background: '#fff', border: '1px solid #cdd6d0', color: '#182d25' };
const inputClass = 'w-full px-3.5 py-2.5 rounded-lg text-sm min-h-[50px] text-base placeholder:text-[#77857e] focus:outline-none focus:border-[#315e49] focus:ring-2 focus:ring-[#315e49]/20 transition-colors';

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block text-xs font-medium text-[#607068] mb-1.5 uppercase tracking-wide">
      {children} {optional && <span className="text-[#7a897e] normal-case font-normal">(opcional)</span>}
    </label>
  );
}

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? '#e9f2ec' : '#fff',
        border: `1px solid ${selected ? '#315e49' : '#cdd6d0'}`,
      }}
      className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm text-[#182d25] transition-all active:scale-[0.99]"
    >
      {children}
    </button>
  );
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#f7f8f7', colorScheme: 'light' }}>
    <span className="w-6 h-6 border-2 border-[#b9d2c2] border-t-[#204b39] rounded-full animate-spin" />
  </div>
);

// ── Wizard ──────────────────────────────────────────────────────────────────

function CompleteProfileInner() {
  const router                 = useRouter();
  const logout                 = useAuthStore((s) => s.logout);
  const setTokens              = useAuthStore((s) => s.setTokens);
  const updateUser             = useAuthStore((s) => s.updateUser);
  const clearProfileCompletion = useAuthStore((s) => s.clearProfileCompletion);
  const storeAccess            = useAuthStore((s) => s.accessToken);
  const storeRefresh           = useAuthStore((s) => s.refreshToken);
  const storeUser              = useAuthStore((s) => s.user);
  const hasHydrated            = useAuthStore((s) => s._hasHydrated);

  // Sin login con Google, toda cuenta que llega acá ya tiene contraseña.
  const hasPassword = true;
  const [loading, setLoading]         = useState(true);
  const [showPwd, setShowPwd]         = useState(false);

  const [currentKey, setCurrentKey] = useState<StepKey | 'intro' | 'result'>('intro');
  const [answers, setAnswers]       = useState<Answers>(EMPTY_ANSWERS);
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [campuses, setCampuses]     = useState<{ id: number; name: string }[]>([]);
  const [areaOptions, setAreaOptions] = useState<{ key: string; label: string }[]>([]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!storeAccess || !storeRefresh) { router.replace('/auth/login'); return; }

    setAnswers((a) => ({ ...a, ...seedFromUser(storeUser) }));
    // Cuenta pending que ya llenó el wizard antes: saltar directo al
    // resultado con el mensaje de "espera aprobación", no repetir todo.
    if (storeUser?.status === 'pending' && storeUser?.onboardingCompletedAt) setCurrentKey('result');
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, storeAccess, storeRefresh, router]);

  useEffect(() => {
    if (loading) return;
    api.get('/campus/active').then((r) => setCampuses(r.data)).catch(() => {});
    api.get('/arm-catalogos/active', { params: { tipo: 'voluntarios' } }).then((r) => setAreaOptions(r.data)).catch(() => {});
  }, [loading]);

  const today = useMemo(() => new Date(), []);
  const birthDaysInMonth = useMemo(() => {
    if (!answers.birthMonth) return 31;
    const year = Number(answers.birthYear) || today.getFullYear();
    return new Date(year, Number(answers.birthMonth), 0).getDate();
  }, [answers.birthMonth, answers.birthYear, today]);

  const steps = activeSteps(answers, hasPassword);
  const questionIndex = steps.indexOf(currentKey as StepKey);
  const isIntro  = currentKey === 'intro';
  const isResult = currentKey === 'result';

  function patch(p: Partial<Answers>) {
    setAnswers((a) => ({ ...a, ...p }));
  }

  function toggleArea(value: string) {
    setAnswers((a) => {
      const has = a.interestAreas.includes(value);
      const interestAreas = has ? a.interestAreas.filter((v) => v !== value) : [...a.interestAreas, value];
      return { ...a, interestAreas, otherAreaText: value === OTHER_AREA_VALUE && has ? '' : a.otherAreaText };
    });
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        preferredName: answers.preferredName.trim(),
      };
      if (answers.gender) payload.gender = answers.gender;
      if (answers.phone.trim()) { payload.phone = answers.phone.trim(); payload.phoneCountryCode = answers.phoneCountryCode; }
      if (answers.birthDay && answers.birthMonth && answers.birthYear) {
        payload.birthDate = `${answers.birthYear}-${pad2(answers.birthMonth)}-${pad2(answers.birthDay)}`;
      }
      if (!hasPassword && answers.password) payload.password = answers.password;
      if (answers.referralChannel) payload.referralChannel = answers.referralChannel;
      if (answers.referralChannel === INVITED_VALUE && answers.referredByName.trim()) {
        payload.referredByName = answers.referredByName.trim();
      }
      if (answers.campusId) payload.campusId = Number(answers.campusId);
      if (answers.servingStatus) payload.servingStatus = answers.servingStatus;
      if (answers.memberSinceMonth && answers.memberSinceYear) {
        payload.memberSince = `${answers.memberSinceYear}-${pad2(answers.memberSinceMonth)}`;
      }
      payload.interestAreas = answers.interestAreas;
      if (answers.interestAreas.includes(OTHER_AREA_VALUE) && answers.otherAreaText.trim()) {
        payload.otherAreaText = answers.otherAreaText.trim();
      }
      payload.consentAccepted = answers.consentAccepted;

      const res = await api.post('/auth/complete-profile', payload);
      if (res.data.user) updateUser(res.data.user);
      clearProfileCompletion();
      if (res.data.accessToken) setTokens(res.data.accessToken, res.data.refreshToken);
      setCurrentKey('result');
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar tu información. Intenta de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  }

  function move(direction: 1 | -1) {
    if (direction > 0) {
      const err = validateStep(currentKey as StepKey, answers);
      if (err) { setError(err); return; }
    }
    setError('');

    if (isIntro && direction > 0) { setCurrentKey(steps[0]); return; }

    const idx = steps.indexOf(currentKey as StepKey);
    const targetIdx = idx + direction;

    if (currentKey === 'consent' && direction > 0) { submit(); return; }
    if (targetIdx < 0) { setCurrentKey('intro'); return; }
    setCurrentKey(steps[Math.max(0, Math.min(steps.length - 1, targetIdx))]);
  }

  if (!hasHydrated || loading) return <Spinner />;

  const level = computeServiceLevel(answers);
  const displayName = answers.preferredName.trim() || storeUser?.firstName || '';

  return (
    <div className="min-h-screen flex" style={{ background: '#f7f8f7', colorScheme: 'light' }}>

      {/* Panel izquierdo */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12" style={{ borderRight: '1px solid #e1e5e2', background: '#e9eeeb' }}>
        <Image src="/logo.png" alt="Logo" width={200} height={70} className="object-contain mb-10 brightness-0" priority />
        <p className="text-[#6b7b70] text-sm text-center max-w-xs leading-relaxed">
          Plataforma interna de ARM —<br />organigrama y directorio de personas
        </p>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 sm:p-8">
        <div className="w-full max-w-sm rounded-2xl border border-[#e1e7df] bg-white p-5 shadow-sm sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">

          <div className="flex justify-center mb-8 lg:hidden">
            <Image src="/logo.png" alt="Logo" width={140} height={48} className="object-contain brightness-0" priority />
          </div>

          {/* Barra de progreso */}
          {!isIntro && !isResult && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-[#6b7b70]">Bienvenida</span>
                <span className="text-[11px] text-[#6b7b70]">{questionIndex + 1} / {steps.length}</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: '#dce5df' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${((questionIndex + 1) / steps.length) * 100}%`, background: '#315e49' }} />
              </div>
            </div>
          )}

          {/* ── Intro ── */}
          {isIntro && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Bienvenida</p>
              <h1 className="text-2xl font-semibold text-[#182d25] mb-3">Queremos conocerte un poco mejor.</h1>
              <p className="text-sm text-[#607068] mb-8 leading-relaxed">
                Responderás una pregunta a la vez. Esto nos ayudará a personalizar tu experiencia y mantenernos conectados contigo.
              </p>
            </div>
          )}

          {/* ── Name ── */}
          {currentKey === 'name' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Sobre ti</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">¿Cómo quieres que te llamemos?</h2>
              <p className="text-sm text-[#607068] mb-6">Usaremos este nombre dentro de la app.</p>
              <FieldLabel>Nombre preferido</FieldLabel>
              <input
                autoFocus
                value={answers.preferredName}
                onChange={(e) => patch({ preferredName: e.target.value })}
                placeholder="Ej. Francisco"
                style={inputStyle} className={inputClass}
              />
            </div>
          )}

          {/* ── Gender ── */}
          {currentKey === 'gender' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Sobre ti</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">¿Con qué género te identificas?</h2>
              <p className="text-sm text-[#607068] mb-6">Puedes omitir esta pregunta si prefieres no responder.</p>
              <div className="flex flex-col gap-2">
                {([['male', 'Masculino'], ['female', 'Femenino']] as const).map(([v, label]) => (
                  <OptionCard key={v} selected={answers.gender === v} onClick={() => patch({ gender: v })}>{label}</OptionCard>
                ))}
              </div>
            </div>
          )}

          {/* ── Birthday ── */}
          {currentKey === 'birthday' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Sobre ti</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">¿Cuál es tu fecha de nacimiento?</h2>
              <p className="text-sm text-[#607068] mb-6">La usaremos para mantener actualizada nuestra base de cumpleaños.</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <FieldLabel>Día</FieldLabel>
                  <select value={answers.birthDay} onChange={(e) => patch({ birthDay: e.target.value })} style={inputStyle} className={inputClass}>
                    <option value="">Día</option>
                    {Array.from({ length: birthDaysInMonth }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Mes</FieldLabel>
                  <select value={answers.birthMonth} onChange={(e) => patch({ birthMonth: e.target.value })} style={inputStyle} className={inputClass}>
                    <option value="">Mes</option>
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Año</FieldLabel>
                  <select value={answers.birthYear} onChange={(e) => patch({ birthYear: e.target.value })} style={inputStyle} className={inputClass}>
                    <option value="">Año</option>
                    {Array.from({ length: 100 }, (_, i) => today.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Phone ── */}
          {currentKey === 'phone' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Contacto</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">¿Cuál es tu número de teléfono?</h2>
              <p className="text-sm text-[#607068] mb-6">Es para mantener las comunicaciones por WhatsApp y que nunca perdamos el contacto.</p>
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <div>
                  <FieldLabel>País</FieldLabel>
                  <select value={answers.phoneCountryCode} onChange={(e) => patch({ phoneCountryCode: e.target.value })} style={inputStyle} className={`${inputClass} w-auto`}>
                    {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Número</FieldLabel>
                  <input
                    autoFocus
                    value={answers.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                    inputMode="tel"
                    placeholder={COUNTRY_CODES.find((c) => c.code === answers.phoneCountryCode)?.example ?? 'Número local'}
                    style={inputStyle} className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Password ── */}
          {currentKey === 'password' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Acceso</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">Crea una contraseña.</h2>
              <p className="text-sm text-[#607068] mb-6">Así podrás entrar con tu email.</p>
              <FieldLabel>Contraseña</FieldLabel>
              <div className="relative">
                <input
                  autoFocus
                  type={showPwd ? 'text' : 'password'}
                  value={answers.password}
                  onChange={(e) => patch({ password: e.target.value })}
                  autoComplete="new-password"
                  style={inputStyle} className={`${inputClass} pr-10`}
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-[#6b7b70] hover:text-[#204b39] transition-colors">
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}

          {/* ── Channel ── */}
          {currentKey === 'channel' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Tu historia</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">¿Cómo llegaste a ARM Global?</h2>
              <p className="text-sm text-[#607068] mb-6">Selecciona la opción que mejor representa tu historia.</p>
              <div className="flex flex-col gap-2">
                {CHANNEL_OPTIONS.map((o) => (
                  <OptionCard key={o.value} selected={answers.referralChannel === o.value} onClick={() => patch({ referralChannel: o.value })}>{o.label}</OptionCard>
                ))}
              </div>
            </div>
          )}

          {/* ── Inviter ── */}
          {currentKey === 'inviter' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Tu historia</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">¿Quién te invitó?</h2>
              <p className="text-sm text-[#607068] mb-6">Es opcional. Nos ayuda a reconocer las conexiones que hacen crecer nuestra comunidad.</p>
              <FieldLabel optional>Nombre de la persona</FieldLabel>
              <input
                autoFocus
                value={answers.referredByName}
                onChange={(e) => patch({ referredByName: e.target.value })}
                placeholder="Escribe su nombre"
                style={inputStyle} className={inputClass}
              />
            </div>
          )}

          {/* ── Campus ── */}
          {/* ── Member since ── */}
          {currentKey === 'member-since' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Tu comunidad</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">¿Hace cuánto tiempo eres parte de ARM Global?</h2>
              <p className="text-sm text-[#607068] mb-6">Una fecha aproximada de cuándo llegaste a la iglesia es suficiente.</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Mes</FieldLabel>
                  <select value={answers.memberSinceMonth} onChange={(e) => patch({ memberSinceMonth: e.target.value })} style={inputStyle} className={inputClass}>
                    <option value="">Mes</option>
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Año</FieldLabel>
                  <select value={answers.memberSinceYear} onChange={(e) => patch({ memberSinceYear: e.target.value })} style={inputStyle} className={inputClass}>
                    <option value="">Año</option>
                    {Array.from({ length: today.getFullYear() - 1949 }, (_, i) => today.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Campus ── */}
          {currentKey === 'campus' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Tu comunidad</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">¿Cuál es tu campus principal?</h2>
              <p className="text-sm text-[#607068] mb-6">Selecciona el campus al que perteneces.</p>
              <FieldLabel>Campus</FieldLabel>
              <select value={answers.campusId} onChange={(e) => patch({ campusId: e.target.value })} style={inputStyle} className={inputClass}>
                <option value="">Selecciona tu campus</option>
                {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* ── Serving ── */}
          {currentKey === 'serving' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Ruta del servicio</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">¿Actualmente sirves en ARM Global?</h2>
              <p className="text-sm text-[#607068] mb-6">Tu respuesta nos permitirá reconocer correctamente tu camino de servicio.</p>
              <div className="flex flex-col gap-2">
                {SERVING_OPTIONS.map((o) => (
                  <OptionCard key={o.value} selected={answers.servingStatus === o.value} onClick={() => patch({ servingStatus: o.value })}>{o.label}</OptionCard>
                ))}
              </div>
            </div>
          )}

          {/* ── Areas ── */}
          {currentKey === 'areas' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Participación</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">¿En qué área sirves?</h2>
              <p className="text-sm text-[#607068] mb-6">Puedes seleccionar más de una.</p>
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {areaOptions.map((o) => (
                  <OptionCard key={o.key} selected={answers.interestAreas.includes(o.label)} onClick={() => toggleArea(o.label)}>{o.label}</OptionCard>
                ))}
                <OptionCard selected={answers.interestAreas.includes(OTHER_AREA_VALUE)} onClick={() => toggleArea(OTHER_AREA_VALUE)}>Otros</OptionCard>
                {answers.interestAreas.includes(OTHER_AREA_VALUE) && (
                  <input
                    value={answers.otherAreaText}
                    onChange={(e) => patch({ otherAreaText: e.target.value })}
                    placeholder="Escribe el área"
                    style={inputStyle} className={inputClass}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Consent ── */}
          {currentKey === 'consent' && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Último paso</p>
              <h2 className="text-xl font-semibold text-[#182d25] mb-2">Confirma las políticas de uso.</h2>
              <p className="text-sm text-[#607068] mb-6 leading-relaxed">
                Incluyen el uso de la app, la política de voluntariado, el tratamiento de datos, las comunicaciones institucionales y las felicitaciones de cumpleaños.
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={answers.consentAccepted}
                  onChange={(e) => patch({ consentAccepted: e.target.checked })}
                  className="mt-0.5"
                />
                <span className="text-sm text-[#43574b]">
                  He leído y acepto las{' '}
                  <a
                    href="/politicas"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[#182d25] underline underline-offset-2 hover:text-[#204b39]"
                  >
                    políticas de ARM Global
                  </a>.
                </span>
              </label>
            </div>
          )}

          {/* ── Result ── */}
          {isResult && (
            <div>
              <p className="text-xs text-[#607068] mb-2 uppercase tracking-wide">Registro completado</p>
              <h2 className="text-2xl font-semibold text-[#182d25] mb-4">Bienvenido, {displayName}.</h2>
              {level.stars > 0 && (
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: level.stars }).map((_, i) => <Star key={i} color={MATERIAL_COLOR[level.material]} />)}
                </div>
              )}
              <p className="text-sm font-semibold mb-2" style={{ color: MATERIAL_COLOR[level.material] }}>
                {MATERIAL_LABEL[level.material] ? `${MATERIAL_LABEL[level.material]} · ${level.name}` : level.name}
              </p>
              <p className="text-sm text-[#607068] mb-8 leading-relaxed">{level.detail}</p>

              {storeUser?.status === 'pending' ? (
                <div>
                  <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)' }}
                    className="rounded-lg px-3.5 py-3 mb-4">
                    <p className="text-sm text-amber-800 font-medium mb-1">Tu cuenta está pendiente de aprobación</p>
                    <p className="text-xs text-[#607068] leading-relaxed">
                      Ya guardamos tus datos. Un administrador debe aprobar tu registro antes de que puedas
                      entrar a la app — te avisaremos por correo apenas esté lista.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { logout(); router.replace('/auth/login'); }}
                    style={{ border: '1px solid #cdd6d0' }}
                    className="w-full py-2.5 rounded-lg text-sm font-medium text-[#52675a] hover:text-[#182d25] hover:border-[#315e49] transition-all active:scale-[0.98]"
                  >
                    Ir al Login
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => router.replace('/dashboard')}
                  style={{ background: '#204b39' }}
                  className="w-full min-h-[50px] py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  Ir a la app
                </button>
              )}
            </div>
          )}

          {error && !isResult && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
              className="text-red-700 text-sm rounded-lg px-3.5 py-2.5 mt-5">
              {error}
            </div>
          )}

          {!isResult && (
            <div className="flex gap-3 mt-6">
              {!isIntro && (
                <button
                  type="button"
                  onClick={() => move(-1)}
                  style={{ border: '1px solid #cdd6d0' }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-[#607068] hover:text-[#204b39] hover:border-[#315e49] transition-all active:scale-[0.98]"
                >
                  Volver
                </button>
              )}
              <button
                type="button"
                onClick={() => move(1)}
                disabled={submitting}
                style={{ background: '#204b39' }}
                className="flex-1 min-h-[50px] py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90 active:scale-[0.98]"
              >
                {submitting
                  ? <span className="flex items-center justify-center gap-2" style={{ color: '#fff' }}>
                      <span className="w-3.5 h-3.5 border-2 border-[#b9d2c2] border-t-[#204b39] rounded-full animate-spin" /> Guardando...
                    </span>
                  : isIntro ? 'Comenzar' : currentKey === 'consent' ? 'Finalizar registro' : 'Continuar'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CompleteProfileInner />
    </Suspense>
  );
}
