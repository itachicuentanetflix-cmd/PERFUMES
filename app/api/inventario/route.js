import { tx, audit } from '@/lib/db';
import { route, bad, txt, num } from '@/lib/api';
import { toC } from '@/lib/alloc';

// Ajuste de inventario: siempre con movimiento y motivo obligatorio.
export const POST = route(async (req, ctx, user) => {
  const b = await req.json();
  const cant = Math.trunc(num(b.cantidad, 'La cantidad', { req: true }));
  if (cant <= 0) bad('La cantidad debe ser mayor que 0.');
  if (!['+', '-'].includes(b.tipo)) bad('Elige si el ajuste suma o resta.');
  const motivo = txt(b.motivo, 'El motivo', true);
  return tx(async (cl) => {
    const { rows } = await cl.query('SELECT * FROM lotes WHERE id=$1 FOR UPDATE', [b.lote_id]);
    const l = rows[0];
    if (!l) bad('Lote no encontrado.');
    const v = toC(l.valor_restante);
    let delta;
    if (b.tipo === '-') {
      if (cant > l.stock) bad(`No puedes restar ${cant}: el lote ${l.codigo} tiene ${l.stock} en stock.`);
      delta = cant === l.stock ? v : Math.round((v * cant) / l.stock);
    } else delta = Math.round(toC(l.total_pen) / l.cantidad_inicial) * cant;
    const sign = b.tipo === '-' ? -1 : 1;
    await cl.query('UPDATE lotes SET stock=stock+$2, valor_restante=valor_restante+$3 WHERE id=$1', [l.id, sign * cant, (sign * delta) / 100]);
    await cl.query('INSERT INTO movimientos_inventario(lote_id,perfume_id,tipo,cantidad,valor,referencia,motivo,usuario) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [l.id, l.perfume_id, b.tipo === '-' ? 'AJUSTE-' : 'AJUSTE+', sign * cant, (sign * delta) / 100, l.codigo, motivo, user]);
    await audit(cl, user, 'AJUSTE_INVENTARIO', 'lote', l.id, { tipo: b.tipo, cant, motivo });
    return { ok: true };
  });
});
