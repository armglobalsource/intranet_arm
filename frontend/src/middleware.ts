import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/auth/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
    ? NextResponse.next()
    : NextResponse.next();

  // Impedir que el CDN de Firebase (y el navegador) cacheen el HTML.
  // Sin esto, el CDN sirve HTML viejo con referencias a chunks que ya no
  // existen tras un nuevo deploy → pantalla en blanco por chunk 404.
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
