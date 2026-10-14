import { errorResponse, successResponse } from '@/lib/server/api';
import {
  authEnabled,
  checkPassword,
  loginAttemptAllowed,
  recordLoginFailure,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionIsSecure,
  sessionToken,
} from '@/lib/server/auth';

export const runtime = 'nodejs';

// POST /api/auth/login — verify POKEDEX_PASSWORD, set the session cookie.
export async function POST(request: Request) {
  if (!authEnabled()) {
    return successResponse({ authed: true });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!loginAttemptAllowed(ip)) {
    return errorResponse('Too many attempts — try again in a few minutes', 429);
  }

  let password = '';
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return errorResponse('Invalid request', 400);
  }

  if (!checkPassword(password)) {
    recordLoginFailure(ip);
    return errorResponse('Wrong password', 401);
  }

  const res = successResponse({ authed: true });
  res.cookies.set(SESSION_COOKIE, sessionToken(), sessionCookieOptions(sessionIsSecure(request)));
  return res;
}
