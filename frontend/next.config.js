/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
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
