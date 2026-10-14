/**
 * Public Pokédex page — the only page anonymous visitors can see.
 * The session cookie decides whether edit/delete/generate controls render.
 */

import { cookies } from 'next/headers';
import { authEnabled, isSessionCookie, SESSION_COOKIE } from '@/lib/server/auth';
import { PokedexPageClient } from './PokedexPageClient';

export default async function PokedexPage() {
  const store = await cookies();
  const canEdit = !authEnabled() || isSessionCookie(store.get(SESSION_COOKIE)?.value);

  return <PokedexPageClient canEdit={canEdit} />;
}
