'use client';

import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function PendingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  return (
    <div className="min-h-screen flex" style={{ background: '#0d0d0d' }}>

      {/* Panel izquierdo — decorativo */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12"
        style={{ borderRight: '1px solid #1f1f1f' }}>
        <Image src="/logo.png" alt="Logo" width={200} height={70} className="object-contain mb-10" priority />
        <p className="text-white/30 text-sm text-center max-w-xs leading-relaxed">
          Plataforma interna de ARM —<br />organigrama y directorio de personas
        </p>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm text-center">

          <div className="flex justify-center mb-10 lg:hidden">
            <Image src="/logo.png" alt="Logo" width={140} height={48} className="object-contain" priority />
          </div>

          <div className="w-14 h-14 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-white mb-2">Registro recibido</h1>
          <p className="text-sm text-white/50 leading-relaxed mb-1">
            Tu solicitud de registro{email ? <> para <span className="text-white/70">{email}</span></> : ''} está pendiente de aprobación
            por un administrador.
          </p>
          <p className="text-sm text-white/40 leading-relaxed mb-8">
            Te notificaremos cuando tu cuenta esté lista para usar.
          </p>

          <Link
            href="/auth/login"
            style={{ background: 'transparent', border: '1px solid #2a2a2a' }}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white/60
              flex items-center justify-center hover:border-white/20 hover:text-white
              transition-all active:scale-[0.98]"
          >
            Volver a iniciar sesión
          </Link>

        </div>
      </div>
    </div>
  );
}

export default function PendingPage() {
  return (
    <Suspense fallback={null}>
      <PendingContent />
    </Suspense>
  );
}
