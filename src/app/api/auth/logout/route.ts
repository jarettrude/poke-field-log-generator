import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/server/auth';

export const runtime = 'nodejs';

// GET /api/auth/logout — clear the session cookie and return to the public view.
// Relative Location: the standalone server's request.url carries the internal
// host (0.0.0.0:3333), not the forwarded one — let the browser resolve it.
export async function GET() {
  const res = new NextResponse(null, { status: 303, headers: { Location: '/pokedex' } });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
