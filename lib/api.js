import { NextResponse } from 'next/server';
import { getUser } from './auth';

export class HttpError extends Error { constructor(m, status = 400) { super(m); this.status = status; } }
export const bad = (m, status = 400) => { throw new HttpError(m, status); };

export const num = (v, nombre, { min = 0, req = false } = {}) => {
  if (v === '' || v == null) { if (req) bad(`${nombre} es obligatorio.`); return 0; }
  const n = Number(v);
  if (!isFinite(n)) bad(`${nombre} no es un número válido.`);
  if (n < min) bad(`${nombre} no puede ser menor que ${min}.`);
  return n;
};
export const txt = (v, nombre, req = false) => {
  const s = (v ?? '').toString().trim();
  if (req && !s) bad(`${nombre} es obligatorio.`);
  return s || null;
};
export const dateOf = (v, nombre, req = true) => {
  if (!v && !req) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) bad(`${nombre}: fecha inválida.`);
  return v;
};
export const todayPE = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

export function route(handler) {
  return async (req, ctx) => {
    try {
      const user = await getUser();
      if (!user) return NextResponse.json({ error: 'Sesión vencida. Vuelve a iniciar sesión.' }, { status: 401 });
      const data = await handler(req, ctx, user);
      return data instanceof Response ? data : NextResponse.json(data ?? { ok: true });
    } catch (e) {
      const status = e.status || 500;
      if (!e.status) console.error(e);
      let m = e.message;
      if (e.code === '23505') m = 'Ya existe un registro con ese código o valor único.';
      return NextResponse.json({ error: e.status || e.code === '23505' ? m : 'Error del servidor: ' + m }, { status: e.code === '23505' ? 409 : status });
    }
  };
}
