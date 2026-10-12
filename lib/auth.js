import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const key = () => new TextEncoder().encode(process.env.AUTH_SECRET);

export const signSession = (user) => new SignJWT({ u: user }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('12h').sign(key());

export async function getUser() {
  const t = (await cookies()).get('pj')?.value;
  if (!t) return null;
  try { return (await jwtVerify(t, key())).payload.u; } catch { return null; }
}

export function checkLogin(u, p) {
  return (process.env.APP_USERS || '')
    .split(',').map((s) => s.trim()).filter(Boolean)
    .some((s) => { const [a, ...b] = s.split(':'); return a === u && b.join(':') === p; });
}
