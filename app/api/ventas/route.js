import { q, tx, audit, caja } from '@/lib/db';
import { route, bad, num, txt, dateOf, todayPE } from '@/lib/api';
import { toC, allocate, sum } from '@/lib/alloc';

export const dynamic = 'force-dynamic';
const m = (c) => (c / 100).toFixed(2);
const MEDIOS = ['Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta'];

export const GET = route(async (req) => {
  const s = new URL(req.url).searchParams;
  const id = s.get('id');
  if (id) {
    const [venta] = await q('SELECT v.*, c.nombre cliente, c.telefono FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id WHERE v.id=$1', [id]);
    const lineas = await q(`SELECT d.*, p.marca, p.nombre, p.ml, p.concentracion, l.codigo lote, l.cantidad_inicial, pr.nombre proveedor, i.codigo importacion,
        ROUND(l.compra_pen/l.cantidad_inicial,2) c_compra, ROUND(l.comision_pen/l.cantidad_inicial,2) c_comision, ROUND(l.desaduanaje_pen/l.cantidad_inicial,2) c_desaduanaje,
        ROUND(l.flete_pen/l.cantidad_inicial,2) c_flete, ROUND((l.transporte_pen+l.otros_pen)/l.cantidad_inicial,2) c_otros
        FROM venta_detalle d JOIN perfumes p ON p.id=d.perfume_id JOIN lotes l ON l.id=d.lote_id JOIN proveedores pr ON pr.id=l.proveedor_id JOIN importaciones i ON i.id=l.importacion_id
        WHERE d.venta_id=$1 ORDER BY d.id`, [id]);
    const gastos = await q('SELECT * FROM gastos WHERE venta_id=$1', [id]);
    return { venta, lineas, gastos };
  }
  const w = [], p = [];
  if (s.get('desde')) { p.push(s.get('desde')); w.push(`v.fecha>=$${p.length}`); }
  if (s.get('hasta')) { p.push(s.get('hasta')); w.push(`v.fecha<=$${p.length}`); }
  return q(`SELECT v.id, v.codigo, v.fecha, v.estado, v.medio_pago, v.descuento_pen, c.nombre cliente,
              COALESCE(SUM(d.ingreso_neto-d.ingreso_devuelto),0) total, COALESCE(SUM(d.costo_pen-d.costo_devuelto),0) costo,
              COALESCE((SELECT SUM(monto_pen) FROM gastos g WHERE g.venta_id=v.id AND NOT g.anulado),0) gastos
            FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id JOIN venta_detalle d ON d.venta_id=v.id
            ${w.length ? 'WHERE ' + w.join(' AND ') : ''} GROUP BY v.id, c.nombre ORDER BY v.fecha DESC, v.id DESC LIMIT 300`, p);
});

