import { q, tx, audit, caja } from '@/lib/db';
import { route, bad, num, txt, dateOf, todayPE } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const s = new URL(req.url).searchParams;
  const w = [], p = [];
  if (s.get('desde')) { p.push(s.get('desde')); w.push(`fecha>=$${p.length}`); }
  if (s.get('hasta')) { p.push(s.get('hasta')); w.push(`fecha<=$${p.length}`); }
  return q(`SELECT * FROM gastos ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY fecha DESC, id DESC LIMIT 500`, p);
});

export const POST = route(async (req, ctx, user) => {
  const b = await req.json();
  const monto = num(b.monto, 'El monto', { req: true });
  if (monto <= 0) bad('El monto debe ser mayor que 0.');
  const cat = txt(b.categoria, 'La categoría', true);
  const fecha = dateOf(b.fecha || todayPE(), 'Fecha');
  return tx(async (cl) => {
    const g = (await cl.query('INSERT INTO gastos(fecha,categoria,descripcion,monto_pen,medio_pago,referencia,usuario) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [fecha, cat, txt(b.descripcion), monto, txt(b.medio_pago), txt(b.referencia), user])).rows[0];
    await caja(cl, { fecha, tipo: 'EGRESO', concepto: `Gasto: ${cat}`, origen: 'GASTO', origen_id: g.id, monto, medio: b.medio_pago, referencia: b.referencia, usuario: user });
    await audit(cl, user, 'CREAR', 'gasto', g.id, b);
    return g;
  });
});

export const PATCH = route(async (req, ctx, user) => {
  const b = await req.json();
  return tx(async (cl) => {
    const g = (await cl.query('SELECT * FROM gastos WHERE id=$1 FOR UPDATE', [b.id])).rows[0];
    if (!g) bad('Gasto no encontrado.');
    if (g.anulado) bad('El gasto ya está anulado.');
    if (g.venta_id) bad('Este gasto pertenece a una venta. Se anula junto con la venta.');
    await cl.query('UPDATE gastos SET anulado=true WHERE id=$1', [g.id]);
    await caja(cl, { fecha: todayPE(), tipo: 'INGRESO', concepto: `Anulación gasto: ${g.categoria}`, origen: 'ANULACION_GASTO', origen_id: g.id, monto: g.monto_pen, medio: g.medio_pago, usuario: user });
    await audit(cl, user, 'ANULAR', 'gasto', g.id, { motivo: b.motivo || null });
    return { ok: true };
  });
});
