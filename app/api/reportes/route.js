import { q } from '@/lib/db';
import { route, bad } from '@/lib/api';

export const dynamic = 'force-dynamic';

const CTE = `WITH d AS (SELECT dt.*, v.fecha, l.proveedor_id, l.importacion_id, l.codigo lote_cod, p.marca, p.nombre pnombre, p.ml, p.sku
  FROM venta_detalle dt JOIN ventas v ON v.id=dt.venta_id JOIN lotes l ON l.id=dt.lote_id JOIN perfumes p ON p.id=dt.perfume_id
  WHERE v.fecha BETWEEN $1 AND $2 AND ($3::int IS NULL OR l.proveedor_id=$3) AND ($4::text IS NULL OR p.marca=$4) AND ($5::int IS NULL OR dt.perfume_id=$5))`;
const MET = `SUM(cantidad-cant_devuelta) unidades, SUM(ingreso_neto-ingreso_devuelto) ingreso, SUM(costo_pen-costo_devuelto) costo,
  SUM(ingreso_neto-ingreso_devuelto-costo_pen+costo_devuelto) utilidad,
  ROUND(SUM(ingreso_neto-ingreso_devuelto-costo_pen+costo_devuelto)*100/NULLIF(SUM(ingreso_neto-ingreso_devuelto),0),1) margen`;
const C = (k, label, fmt = 'text') => ({ k, label, fmt });
const VM = [C('unidades', 'Unidades', 'int'), C('ingreso', 'Ingreso', 'money'), C('costo', 'Costo', 'money'), C('utilidad', 'Utilidad', 'money'), C('margen', 'Margen %', 'pct')];

export const GET = route(async (req) => {
  const s = new URL(req.url).searchParams;
  const tipo = s.get('tipo');
  const f = [s.get('desde') || '1900-01-01', s.get('hasta') || '2999-12-31', s.get('proveedor_id') || null, s.get('marca') || null, s.get('perfume_id') || null];

  if (tipo === 'producto')
    return { columns: [C('marca', 'Marca'), C('perfume', 'Perfume'), ...VM], rows: await q(`${CTE} SELECT marca, pnombre||' '||COALESCE(ml::text,'')||'ml' perfume, ${MET} FROM d GROUP BY perfume_id, marca, pnombre, ml ORDER BY utilidad DESC`, f) };
  if (tipo === 'lote')
    return { columns: [C('lote_cod', 'Lote'), C('perfume', 'Perfume'), C('proveedor', 'Proveedor'), ...VM], rows: await q(`${CTE} SELECT d.lote_cod, marca||' '||pnombre perfume, pr.nombre proveedor, ${MET.replace(/SUM\(/g, 'SUM(d.').replace(/NULLIF\(SUM\(d\./, 'NULLIF(SUM(d.')} FROM d JOIN proveedores pr ON pr.id=d.proveedor_id GROUP BY d.lote_id, d.lote_cod, marca, pnombre, pr.nombre ORDER BY utilidad DESC`, f) };
  if (tipo === 'proveedor')
    return { columns: [C('proveedor', 'Proveedor'), ...VM], rows: await q(`${CTE} SELECT pr.nombre proveedor, ${MET.replace(/SUM\(/g, 'SUM(d.')} FROM d JOIN proveedores pr ON pr.id=d.proveedor_id GROUP BY pr.id ORDER BY utilidad DESC`, f) };
  if (tipo === 'periodo')
    return { columns: [C('periodo', 'Mes'), ...VM], rows: await q(`${CTE} SELECT to_char(date_trunc('month', fecha),'YYYY-MM') periodo, ${MET} FROM d GROUP BY 1 ORDER BY 1 DESC`, f) };
  if (tipo === 'caja')
    return {
      columns: [C('codigo', 'Importación'), C('proveedor', 'Proveedor'), C('fecha_compra', 'Fecha'), C('total_usd', 'Compra USD', 'usd'), C('compra_pen', 'Compra S/', 'money'), C('banco_pen', 'Comisión bancaria', 'money'), C('desaduanaje_pen', 'Desaduanaje', 'money'), C('flete_pen', 'Flete', 'money'), C('otros', 'Transp. + otros', 'money'), C('costo_total_pen', 'Inversión total', 'money'), C('recuperado', 'Recuperado (ventas)', 'money'), C('pendiente', 'Pendiente por recuperar', 'money'), C('inventario', 'Inventario restante (costo)', 'money'), C('utilidad', 'Utilidad realizada', 'money')],
      rows: await q(`SELECT i.codigo, p.nombre proveedor, i.fecha_compra, i.total_usd, i.compra_pen, i.banco_pen, i.desaduanaje_pen, i.flete_pen, (i.transporte_pen+i.otros_pen) otros, i.costo_total_pen,
          COALESCE(r.ing,0) recuperado, GREATEST(i.costo_total_pen-COALESCE(r.ing,0),0) pendiente, COALESCE(inv.v,0) inventario, COALESCE(r.ut,0) utilidad
        FROM importaciones i JOIN proveedores p ON p.id=i.proveedor_id
        LEFT JOIN (SELECT l.importacion_id, SUM(d.ingreso_neto-d.ingreso_devuelto) ing, SUM(d.ingreso_neto-d.ingreso_devuelto-d.costo_pen+d.costo_devuelto) ut FROM venta_detalle d JOIN lotes l ON l.id=d.lote_id GROUP BY 1) r ON r.importacion_id=i.id
        LEFT JOIN (SELECT importacion_id, SUM(valor_restante) v FROM lotes GROUP BY 1) inv ON inv.importacion_id=i.id
        WHERE NOT i.anulada AND i.fecha_compra BETWEEN $1 AND $2 AND ($3::int IS NULL OR i.proveedor_id=$3) ORDER BY i.fecha_compra DESC`, [f[0], f[1], f[2]]),
    };
  if (tipo === 'gastos')
    return { columns: [C('categoria', 'Categoría'), C('movimientos', 'Registros', 'int'), C('total', 'Total', 'money')], rows: await q(`SELECT categoria, COUNT(*) movimientos, SUM(monto_pen) total FROM gastos WHERE NOT anulado AND fecha BETWEEN $1 AND $2 GROUP BY categoria ORDER BY total DESC`, [f[0], f[1]]) };
  if (tipo === 'inventario')
    return { columns: [C('marca', 'Marca'), C('perfume', 'Perfume'), C('lote', 'Lote'), C('proveedor', 'Proveedor'), C('stock', 'Stock', 'int'), C('costo_unit', 'Costo unit.', 'money'), C('valor', 'Valor', 'money')],
      rows: await q(`SELECT p.marca, p.nombre||' '||COALESCE(p.ml::text,'')||'ml' perfume, l.codigo lote, pr.nombre proveedor, l.stock, ROUND(l.total_pen/l.cantidad_inicial,2) costo_unit, l.valor_restante valor
        FROM lotes l JOIN perfumes p ON p.id=l.perfume_id JOIN proveedores pr ON pr.id=l.proveedor_id JOIN importaciones i ON i.id=l.importacion_id
        WHERE l.stock>0 AND NOT i.anulada AND ($1::int IS NULL OR l.proveedor_id=$1) AND ($2::text IS NULL OR p.marca=$2) AND ($3::int IS NULL OR l.perfume_id=$3) ORDER BY p.marca, p.nombre, l.id`, [f[2], f[3], f[4]]) };
  bad('Tipo de reporte no válido.');
});
