'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { api, apiErrorMessage } from '@/lib/api';

const schema = z.object({
  firstName:       z.string().min(1, 'Ingresa tu nombre'),
  lastName:        z.string().min(1, 'Ingresa tu apellido'),
  email:           z.string().email('Email inválido'),
  password:        z.string().min(6, 'Mínimo 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router          = useRouter();
  const setSession      = useAuthStore((s) => s.setSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated     = useAuthStore((s) => s._hasHydrated);
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Solo se evalúa al hidratar, no en cada cambio de isAuthenticated — si no,
  // el registro recién hecho en onSubmit (que también deja isAuthenticated=true)
  // dispara este efecto y pisa el redirect a /auth/complete-profile.
  useEffect(() => {
    if (hasHydrated && isAuthenticated) router.replace('/dashboard/orgchart');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const { confirmPassword: _, ...payload } = data;
      const res = await api.post('/auth/register', payload);
      setSession(res.data.user, res.data.accessToken, res.data.refreshToken, res.data.needsProfileCompletion);
      // Una cuenta 'pending' siempre pasa por el wizard primero — ahí ve la
      // pantalla de "espera aprobación" en vez del dashboard.
      const goToWizard = res.data.user.status === 'pending' || res.data.needsProfileCompletion;
      router.replace(goToWizard ? '/auth/complete-profile' : '/dashboard/orgchart');
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError('email', { message: apiErrorMessage(err, 'Este email ya tiene una cuenta. Usa "Iniciar sesión".') });
      } else {
        setError('root', { message: apiErrorMessage(err, 'Error al crear la cuenta') });
      }
    }
  };

  const handleGoogle = () => {
    window.location.href = `${api.defaults.baseURL}/auth/google`;
  };

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

          <h1 className="text-2xl font-semibold text-white mb-1">Crear cuenta</h1>
          <p className="text-sm text-white/40 mb-8">Regístrate con tu cuenta corporativa</p>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg text-sm
              font-medium text-white/80 hover:border-white/20 hover:text-white transition-all mb-6"
          >
            <GoogleIcon />
            Continuar con Google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: '#2a2a2a' }} />
            <span className="text-xs text-white/25">o con email</span>
            <div className="flex-1 h-px" style={{ background: '#2a2a2a' }} />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

            {/* Nombre y apellido */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Nombre</label>
                <input
                  {...register('firstName')}
                  type="text" autoComplete="given-name" placeholder="Juan"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                />
                {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Apellido</label>
                <input
                  {...register('lastName')}
                  type="text" autoComplete="family-name" placeholder="Pérez"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                />
                {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Email</label>
              <input
                {...register('email')}
                type="email" autoComplete="email" placeholder="usuario@empresa.com"
                style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>}
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Contraseña</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'} autoComplete="new-password" placeholder="Mínimo 6 caracteres"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                />
                <EyeToggle show={showPwd} onToggle={() => setShowPwd((v) => !v)} />
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>}
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">Confirmar contraseña</label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder="Repite la contraseña"
                  style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                />
                <EyeToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
              </div>
              {errors.confirmPassword && <p className="text-red-400 text-xs mt-1.5">{errors.confirmPassword.message}</p>}
            </div>

            {errors.root && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                className="text-red-400 text-sm rounded-lg px-3.5 py-2.5">
                {errors.root.message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{ background: isSubmitting ? '#2a2a2a' : '#fff' }}
              className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold text-gray-900
                transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2" style={{ color: '#888' }}>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  Creando cuenta...
                </span>
              ) : 'Crear cuenta'}
            </button>

          </form>

          <p className="text-center text-sm text-white/30 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-white/60 hover:text-white transition-colors">
              Inicia sesión
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button" onClick={onToggle} tabIndex={-1}
      className="absolute inset-y-0 right-0 flex items-center px-3 text-white/30 hover:text-white/60 transition-colors"
    >
      {show ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.956 9.956 0 015.03 1.34M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
