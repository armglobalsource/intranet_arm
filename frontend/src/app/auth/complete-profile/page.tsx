'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { api, apiErrorMessage } from '@/lib/api';

const schema = z.object({
  gender:    z.enum(['male', 'female']).optional(),
  phone:     z.string().optional(),
  birthDate: z.string().optional(),
  password:  z.string().min(6, 'Mínimo 6 caracteres').optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

const GENDER_OPTIONS = [
  { value: 'male',   label: 'Masculino' },
  { value: 'female', label: 'Femenino'  },
] as const;

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
    <span className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
  </div>
);

function CompleteProfileInner() {
  const router                 = useRouter();
  const params                 = useSearchParams();
  const setSession             = useAuthStore((s) => s.setSession);
  const setTokens              = useAuthStore((s) => s.setTokens);
  const updateUser             = useAuthStore((s) => s.updateUser);
  const clearProfileCompletion = useAuthStore((s) => s.clearProfileCompletion);
  const storeAccess            = useAuthStore((s) => s.accessToken);
  const storeRefresh           = useAuthStore((s) => s.refreshToken);
  const hasHydrated            = useAuthStore((s) => s._hasHydrated);
  const [showPwd, setShowPwd]  = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [loading, setLoading]  = useState(true);

  const accessFromUrl  = params.get('access');
  const refreshFromUrl = params.get('refresh');

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!hasHydrated) return;

    const access  = accessFromUrl  ?? storeAccess;
    const refresh = refreshFromUrl ?? storeRefresh;

    if (!access || !refresh) { router.replace('/auth/login'); return; }

    if (accessFromUrl) {
      api.get('/auth/me', { headers: { Authorization: `Bearer ${access}` } })
        .then((res) => {
          setSession(res.data, access, refresh, true);
          setHasPassword(!!res.data.passwordHash);
          setLoading(false);
        })
        .catch(() => router.replace('/auth/login?error=oauth_failed'));
    } else {
      setLoading(false);
    }
  }, [hasHydrated, accessFromUrl, refreshFromUrl, storeAccess, storeRefresh, router, setSession]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload: Record<string, string> = {};
      if (data.gender)    payload.gender    = data.gender;
      if (data.phone)     payload.phone     = data.phone;
      if (data.birthDate) payload.birthDate = data.birthDate;
      if (data.password)  payload.password  = data.password;

      const res = await api.post('/auth/complete-profile', payload);
      if (res.data.user) updateUser(res.data.user);
      clearProfileCompletion();
      if (res.data.accessToken) setTokens(res.data.accessToken, res.data.refreshToken);
      router.replace('/dashboard/orgchart');
    } catch (err: any) {
      setError('root', { message: apiErrorMessage(err, 'Error al guardar el perfil') });
    }
  };

  const handleSkip = () => {
    clearProfileCompletion();
    router.replace('/dashboard/orgchart');
  };

  if (!hasHydrated || loading) return <Spinner />;

  return (
    <div className="min-h-screen flex" style={{ background: '#0d0d0d' }}>

      {/* Panel izquierdo */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12"
        style={{ borderRight: '1px solid #1f1f1f' }}>
        <Image src="/logo.png" alt="Logo" width={200} height={70} className="object-contain mb-10" priority />
        <p className="text-white/30 text-sm text-center max-w-xs leading-relaxed">
          Plataforma interna de ARM —<br />organigrama y directorio de personas
        </p>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          <div className="flex justify-center mb-10 lg:hidden">
            <Image src="/logo.png" alt="Logo" width={140} height={48} className="object-contain" priority />
          </div>

          <h1 className="text-2xl font-semibold text-white mb-1">Completa tu perfil</h1>
          <p className="text-sm text-white/40 mb-8">Unos datos más para terminar la configuración</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Género */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
                Género <span className="text-white/25 normal-case font-normal">(opcional)</span>
              </label>
              <select
                {...register('gender')}
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm
                  focus:outline-none focus:border-white/30 transition-colors"
              >
                <option value="">Selecciona una opción</option>
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {errors.gender && (
                <p className="text-red-400 text-xs mt-1.5">{errors.gender.message}</p>
              )}
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
                Teléfono <span className="text-white/25 normal-case font-normal">(opcional)</span>
              </label>
              <input
                {...register('phone')}
                type="tel"
                autoComplete="tel"
                placeholder="+52 55 1234 5678"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm placeholder-white/20
                  focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            {/* Fecha de nacimiento */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
                Fecha de nacimiento <span className="text-white/25 normal-case font-normal">(opcional)</span>
              </label>
              <input
                {...register('birthDate')}
                type="date"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm
                  focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            {/* Contraseña — solo si el usuario no tiene una */}
            {!hasPassword && (
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
                  Crear contraseña <span className="text-white/25 normal-case font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Para acceder sin Google"
                    style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm placeholder-white/20
                      focus:outline-none focus:border-white/30 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-white/30 hover:text-white/60 transition-colors"
                    tabIndex={-1}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {showPwd
                        ? <><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.956 9.956 0 015.03 1.34M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" /></>
                        : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                      }
                    </svg>
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
                )}
              </div>
            )}

            {errors.root && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                className="text-red-400 text-sm rounded-lg px-3.5 py-2.5">
                {errors.root.message}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleSkip}
                style={{ border: '1px solid #2a2a2a' }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white/40
                  hover:text-white/70 hover:border-white/20 transition-all active:scale-[0.98]"
              >
                Omitir
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ background: isSubmitting ? '#2a2a2a' : '#fff' }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold
                  text-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  hover:bg-gray-100 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2" style={{ color: '#888' }}>
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  'Continuar'
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
        <span className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    }>
      <CompleteProfileInner />
    </Suspense>
  );
}
