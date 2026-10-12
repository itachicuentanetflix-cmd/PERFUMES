import { NextResponse } from 'next/server';
import { checkLogin, signSession } from '@/lib/auth';

export async function POST(req) {
  const { usuario, clave } = await req.json().catch(() => ({}));
  if (!process.env.AUTH_SECRET || !process.env.APP_USERS) return NextResponse.json({ error: 'Faltan las variables AUTH_SECRET y APP_USERS en Vercel.' }, { status: 500 });
  if (!checkLogin((usuario || '').trim(), clave || '')) return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set('pj', await signSession(usuario.trim()), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 43200 });
  return res;
}
