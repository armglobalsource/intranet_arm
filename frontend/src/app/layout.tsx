import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
// ecosistema-arm

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Ecosistema ARM', template: '%s | Ecosistema' },
  description: 'Portal interno corporativo',
  icons: {
    icon: [
      { url: '/arm-brand-icon-64.png', type: 'image/png', sizes: '64x64' },
      { url: '/arm-brand-icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/arm-brand-icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/arm-brand-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Recarga automática cuando un chunk JS no se encuentra tras un nuevo deploy */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('error', function(e) {
            if (e.target && e.target.tagName === 'SCRIPT' && e.target.src && e.target.src.includes('/_next/static/')) {
              window.location.reload();
            }
          }, true);
          window.addEventListener('unhandledrejection', function(e) {
            var msg = e.reason && (e.reason.message || String(e.reason));
            if (msg && (msg.includes('Loading chunk') || msg.includes('ChunkLoadError'))) {
              window.location.reload();
            }
          });
        `}} />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
