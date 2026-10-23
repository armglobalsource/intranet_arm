'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell, authInput, authButton, authLink } from '@/components/auth/AuthShell';
import { api, apiErrorMessage } from '@/lib/api';

const schema = z.object({ email: z.string().trim().email('Ingresa un correo válido').max(254) });
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const submit = async ({ email }: z.infer<typeof schema>) => {
    try { await api.post('/auth/forgot-password', { email }); setSent(true); }
    catch (err) { setError('root', { message: apiErrorMessage(err, 'No pudimos procesar tu solicitud. Inténtalo nuevamente.') }); }
  };
  return <AuthShell title={sent ? 'Revisa tu correo.' : 'Recupera tu acceso.'} description={sent ? 'Estás a un paso de volver a tu comunidad.' : 'Te ayudamos a crear una nueva contraseña, sin perder tu información.'}>
    {sent ? <div role="status" className="rounded-2xl border border-[#dbe5d8] bg-[#f0f5ed] p-6">
      <Mail size={26} className="mb-4 text-[#315e49]" aria-hidden="true" />
      <p className="text-sm leading-6">Si el correo corresponde a una cuenta disponible, recibirás un enlace para crear tu contraseña.</p>
      <p className="mt-3 text-sm leading-6 text-[#607068]">Revisa también spam. El enlace dura 15 minutos. Si no llega, espera un minuto antes de intentarlo otra vez.</p>
      <button onClick={() => setSent(false)} className={`${authLink} mt-5 min-h-[44px] text-sm`}>Volver a intentarlo o corregir el correo</button>
    </div> : <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5" aria-busy={isSubmitting}>
      <div><label htmlFor="email" className="mb-2 block text-sm font-medium">Correo electrónico</label>
        <input {...register('email')} id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="El correo de tu cuenta" className={authInput} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />
        {errors.email && <p id="email-error" role="alert" className="mt-2 text-sm text-red-700">{errors.email.message}</p>}
      </div>
      {errors.root && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errors.root.message}</p>}
      <button disabled={isSubmitting} className={authButton}>{isSubmitting ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />Enviando solicitud…</> : 'Enviar enlace de recuperación'}</button>
    </form>}
    <Link href="/auth/login" className={`${authLink} mt-7 flex min-h-[44px] items-center justify-center gap-2 text-sm`}><ArrowLeft size={16} aria-hidden="true" />Volver a iniciar sesión</Link>
  </AuthShell>;
}
