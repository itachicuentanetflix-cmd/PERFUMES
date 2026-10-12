import { q, tx, audit, caja } from '@/lib/db';
import { route, bad, num, txt, dateOf } from '@/lib/api';
import { computeCaja, toC, KEYS } from '@/lib/alloc';

export const dynamic = 'force-dynamic';
const m = (c) => (c / 100).toFixed(2);

export const GET = route(async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    const [imp] = await q('SELECT i.*, p.nombre proveedor, p.pais FROM importaciones i JOIN proveedores p ON p.id=i.proveedor_id WHERE i.id=$1', [id]);
    const pagos = await q('SELECT * FROM importacion_pagos WHERE importacion_id=$1 ORDER BY id', [id]);
    const lotes = await q(`SELECT l.*, p.marca, p.nombre, p.ml, ROUND(l.total_pen/l.cantidad_inicial,2) costo_unit, ROUND(l.compra_pen/l.cantidad_inicial,2) compra_unit
                           FROM lotes l JOIN perfumes p ON p.id=l.perfume_id WHERE l.importacion_id=$1 ORDER BY l.id`, [id]);
    return { imp, pagos, lotes };
  }
  return q(`SELECT i.*, p.nombre proveedor,
              COALESCE((SELECT SUM(d.ingreso_neto-d.ingreso_devuelto) FROM venta_detalle d JOIN lotes l ON l.id=d.lote_id WHERE l.importacion_id=i.id),0) recuperado,
              COALESCE((SELECT SUM(valor_restante) FROM lotes WHERE importacion_id=i.id),0) inventario
            FROM importaciones i JOIN proveedores p ON p.id=i.proveedor_id ORDER BY i.fecha_compra DESC, i.id DESC`);
});

