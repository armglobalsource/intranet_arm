const path = require('path');

// La API NestJS (../backend, compilada en backend/dist) se sirve en /api/v1
// desde src/pages/api/v1. Se carga con require en tiempo de ejecución, sin
// pasar por webpack, y el trazado de archivos la incluye en la función.
const BACKEND_ENTRY = 'intranet-backend/dist/app-factory';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
    outputFileTracingRoot: path.join(__dirname, '..'),
  },
  webpack(config, { isServer }) {
    if (isServer) config.externals.push({ [BACKEND_ENTRY]: `commonjs ${BACKEND_ENTRY}` });
    return config;
  },
  async redirects() {
    return [
      { source: '/login',    destination: '/auth/login',    permanent: true },
      { source: '/register', destination: '/auth/register', permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'kqqufmijfvrgzrfrqsby.supabase.co', pathname: '/storage/v1/object/**' },
      // Backend local — logos de equipo/área en desarrollo
      { protocol: 'http', hostname: 'localhost', port: '3001' },
      // Cloud Run backend (producción)
      { protocol: 'https', hostname: '*.run.app' },
      // Firebase Storage / Google Cloud Storage (producción)
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      // GCS con dominio personalizado
      {
        protocol: 'https',
        hostname: process.env.GCS_PUBLIC_HOST || 'storage.googleapis.com',
      },
    ],
  },
};

module.exports = nextConfig;
