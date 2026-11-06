'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import s from './mail.module.css';

export function WorkspaceConnection() {
  const status = useQuery<{available:boolean;configured:boolean}>({
    queryKey:['institutional-mail','workspace'],
    queryFn:async()=>(await api.get('/institutional-mail/workspace')).data,
    retry:false,
  });
  const check = useMutation<{connected:boolean;checkedAt:string}>({
    mutationFn:async()=>(await api.post('/institutional-mail/workspace/check')).data,
  });
  return <section className={s.card} aria-label="Conexión con Google Workspace">
    <div className={s.toolbar}>
      <div><h2>Google Workspace</h2><p className={s.muted}>ARM Global · armglobal.org</p></div>
      <button onClick={()=>check.mutate()} disabled={!status.data?.available||check.isPending}>
        {check.isPending?'Comprobando…':'Comprobar conexión'}
      </button>
    </div>
    <p className={s.muted}>Esta comprobación consulta usuarios y grupos. La creación y entrega de cuentas siguen a cargo de TI en Google Workspace.</p>
    {status.isPending&&<p role="status">Revisando configuración…</p>}
    {status.data&&!status.data.available&&<p className={s.notice}>Conexión pendiente de habilitación en producción. Puedes continuar gestionando solicitudes.</p>}
    {status.isError&&<div className={s.error} role="alert">{apiErrorMessage(status.error,'No se pudo consultar la conexión.')} <button onClick={()=>status.refetch()}>Reintentar</button></div>}
    {check.isError&&<p role="alert" className={s.error}>{apiErrorMessage(check.error,'No se pudo verificar Google Workspace.')}</p>}
    {check.isSuccess&&<p role="status" className={s.notice}>Conexión verificada · {new Date(check.data.checkedAt).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}. Acceso de consulta a usuarios y grupos confirmado.</p>}
  </section>;
}
