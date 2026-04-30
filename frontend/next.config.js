/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost', port: '9000' },
      { protocol: 'https', hostname: process.env.MINIO_PUBLIC_HOST || 'storage.empresa.com' },
    ],
  },
};

module.exports = nextConfig;
