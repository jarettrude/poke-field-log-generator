/**
 * Route gate — the Next.js 16 successor to middleware.ts.
 *
 * Anonymous visitors get a read-only Pokédex:
 *   - /pokedex page
 *   - the GET endpoints it needs (summaries, audio metadata + stream, pokemon data)
 *   - /login and the /api/auth/* endpoints
 *
 * Everything else (home, generator, settings, all mutations) requires the
 * session cookie set by /api/auth/login. With POKEDEX_PASSWORD unset, auth
 * is disabled and all requests pass through.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authEnabled, isSessionCookie, SESSION_COOKIE } from '@/lib/server/auth';

/** GET endpoints the read-only Pokédex view depends on. */
const PUBLIC_API_GETS = [
  /^\/api\/summaries(?:\/\d+)?$/,
  /^\/api\/audio$/,
  /^\/api\/audio\/\d+\/file$/,
  /^\/api\/pokemon(?:\/\d+(?:\/thumb)?)?$/,
];

export function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const authed = isSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);

  // Auth endpoints are always reachable; they enforce their own checks.
  if (pathname.startsWith('/api/auth/')) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    if (request.method === 'GET' && PUBLIC_API_GETS.some(re => re.test(pathname))) {
      return NextResponse.next();
    }
    if (authed) return NextResponse.next();
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  if (authed) {
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (pathname === '/login' || pathname === '/pokedex') return NextResponse.next();

  // The public landing page is the Pokédex; other pages bounce to login.
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/pokedex', request.url));
  }
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip static internals, image optimizer, favicon, and the public sprite
  // cache (public/pokemon/*) — the anonymous Pokédex needs those files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|pokemon/).*)'],
};
