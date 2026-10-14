/**
 * Simple password auth for the homelab deployment — same model as the CRM:
 * one shared password in POKEDEX_PASSWORD, an HMAC-derived session cookie,
 * and per-IP rate limiting on login attempts.
 *
 * If POKEDEX_PASSWORD is unset, auth is disabled and every request is
 * treated as authenticated (local dev convenience).
 *
 * This module intentionally has no `next/headers` imports — it must stay
 * safe to import from src/proxy.ts, which is bundled separately.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'pokedex_session';
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function appPassword(): string | undefined {
  return process.env.POKEDEX_PASSWORD;
}

export function authEnabled(): boolean {
  return !!appPassword();
}

export function sessionToken(): string {
  const password = appPassword();
  if (!password) throw new Error('POKEDEX_PASSWORD is not set');
  return createHmac('sha256', password).update('pokedex-session-v1').digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkPassword(password: string): boolean {
  const expected = appPassword();
  return !!expected && safeEqual(password, expected);
}

/** True when the cookie value matches the current session token. */
export function isSessionCookie(value: string | undefined | null): boolean {
  return !!value && authEnabled() && safeEqual(value, sessionToken());
}

/**
 * Session cookies get the Secure flag only when the request arrived over
 * https (Traefik forwards x-forwarded-proto). Plain-http LAN access still
 * works; tailnet https sessions stay https-only.
 */
export function sessionIsSecure(request: Request): boolean {
  if (request.headers.get('x-forwarded-proto') === 'https') return true;
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function sessionCookieOptions(secure: boolean) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    maxAge: SESSION_MAX_AGE_S,
  };
}

// ---- login rate limiting (per client IP, in-memory) ----
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { n: number; reset: number }>();

export function loginAttemptAllowed(ip: string): boolean {
  const rec = attempts.get(ip);
  if (!rec || Date.now() > rec.reset) return true;
  return rec.n < MAX_ATTEMPTS;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.reset) attempts.set(ip, { n: 1, reset: now + WINDOW_MS });
  else rec.n++;
  // bound the map — prune stale entries opportunistically
  if (attempts.size > 500) {
    for (const [k, v] of attempts) if (now > v.reset) attempts.delete(k);
  }
}
