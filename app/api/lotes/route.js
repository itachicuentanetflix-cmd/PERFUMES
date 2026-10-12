import { q } from '@/lib/db';
import { route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const s = new URL(req.url).searchParams;
  const w = [], p = [];
  if (s.get('perfume_id')) { p.push(s.get('perfume_id')); w.push(`l.perfume_id=$${p.length}`); }
  if (s.get('proveedor_id')) { p.push(s.get('proveedor_id')); w.push(`l.proveedor_id=$${p.length}`); }
  if (s.get('con_stock') === '1') w.push('l.stock>0');
  w.push('NOT i.anulada');
  return q(`SELECT l.*, p.marca, p.nombre, p.ml, p.concentracion, p.precio_sugerido, p.stock_minimo, pr.nombre proveedor, i.codigo importacion,
              ROUND(l.total_pen/l.cantidad_inicial,2) costo_unit
            FROM lotes l JOIN perfumes p ON p.id=l.perfume_id JOIN proveedores pr ON pr.id=l.proveedor_id JOIN importaciones i ON i.id=l.importacion_id
            WHERE ${w.join(' AND ')} ORDER BY p.marca, p.nombre, l.fecha_ingreso, l.id`, p);
});
