'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell, authButton, authLink } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';

const schema = z.object({
  password: z.string().min(12, 'Usa al menos 12 caracteres').refine(v => new TextEncoder().encode(v).length <= 72, 'La contraseña es demasiado larga; usa un máximo de 72 bytes'),
  confirm: z.string(),
}).refine(v => v.password === v.confirm, { message: 'Las contraseñas no coinciden', path: ['confirm'] });
export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    setToken(/^[a-f0-9]{64}$/.test(value) ? value : '');
  }, []);
  const submit = async ({ password }: z.infer<typeof schema>) => {
    try {
      await api.post('/auth/reset-password', { token, password });
      useAuthStore.getState().logout();
      window.history.replaceState(null, '', '/auth/reset-password');
      setToken(''); setComplete(true);
    } catch (err) { setError('root', { message: apiErrorMessage(err, 'No pudimos cambiar tu contraseña. Inténtalo nuevamente.') }); }
  };
  return <AuthShell title={complete ? 'Todo listo.' : 'Una nueva contraseña.'} description={complete ? 'Tu acceso está listo para volver a conectar.' : 'Elige una contraseña segura que solo tú conozcas.'}>
    {complete ? <div role="status"><CheckCircle2 size={36} className="mb-5 text-[#315e49]" aria-hidden="true" /><p className="mb-6 text-sm leading-6 text-[#607068]">Tu contraseña se actualizó y cerramos las sesiones anteriores. Ahora puedes ingresar con tu nueva contraseña.</p><Link href="/auth/login" className={authButton}>Iniciar sesión</Link></div>
      : token === null ? <p role="status" className="text-sm text-[#607068]">Preparando tu enlace…</p>
      : !token ? <div role="alert"><p className="mb-6 text-sm leading-6 text-[#607068]">Necesitas el enlace que enviamos a tu correo. Si no lo tienes, solicita uno nuevo.</p><Link href="/auth/forgot-password" className={authButton}>Solicitar un nuevo enlace</Link></div>
      : <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5" aria-busy={isSubmitting}>
        <div><label htmlFor="password" className="mb-2 block text-sm font-medium">Nueva contraseña</label><PasswordField {...register('password')} id="password" autoComplete="new-password" aria-invalid={!!errors.password} aria-describedby="password-help password-error" /><p id="password-help" className="mt-2 text-xs leading-5 text-[#607068]">Al menos 12 caracteres. Puedes usar una frase que recuerdes.</p><p id="password-error" role="alert" className="mt-1 text-sm text-red-700">{errors.password?.message}</p></div>
        <div><label htmlFor="confirm" className="mb-2 block text-sm font-medium">Repite la contraseña</label><PasswordField {...register('confirm')} id="confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} aria-describedby="confirm-error" /><p id="confirm-error" role="alert" className="mt-2 text-sm text-red-700">{errors.confirm?.message}</p></div>
        {errors.root && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errors.root.message}</p>}
        <button disabled={isSubmitting} className={authButton}>{isSubmitting ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />Guardando…</> : 'Guardar nueva contraseña'}</button>
        <Link href="/auth/forgot-password" className={`${authLink} flex min-h-[44px] items-center justify-center text-sm`}>Solicitar otro enlace</Link>
      </form>}
  </AuthShell>;
}
