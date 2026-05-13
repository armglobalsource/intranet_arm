'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-gray-200 mb-2">404</p>
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Página no encontrada</h1>
        <p className="text-gray-500 mb-8">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