export const POST = route(async (req, ctx, user) => {
  const b = await req.json();
  const idem = txt(b.idem_key, 'La clave de operación', true);
  const fecha = dateOf(b.fecha || todayPE(), 'Fecha');
  const medio = MEDIOS.includes(b.medio_pago) ? b.medio_pago : bad('Elige el medio de pago.');
  if (!Array.isArray(b.items) || !b.items.length) bad('Agrega al menos un perfume a la venta.');
  const items = b.items.map((i) => ({ lote_id: Math.trunc(num(i.lote_id, 'Lote', { req: true })), q: Math.trunc(num(i.cantidad, 'Cantidad', { req: true, min: 1 })), precio: num(i.precio_unit, 'Precio de venta', { req: true }) }));
  const descC = toC(num(b.descuento, 'El descuento'));
  const gMonto = toC(num(b.gasto_venta?.monto, 'El gasto de la venta'));

  return tx(async (cl) => {
    const dup = await cl.query('SELECT id, codigo FROM ventas WHERE idem_key=$1', [idem]);
    if (dup.rows[0]) return { ...dup.rows[0], duplicado: true };
    if (b.cliente_id) { const c = await cl.query('SELECT id FROM clientes WHERE id=$1', [b.cliente_id]); if (!c.rows[0]) bad('Cliente no encontrado.'); }
    const ids = [...new Set(items.map((i) => i.lote_id))].sort((a, c) => a - c);
    const lotes = (await cl.query('SELECT l.*, i.anulada FROM lotes l JOIN importaciones i ON i.id=l.importacion_id WHERE l.id = ANY($1) ORDER BY l.id FOR UPDATE OF l', [ids])).rows;
    if (lotes.length !== ids.length) bad('Algún lote ya no existe.');
    const L = Object.fromEntries(lotes.map((l) => [l.id, { ...l, v: toC(l.valor_restante) }]));

    const lines = items.map((it) => {
      const l = L[it.lote_id];
      if (l.anulada) bad(`El lote ${l.codigo} pertenece a una importación anulada.`);
      if (it.q > l.stock) bad(`Stock insuficiente en el lote ${l.codigo}: disponible ${l.stock}, pediste ${it.q}.`);
      const costC = it.q === l.stock ? l.v : Math.round((l.v * it.q) / l.stock);
      l.stock -= it.q; l.v -= costC;
      return { ...it, perfume_id: l.perfume_id, subC: toC(it.q * it.precio), costC, lote: l.codigo };
    });
    const subTot = sum(lines.map((x) => x.subC));
    if (descC > subTot) bad('El descuento no puede ser mayor que el subtotal.');
    const disc = allocate(descC, lines.map((x) => x.subC));
    lines.forEach((x, i) => { x.discC = disc[i]; x.netC = x.subC - disc[i]; });
    const total = subTot - descC, costo = sum(lines.map((x) => x.costC));

    const v = (await cl.query(`INSERT INTO ventas(idem_key,fecha,cliente_id,medio_pago,descuento_pen,subtotal_pen,total_pen,costo_pen,observaciones,usuario) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, codigo`,
      [idem, fecha, b.cliente_id || null, medio, m(descC), m(subTot), m(total), m(costo), txt(b.observaciones), user])).rows[0];
    for (const x of lines) {
      await cl.query(`INSERT INTO venta_detalle(venta_id,lote_id,perfume_id,cantidad,precio_unit,subtotal,descuento_pen,ingreso_neto,costo_pen) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [v.id, x.lote_id, x.perfume_id, x.q, x.precio, m(x.subC), m(x.discC), m(x.netC), m(x.costC)]);
      await cl.query('UPDATE lotes SET stock=stock-$2, valor_restante=valor_restante-$3 WHERE id=$1', [x.lote_id, x.q, m(x.costC)]);
      await cl.query(`INSERT INTO movimientos_inventario(lote_id,perfume_id,tipo,cantidad,valor,referencia,motivo,usuario) VALUES($1,$2,'VENTA',$3,$4,$5,'Venta',$6)`, [x.lote_id, x.perfume_id, -x.q, m(-x.costC), v.codigo, user]);
    }
    await caja(cl, { fecha, tipo: 'INGRESO', concepto: `Venta ${v.codigo}`, origen: 'VENTA', origen_id: v.id, monto: m(total), medio, usuario: user });
    if (gMonto > 0) {
      const cat = txt(b.gasto_venta?.categoria) || 'Comisiones de cobro';
      const g = (await cl.query('INSERT INTO gastos(fecha,categoria,descripcion,monto_pen,medio_pago,venta_id,usuario) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [fecha, cat, `Gasto asociado a ${v.codigo}`, m(gMonto), medio, v.id, user])).rows[0];
      await caja(cl, { fecha, tipo: 'EGRESO', concepto: `${cat} (${v.codigo})`, origen: 'GASTO', origen_id: g.id, monto: m(gMonto), medio, usuario: user });
    }
    await audit(cl, user, 'CREAR', 'venta', v.id, { codigo: v.codigo, total: m(total) });
    return v;
  });
});

// Devolución parcial o anulación: siempre con movimientos compensatorios; nada se borra.
export const PATCH = route(async (req, ctx, user) => {
  const b = await req.json();
  const motivo = txt(b.motivo, 'El motivo', true);
  return tx(async (cl) => {
    const v = (await cl.query('SELECT * FROM ventas WHERE id=$1 FOR UPDATE', [b.id])).rows[0];
    if (!v) bad('Venta no encontrada.');
    if (v.estado !== 'ACTIVA') bad(`La venta ya está ${v.estado.toLowerCase()}.`);
    const det = (await cl.query('SELECT * FROM venta_detalle WHERE venta_id=$1 ORDER BY id FOR UPDATE', [b.id])).rows;
    const anular = b.accion === 'anular';
    const pedidos = anular ? det.map((d) => ({ id: d.id, q: d.cantidad - d.cant_devuelta })).filter((x) => x.q > 0)
      : (b.items || []).map((i) => ({ id: Number(i.detalle_id), q: Math.trunc(Number(i.cantidad) || 0) })).filter((x) => x.q > 0);
    if (!pedidos.length) bad('Indica qué cantidad se devuelve.');
    let refund = 0;
    for (const p of pedidos) {
      const d = det.find((x) => x.id === p.id);
      if (!d) bad('Línea de venta no encontrada.');
      const rem = d.cantidad - d.cant_devuelta;
      if (p.q > rem) bad(`Solo se pueden devolver ${rem} unidad(es) de esa línea.`);
      const remCost = toC(d.costo_pen) - toC(d.costo_devuelto), remIng = toC(d.ingreso_neto) - toC(d.ingreso_devuelto);
      const cost = p.q === rem ? remCost : Math.round((remCost * p.q) / rem);
      const ing = p.q === rem ? remIng : Math.round((remIng * p.q) / rem);
      refund += ing;
      await cl.query('UPDATE venta_detalle SET cant_devuelta=cant_devuelta+$2, ingreso_devuelto=ingreso_devuelto+$3, costo_devuelto=costo_devuelto+$4 WHERE id=$1', [d.id, p.q, m(ing), m(cost)]);
      await cl.query('UPDATE lotes SET stock=stock+$2, valor_restante=valor_restante+$3 WHERE id=$1', [d.lote_id, p.q, m(cost)]);
      await cl.query(`INSERT INTO movimientos_inventario(lote_id,perfume_id,tipo,cantidad,valor,referencia,motivo,usuario) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [d.lote_id, d.perfume_id, anular ? 'ANULACION' : 'DEVOLUCION', p.q, m(cost), v.codigo, motivo, user]);
      d.cant_devuelta += p.q;
    }
    if (refund > 0) await caja(cl, { fecha: todayPE(), tipo: 'EGRESO', concepto: `${anular ? 'Anulación' : 'Devolución'} ${v.codigo}`, origen: 'DEVOLUCION', origen_id: v.id, monto: m(refund), medio: v.medio_pago, usuario: user });
    const todo = det.every((d) => d.cant_devuelta === d.cantidad);
    if (todo) await cl.query('UPDATE ventas SET estado=$2, motivo=$3 WHERE id=$1', [v.id, anular ? 'ANULADA' : 'DEVUELTA', motivo]);
    if (anular || todo) {
      const gs = (await cl.query('SELECT * FROM gastos WHERE venta_id=$1 AND NOT anulado', [v.id])).rows;
      for (const g of gs) {
        await cl.query('UPDATE gastos SET anulado=true WHERE id=$1', [g.id]);
        await caja(cl, { fecha: todayPE(), tipo: 'INGRESO', concepto: `Reversión gasto de ${v.codigo}`, origen: 'ANULACION_GASTO', origen_id: g.id, monto: g.monto_pen, medio: g.medio_pago, usuario: user });
      }
    }
    await audit(cl, user, anular ? 'ANULAR' : 'DEVOLVER', 'venta', v.id, { motivo, pedidos });
    return { ok: true };
  });
});
