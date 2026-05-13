'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-4">
      <div className="text-center max-w-sm">
        <p className="text-5xl font-bold text-gray-200 mb-2">!</p>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Error al cargar la sección</h2>
        <p className="text-gray-500 text-sm mb-6">
          No se pudo cargar este contenido. Puedes intentarlo de nuevo o volver al inicio.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
          <a
            href="/dashboard"
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Ir al inicio
          </a>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-gray-400">ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
