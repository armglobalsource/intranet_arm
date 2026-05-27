import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_request: NextRequest) {
  // Impedir que el CDN de Firebase (y el navegador) cacheen el HTML.
  // Sin esto, el CDN sirve HTML viejo con referencias a chunks que ya no
  // existen tras un nuevo deploy → pantalla en blanco por chunk 404.
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
