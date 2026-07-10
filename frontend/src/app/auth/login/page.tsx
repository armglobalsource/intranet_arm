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
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router          = useRouter();
  const setSession      = useAuthStore((s) => s.setSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showPwd, setShowPwd] = useState(false);
  const hasHydrated     = useAuthStore((s) => s._hasHydrated);

  // If already logged in, skip the login page
  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [hasHydrated, isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post('/auth/login', data);
      setSession(res.data.user, res.data.accessToken, res.data.refreshToken);
      router.replace('/dashboard');
    } catch (err: any) {
      setError('root', {
        message: apiErrorMessage(err, 'Email o contraseña incorrectos'),
      });
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0d0d0d' }}>

      {/* Panel izquierdo — decorativo */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12"
        style={{ borderRight: '1px solid #1f1f1f' }}>
        <Image
          src="/logo.png"
          alt="Logo"
          width={200}
          height={70}
          className="object-contain mb-10"
          priority
        />
        <p className="text-white/30 text-sm text-center max-w-xs leading-relaxed">
          Plataforma interna de ARM —<br />organigrama y directorio de personas
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Logo móvil */}
          <div className="flex justify-center mb-10 lg:hidden">
            <Image
              src="/logo.png"
              alt="Logo"
              width={140}
              height={48}
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-2xl font-semibold text-white mb-1">Iniciar sesión</h1>
          <p className="text-sm text-white/40 mb-8">Ingresa con tu cuenta corporativa</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="usuario@empresa.com"
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  color: '#fff',
                }}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm placeholder-white/20
                  focus:outline-none focus:border-white/30 focus:ring-0 transition-colors"
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
                Contraseña
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  style={{
                    background: '#1a1a1a',
                    border: '1px solid #2a2a2a',
                    color: '#fff',
                  }}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm placeholder-white/20
                    focus:outline-none focus:border-white/30 focus:ring-0 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-white/30 hover:text-white/60 transition-colors"
                  tabIndex={-1}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPwd ? (
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
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
              )}
            </div>

            {errors.root && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                className="text-red-400 text-sm rounded-lg px-3.5 py-2.5">
                {errors.root.message}
              </div>
            )}

            {errors.root?.message === 'Credenciales inválidas' && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a2a' }}
                className="text-white/50 text-xs rounded-lg px-3.5 py-2.5 leading-relaxed">
                ¿Primera vez? Si ya estás registrado pero nunca creaste tu contraseña,
                usa{' '}
                <Link href="/auth/register" className="text-white/80 underline underline-offset-2 hover:text-white">
                  Crear cuenta
                </Link>
                {' '}con tu mismo correo — el sistema la reconocerá y te dejará entrar.
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{ background: isSubmitting ? '#2a2a2a' : '#fff' }}
              className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold
                text-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                hover:bg-gray-100 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2" style={{ color: '#888' }}>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : (
                'Ingresar'
              )}
            </button>

          </form>

          <Link
            href="/auth/register"
            style={{ background: 'transparent', border: '1px solid #2a2a2a' }}
            className="w-full mt-3 py-2.5 rounded-lg text-sm font-semibold text-white/60
              flex items-center justify-center hover:border-white/20 hover:text-white
              transition-all active:scale-[0.98]"
          >
            Registrarme
          </Link>

        </div>
      </div>

    </div>
  );
}
