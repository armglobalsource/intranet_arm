/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      // Desarrollo local con MinIO
      { protocol: 'http', hostname: 'localhost', port: '9000' },
      // Google Cloud Storage (producción)
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      // GCS con dominio personalizado
      {
        protocol: 'https',
        hostname: process.env.GCS_PUBLIC_HOST || 'storage.googleapis.com',
      },
    ],
  },
};

module.exports = nextConfig;
