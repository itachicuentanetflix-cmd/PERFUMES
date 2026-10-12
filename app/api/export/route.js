import ExcelJS from 'exceljs';
import { q } from '@/lib/db';
import { route } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOJAS = [
  ['Proveedores', 'SELECT * FROM proveedores ORDER BY id'],
  ['Perfumes', 'SELECT * FROM perfumes ORDER BY id'],
  ['Importaciones', `SELECT i.codigo, i.fecha_compra, i.fecha_llegada, p.nombre proveedor, i.referencia, i.tracking, i.estado, i.total_usd, i.compra_pen, i.banco_pen comision_y_cargos_bancarios, i.desaduanaje_pen, i.flete_pen, i.transporte_pen, i.otros_pen, i.costo_total_pen, i.total_unidades, i.anulada, i.observaciones, i.usuario FROM importaciones i JOIN proveedores p ON p.id=i.proveedor_id ORDER BY i.id`],
  ['Pagos BCP', `SELECT i.codigo importacion, g.fecha, g.monto_usd, g.tipo_cambio, g.equivalente_pen, g.comision, g.comision_moneda, g.otros_cargos_pen, g.debitado_pen, g.diferencia_pen, g.explicacion, g.referencia FROM importacion_pagos g JOIN importaciones i ON i.id=g.importacion_id ORDER BY g.id`],
  ['Lotes', `SELECT l.codigo lote, i.codigo importacion, pr.nombre proveedor, p.marca, p.nombre perfume, p.ml, l.fecha_ingreso, l.cantidad_inicial, l.stock, l.precio_usd, l.compra_pen, l.comision_pen, l.desaduanaje_pen, l.flete_pen, l.transporte_pen, l.otros_pen, l.total_pen, ROUND(l.total_pen/l.cantidad_inicial,2) costo_unitario, l.valor_restante FROM lotes l JOIN importaciones i ON i.id=l.importacion_id JOIN proveedores pr ON pr.id=l.proveedor_id JOIN perfumes p ON p.id=l.perfume_id ORDER BY l.id`],
  ['Inventario movimientos', `SELECT m.fecha, m.tipo, p.marca, p.nombre perfume, l.codigo lote, m.cantidad, m.valor, m.referencia, m.motivo, m.usuario FROM movimientos_inventario m JOIN lotes l ON l.id=m.lote_id JOIN perfumes p ON p.id=m.perfume_id ORDER BY m.id`],
  ['Clientes', 'SELECT * FROM clientes ORDER BY id'],
  ['Ventas', `SELECT v.codigo, v.fecha, c.nombre cliente, v.medio_pago, v.subtotal_pen, v.descuento_pen, v.total_pen, v.costo_pen, v.estado, v.motivo, v.usuario FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id ORDER BY v.id`],
  ['Detalle ventas', `SELECT v.codigo venta, v.fecha, p.marca, p.nombre perfume, l.codigo lote, pr.nombre proveedor, d.cantidad, d.precio_unit, d.subtotal, d.descuento_pen, d.ingreso_neto, d.costo_pen, d.ingreso_neto-d.costo_pen utilidad, d.cant_devuelta, d.ingreso_devuelto, d.costo_devuelto FROM venta_detalle d JOIN ventas v ON v.id=d.venta_id JOIN perfumes p ON p.id=d.perfume_id JOIN lotes l ON l.id=d.lote_id JOIN proveedores pr ON pr.id=l.proveedor_id ORDER BY d.id`],
  ['Gastos', 'SELECT * FROM gastos ORDER BY id'],
  ['Flujo de caja', 'SELECT * FROM movimientos_caja ORDER BY id'],
  ['Auditoria', 'SELECT * FROM auditoria ORDER BY id'],
];

export const GET = route(async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PERFUMES JEAN';
  for (const [nombre, sql] of HOJAS) {
    const rows = await q(sql);
    const ws = wb.addWorksheet(nombre);
    const cols = rows.length ? Object.keys(rows[0]) : ['(sin registros)'];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.max(14, c.length + 3) }));
    rows.forEach((r) => ws.addRow(Object.fromEntries(cols.map((c) => [c, r[c] !== null && typeof r[c] === 'object' && !(r[c] instanceof Date) ? JSON.stringify(r[c]) : r[c]]))));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(buf, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="perfumes-jean-${fecha}.xlsx"` } });
});
