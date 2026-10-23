'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { api, apiErrorMessage } from '@/lib/api';
import { AuthShell, authInput, authButton, authLink } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';

const schema = z.object({ email: z.string().trim().email('Ingresa un correo válido'), password: z.string().min(1, 'Ingresa tu contraseña') });
type FormData = z.infer<typeof schema>;
export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore(s => s.setSession);
  const hasHydrated = useAuthStore(s => s._hasHydrated);
  useEffect(() => {
    const state = useAuthStore.getState();
    if (hasHydrated && state.isAuthenticated) router.replace(state.user?.status === 'pending' || state.needsProfileCompletion ? '/auth/complete-profile' : '/dashboard');
    // Evaluate existing session only at hydration; submitting controls its own redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<FormData>({ resolver: zodResolver(schema) });
  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post('/auth/login', data);
      setSession(res.data.user, res.data.accessToken, res.data.refreshToken, res.data.needsProfileCompletion);
      router.replace(res.data.user.status === 'pending' || res.data.needsProfileCompletion ? '/auth/complete-profile' : '/dashboard');
    } catch (err) { setError('root', { message: apiErrorMessage(err, 'No pudimos iniciar sesión. Revisa tu conexión e inténtalo nuevamente.') }); }
  };
  return <AuthShell title="Qué bueno verte." description="Ingresa a tu cuenta y conecta con la vida de ARM.">
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5" aria-busy={isSubmitting}>
      <div><label htmlFor="email" className="mb-2 block text-sm font-medium">Correo electrónico</label>
        <input {...register('email')} id="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="tu@correo.com" className={authInput} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />
        {errors.email && <p id="email-error" role="alert" className="mt-2 text-sm text-red-700">{errors.email.message}</p>}
      </div>
      <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="password" className="text-sm font-medium">Contraseña</label><Link href="/auth/forgot-password" className={`${authLink} text-xs`}>Olvidé mi contraseña</Link></div>
        <PasswordField {...register('password')} id="password" autoComplete="current-password" placeholder="Tu contraseña" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} />
        {errors.password && <p id="password-error" role="alert" className="mt-2 text-sm text-red-700">{errors.password.message}</p>}
      </div>
      {errors.root && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errors.root.message}</p>}
      <button disabled={isSubmitting} className={authButton}>{isSubmitting ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />Ingresando…</> : <>Entrar a mi comunidad<ArrowRight size={17} aria-hidden="true" /></>}</button>
    </form>
    <p className="mt-7 text-center text-sm text-[#607068]">¿Es tu primera vez? <Link href="/auth/register" className={authLink}>Crea tu cuenta</Link></p>
    <p className="mt-7 border-t border-[#e1e7dd] pt-6 text-center text-xs leading-5 text-[#607068]">Si ya estás en el directorio y aún no tienes contraseña,<br className="hidden sm:block" /> puedes <Link href="/auth/forgot-password" className={authLink}>activar tu acceso por correo</Link>.</p>
  </AuthShell>;
}
