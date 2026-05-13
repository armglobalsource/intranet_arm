'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // En producción aquí iría el reporte a un servicio (Sentry, Cloud Error Reporting)
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-gray-200 mb-2">500</p>
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Algo salió mal</h1>
        <p className="text-gray-500 mb-8">
          Ocurrió un error inesperado. Si el problema persiste, contacta al administrador.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Intentar de nuevo
          </button>
          <a
            href="/dashboard"
            className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Ir al inicio
          </a>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-gray-400">ID de error: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
