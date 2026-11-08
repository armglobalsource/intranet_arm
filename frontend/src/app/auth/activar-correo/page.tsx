'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { AuthShell, authButton } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';
import { api, apiErrorMessage } from '@/lib/api';

export default function ActivateCorporateMail() {
  const [token,setToken]=useState<string|null>(null);
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [email,setEmail]=useState('');
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const initialized=useRef(false);
  useEffect(()=>{if(initialized.current)return;initialized.current=true;const value=new URLSearchParams(window.location.hash.slice(1)).get('token')??'';setToken(/^[a-f0-9]{64}$/.test(value)?value:'');window.history.replaceState(null,'','/auth/activar-correo');},[]);
  async function submit(e:FormEvent) {
    e.preventDefault();setError('');
    if (password!==confirm) {setError('Las contraseñas no coinciden.');return;}
    setPending(true);
    try {
      const {data}=await api.post('/institutional-mail/workspace/activate',{token,password});
      setEmail(data.email);setToken('');setPassword('');setConfirm('');
    } catch(err){setError(apiErrorMessage(err,'No se pudo confirmar la activación. Contacta a TI para revisar tu acceso.'));}
    finally {setPending(false);}
  }
  return <AuthShell title={email?'Tu acceso inicial está listo.':'Activa tu correo institucional.'} description="Google Workspace · ARM Global">
    {email?<div role="status" className="space-y-5 text-sm leading-6"><p>Tu correo es <strong className="break-all">{email}</strong>.</p><p>Ingresa a Google con la contraseña que acabas de definir. Google te pedirá cambiarla en el primer acceso. Completa también la verificación en dos pasos para que TI pueda cerrar la solicitud.</p><a className={authButton} href="https://accounts.google.com/">Ingresar a Google</a></div>
    :token===null?<p role="status">Preparando tu acceso…</p>
    :!token?<p role="alert" className="text-sm leading-6">Abre el enlace de activación que recibiste por correo. Si venció o ya lo usaste, pide a TI un nuevo enlace desde tu solicitud.</p>
    :<form onSubmit={submit} className="space-y-5" aria-busy={pending}>
      <p className="text-sm leading-6 text-slate-600">Define una contraseña inicial de 12 a 100 caracteres. Este enlace es personal y se puede usar una sola vez.</p>
      <div><label htmlFor="workspace-password" className="mb-2 block text-sm font-medium">Contraseña inicial</label><PasswordField id="workspace-password" autoComplete="new-password" required minLength={12} maxLength={100} value={password} onChange={e=>setPassword(e.target.value)}/></div>
      <div><label htmlFor="workspace-confirm" className="mb-2 block text-sm font-medium">Repite la contraseña</label><PasswordField id="workspace-confirm" autoComplete="new-password" required minLength={12} maxLength={100} value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <button className={authButton} disabled={pending}>{pending?'Activando…':'Definir mi contraseña inicial'}</button>
      <p className="text-xs leading-5 text-slate-500">Esta contraseña corresponde a Google Workspace. Tu contraseña del Ecosistema permanece igual.</p>
    </form>}
  </AuthShell>;
}
