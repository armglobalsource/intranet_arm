'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { api, apiErrorMessage } from '@/lib/api';
import { AuthShell, authInput, authButton, authLink } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';

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

  return <AuthShell title="Crear cuenta" description="Regístrate para acceder al ecosistema ARM.">
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-busy={isSubmitting} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label htmlFor="firstName" className="mb-2 block text-sm font-medium">Nombre</label>
          <input {...register('firstName')} id="firstName" autoComplete="given-name" placeholder="Tu nombre" className={authInput} aria-invalid={!!errors.firstName} aria-describedby={errors.firstName ? 'firstName-error' : undefined} />
          {errors.firstName && <p id="firstName-error" role="alert" className="mt-2 text-sm text-red-700">{errors.firstName.message}</p>}
        </div>
        <div><label htmlFor="lastName" className="mb-2 block text-sm font-medium">Apellido</label>
          <input {...register('lastName')} id="lastName" autoComplete="family-name" placeholder="Tu apellido" className={authInput} aria-invalid={!!errors.lastName} aria-describedby={errors.lastName ? 'lastName-error' : undefined} />
          {errors.lastName && <p id="lastName-error" role="alert" className="mt-2 text-sm text-red-700">{errors.lastName.message}</p>}
        </div>
      </div>
      <div><label htmlFor="email" className="mb-2 block text-sm font-medium">Correo electrónico</label>
        <input {...register('email')} id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="tu@correo.com" className={authInput} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />
        {errors.email && <p id="email-error" role="alert" className="mt-2 text-sm text-red-700">{errors.email.message}</p>}
      </div>
      <div><label htmlFor="password" className="mb-2 block text-sm font-medium">Contraseña</label>
        <PasswordField {...register('password')} id="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} />
        {errors.password && <p id="password-error" role="alert" className="mt-2 text-sm text-red-700">{errors.password.message}</p>}
      </div>
      <div><label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium">Confirmar contraseña</label>
        <PasswordField {...register('confirmPassword')} id="confirmPassword" autoComplete="new-password" placeholder="Repite tu contraseña" aria-invalid={!!errors.confirmPassword} aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined} />
        {errors.confirmPassword && <p id="confirm-error" role="alert" className="mt-2 text-sm text-red-700">{errors.confirmPassword.message}</p>}
      </div>
      {errors.root && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errors.root.message}</p>}
      <button type="submit" disabled={isSubmitting} className={authButton}>{isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}</button>
    </form>
    <p className="mt-7 text-center text-sm text-[#607068]">¿Ya tienes cuenta? <Link href="/auth/login" className={authLink}>Inicia sesión</Link></p>
    <p className="mt-6 border-t border-[#e1e7dd] pt-6 text-center text-xs leading-5 text-[#607068]">¿Ya estás en ARM? <Link href="/auth/forgot-password" className={authLink}>Recupera tu acceso por correo</Link></p>
  </AuthShell>;
}