export const POST = route(async (req, ctx, user) => {
  const b = await req.json();
  const idem = txt(b.idem_key, 'La clave de operación', true);
  const proveedor_id = Math.trunc(num(b.proveedor_id, 'El proveedor', { req: true }));
  const fecha_compra = dateOf(b.fecha_compra, 'Fecha de compra');
  const fecha_llegada = dateOf(b.fecha_llegada, 'Fecha de llegada', false);
  if (!Array.isArray(b.items) || !b.items.length) bad('La caja no tiene perfumes.');
  if (!Array.isArray(b.pagos) || !b.pagos.length) bad('Registra al menos un pago.');

  const items = b.items.map((i, n) => {
    const perfume_id = Math.trunc(num(i.perfume_id, `Perfume ${n + 1}`, { req: true }));
    return { perfume_id, qty: Math.trunc(num(i.cantidad, 'Cantidad', { req: true, min: 1 })), usd: num(i.precio_usd, 'Precio USD', { req: true }), manual: i.manual || {} };
  });
  const pagos = b.pagos.map((p) => {
    if (p.debitado === '' || p.debitado == null) bad('Cada pago debe indicar el importe realmente debitado por el banco.');
    return {
      fecha: dateOf(p.fecha, 'Fecha del pago'), monto_usd: num(p.monto_usd, 'Monto USD', { req: true }), tc: num(p.tc, 'Tipo de cambio', { req: true, min: 0.0001 }),
      comision: num(p.comision, 'Comisión'), comision_moneda: p.comision_moneda === 'USD' ? 'USD' : 'PEN', otros: num(p.otros, 'Otros cargos'),
      debitado: num(p.debitado, 'Importe debitado', { req: true }), referencia: txt(p.referencia), explicacion: txt(p.explicacion),
    };
  });
  const gastos = {};
  for (const k of KEYS) { gastos[k] = { monto: k === 'comision' ? 0 : num(b.gastos?.[k]?.monto, k), metodo: ['VALOR', 'CANTIDAD', 'MANUAL'].includes(b.gastos?.[k]?.metodo) ? b.gastos[k].metodo : 'VALOR' }; }

  // El servidor recalcula todo; nunca confía en los totales de la pantalla.
  const r = computeCaja({ items, pagos, gastos });
  if (r.errors.length) bad(r.errors.join(' '));
  r.pagos.forEach((p, i) => { if (Math.abs(p.diffC) > 1 && !pagos[i].explicacion) bad(`Pago ${i + 1}: el importe debitado no cuadra con compra + comisión (diferencia S/ ${m(p.diffC)}). Escribe la explicación.`); });

  return tx(async (cl) => {
    const dup = await cl.query('SELECT id, codigo FROM importaciones WHERE idem_key=$1', [idem]);
    if (dup.rows[0]) return { ...dup.rows[0], duplicado: true };
    const prov = await cl.query('SELECT activo FROM proveedores WHERE id=$1', [proveedor_id]);
    if (!prov.rows[0]) bad('Proveedor no encontrado.');
    if (!prov.rows[0].activo) bad('El proveedor está inactivo.');
    const ids = [...new Set(items.map((i) => i.perfume_id))];
    const pf = await cl.query('SELECT id, sku, activo FROM perfumes WHERE id = ANY($1)', [ids]);
    if (pf.rows.length !== ids.length) bad('Algún perfume de la caja ya no existe.');
    const sku = Object.fromEntries(pf.rows.map((x) => [x.id, x.sku]));

    const t = r.totals;
    const metodos = Object.fromEntries(KEYS.map((k) => [k, gastos[k].metodo]));
    const imp = (await cl.query(
      `INSERT INTO importaciones(idem_key,proveedor_id,fecha_compra,fecha_llegada,referencia,tracking,total_usd,compra_pen,banco_pen,desaduanaje_pen,flete_pen,transporte_pen,otros_pen,costo_total_pen,metodos,total_unidades,observaciones,usuario)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id, codigo`,
      [idem, proveedor_id, fecha_compra, fecha_llegada, txt(b.referencia), txt(b.tracking), m(t.totalUsdC), m(t.equivTotC), m(t.bankTotC), m(r.alloc.desaduanaje.totalC), m(r.alloc.flete.totalC), m(r.alloc.transporte.totalC), m(r.alloc.otros.totalC), m(t.totalC), JSON.stringify(metodos), t.units, txt(b.observaciones), user])).rows[0];

    for (let i = 0; i < r.pagos.length; i++) {
      const p = r.pagos[i], o = pagos[i];
      await cl.query(`INSERT INTO importacion_pagos(importacion_id,fecha,monto_usd,tipo_cambio,equivalente_pen,comision,comision_moneda,otros_cargos_pen,debitado_pen,diferencia_pen,explicacion,referencia) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [imp.id, o.fecha, o.monto_usd, o.tc, m(p.equivC), o.comision, o.comision_moneda, o.otros, m(p.debC), m(p.diffC), o.explicacion, o.referencia]);
      await caja(cl, { fecha: o.fecha, tipo: 'EGRESO', concepto: `Pago importación ${imp.codigo} (incluye comisión bancaria)`, origen: 'IMPORTACION', origen_id: imp.id, monto: m(p.debC), medio: 'BCP', referencia: o.referencia, usuario: user });
    }
    const fechaG = fecha_llegada || fecha_compra;
    for (const [k, nombre] of [['desaduanaje', 'Desaduanaje'], ['flete', 'Flete internacional'], ['transporte', 'Transporte local'], ['otros', 'Otros gastos de importación']]) {
      if (r.alloc[k].totalC > 0) await caja(cl, { fecha: fechaG, tipo: 'EGRESO', concepto: `${nombre} ${imp.codigo}`, origen: 'IMPORTACION', origen_id: imp.id, monto: m(r.alloc[k].totalC), usuario: user });
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i], ln = r.lines[i];
      const n = (await cl.query('SELECT COUNT(*)+1 n FROM lotes WHERE perfume_id=$1', [it.perfume_id])).rows[0].n;
      const codigo = `${sku[it.perfume_id]}-L${String(n).padStart(3, '0')}`;
      const lote = (await cl.query(
        `INSERT INTO lotes(codigo,importacion_id,perfume_id,proveedor_id,cantidad_inicial,stock,precio_usd,compra_pen,comision_pen,desaduanaje_pen,flete_pen,transporte_pen,otros_pen,total_pen,valor_restante,fecha_ingreso)
         VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14) RETURNING id`,
        [codigo, imp.id, it.perfume_id, proveedor_id, it.qty, it.usd, m(ln.compraC), m(ln.p.comision), m(ln.p.desaduanaje), m(ln.p.flete), m(ln.p.transporte), m(ln.p.otros), m(ln.totalC), fechaG])).rows[0];
      await cl.query(`INSERT INTO movimientos_inventario(lote_id,perfume_id,tipo,cantidad,valor,referencia,motivo,usuario) VALUES($1,$2,'ENTRADA',$3,$4,$5,'Ingreso por importación',$6)`, [lote.id, it.perfume_id, it.qty, m(ln.totalC), imp.codigo, user]);
    }
    await audit(cl, user, 'CREAR', 'importacion', imp.id, { codigo: imp.codigo, total: m(t.totalC), unidades: t.units });
    return imp;
  });
});

// Anular una importación completa (solo si no se vendió ni ajustó nada de ella).
export const PATCH = route(async (req, ctx, user) => {
  const b = await req.json();
  const motivo = txt(b.motivo, 'El motivo de anulación', true);
  return tx(async (cl) => {
    const imp = (await cl.query('SELECT * FROM importaciones WHERE id=$1 FOR UPDATE', [b.id])).rows[0];
    if (!imp) bad('Importación no encontrada.');
    if (imp.anulada) bad('La importación ya está anulada.');
    const lotes = (await cl.query('SELECT * FROM lotes WHERE importacion_id=$1 FOR UPDATE', [b.id])).rows;
    if (lotes.some((l) => l.stock !== l.cantidad_inicial || toC(l.valor_restante) !== toC(l.total_pen)))
      bad('No se puede anular: ya hay ventas o ajustes de estos lotes. Anula primero las ventas.');
    for (const l of lotes) {
      await cl.query('UPDATE lotes SET stock=0, valor_restante=0 WHERE id=$1', [l.id]);
      await cl.query(`INSERT INTO movimientos_inventario(lote_id,perfume_id,tipo,cantidad,valor,referencia,motivo,usuario) VALUES($1,$2,'ANULACION',$3,$4,$5,$6,$7)`, [l.id, l.perfume_id, -l.stock, -l.valor_restante, imp.codigo, motivo, user]);
    }
    const mov = (await cl.query(`SELECT * FROM movimientos_caja WHERE origen='IMPORTACION' AND origen_id=$1 AND tipo='EGRESO'`, [b.id])).rows;
    for (const x of mov) await caja(cl, { fecha: b.fecha || new Date().toISOString().slice(0, 10), tipo: 'INGRESO', concepto: `Reversión: ${x.concepto}`, origen: 'ANULACION_IMPORTACION', origen_id: b.id, monto: x.monto_pen, usuario: user });
    await cl.query('UPDATE importaciones SET anulada=true, estado=$2, motivo_anulacion=$3 WHERE id=$1', [b.id, 'ANULADA', motivo]);
    await audit(cl, user, 'ANULAR', 'importacion', b.id, { motivo });
    return { ok: true };
  });
});
