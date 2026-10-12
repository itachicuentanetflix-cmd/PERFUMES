import { q } from '@/lib/db';
import { route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const per = new URL(req.url).searchParams.get('periodo');
  const unit = ['day', 'week', 'month'].includes(per) ? per : 'month';
  const limit = unit === 'day' ? 30 : unit === 'week' ? 16 : 12;

  const [inv] = await q(`SELECT COALESCE(SUM(costo_total_pen),0) inversion, COUNT(*) cajas, COALESCE(SUM(banco_pen),0) banco, COALESCE(SUM(desaduanaje_pen),0) desaduanaje FROM importaciones WHERE NOT anulada`);
  const [stock] = await q(`SELECT COALESCE(SUM(l.valor_restante),0) valor, COALESCE(SUM(l.stock),0) unidades FROM lotes l JOIN importaciones i ON i.id=l.importacion_id WHERE NOT i.anulada`);
  const [ven] = await q(`SELECT COALESCE(SUM(d.ingreso_neto-d.ingreso_devuelto),0) ventas, COALESCE(SUM(d.costo_pen-d.costo_devuelto),0) costo FROM venta_detalle d`);
  const [gas] = await q(`SELECT COALESCE(SUM(monto_pen),0) gastos FROM gastos WHERE NOT anulado`);
  const [cj] = await q(`SELECT COALESCE(SUM(monto_pen) FILTER (WHERE tipo='INGRESO'),0) ingresos, COALESCE(SUM(monto_pen) FILTER (WHERE tipo='EGRESO'),0) egresos FROM movimientos_caja`);
  const [cnt] = await q(`SELECT (SELECT COUNT(*) FROM perfumes WHERE activo) perfumes, (SELECT COUNT(*) FROM proveedores WHERE activo) proveedores`);
  const stockPorPerfume = await q(`SELECT p.id, p.marca, p.nombre, p.ml, p.stock_minimo, COALESCE(SUM(l.stock) FILTER (WHERE NOT i.anulada),0) stock
      FROM perfumes p LEFT JOIN lotes l ON l.perfume_id=p.id LEFT JOIN importaciones i ON i.id=l.importacion_id WHERE p.activo GROUP BY p.id ORDER BY p.marca, p.nombre`);
  const agotados = stockPorPerfume.filter((p) => p.stock === 0);
  const bajos = stockPorPerfume.filter((p) => p.stock > 0 && p.stock <= p.stock_minimo);
  const porProveedor = await q(`SELECT pr.nombre, COUNT(i.id) cajas, COALESCE(SUM(i.costo_total_pen),0) capital FROM proveedores pr LEFT JOIN importaciones i ON i.proveedor_id=pr.id AND NOT i.anulada GROUP BY pr.id HAVING COUNT(i.id)>0 ORDER BY capital DESC`);
  const serie = await q(`SELECT to_char(date_trunc('${unit}', v.fecha), 'YYYY-MM-DD') periodo, SUM(d.ingreso_neto-d.ingreso_devuelto) ventas, SUM(d.ingreso_neto-d.ingreso_devuelto-d.costo_pen+d.costo_devuelto) utilidad
      FROM venta_detalle d JOIN ventas v ON v.id=d.venta_id GROUP BY 1 ORDER BY 1 DESC LIMIT ${limit}`);
  const masVendidos = await q(`SELECT p.marca, p.nombre, p.ml, SUM(d.cantidad-d.cant_devuelta) unidades FROM venta_detalle d JOIN perfumes p ON p.id=d.perfume_id GROUP BY p.id HAVING SUM(d.cantidad-d.cant_devuelta)>0 ORDER BY unidades DESC LIMIT 5`);
  const masRentables = await q(`SELECT p.marca, p.nombre, p.ml, SUM(d.ingreso_neto-d.ingreso_devuelto-d.costo_pen+d.costo_devuelto) utilidad, SUM(d.ingreso_neto-d.ingreso_devuelto) ingreso FROM venta_detalle d JOIN perfumes p ON p.id=d.perfume_id GROUP BY p.id HAVING SUM(d.cantidad-d.cant_devuelta)>0 ORDER BY utilidad DESC LIMIT 5`);
  const costosExtra = await q(`SELECT codigo, costo_total_pen, ROUND(costo_total_pen-compra_pen,2) extra, ROUND((costo_total_pen-compra_pen)*100/NULLIF(compra_pen,0),1) pct FROM importaciones WHERE NOT anulada ORDER BY (costo_total_pen-compra_pen) DESC LIMIT 5`);

  const bruta = ven.ventas - ven.costo;
  return {
    inversion: inv.inversion, cajas: inv.cajas, banco: inv.banco, desaduanaje: inv.desaduanaje,
    inventarioValor: stock.valor, unidades: stock.unidades, ventas: ven.ventas, costoVendido: ven.costo,
    utilidadBruta: Math.round(bruta * 100) / 100, gastos: gas.gastos, utilidadNeta: Math.round((bruta - gas.gastos) * 100) / 100,
    ingresos: cj.ingresos, egresos: cj.egresos, saldoCaja: Math.round((cj.ingresos - cj.egresos) * 100) / 100,
    perfumes: cnt.perfumes, proveedores: cnt.proveedores, agotados, bajos, porProveedor, serie: serie.reverse(), masVendidos, masRentables, costosExtra, unit,
  };
});
