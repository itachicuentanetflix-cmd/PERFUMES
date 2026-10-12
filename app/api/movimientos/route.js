import { q } from '@/lib/db';
import { route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const s = new URL(req.url).searchParams;
  const w = [], p = [];
  if (s.get('tipo')) { p.push(s.get('tipo')); w.push(`m.tipo=$${p.length}`); }
  if (s.get('perfume_id')) { p.push(s.get('perfume_id')); w.push(`m.perfume_id=$${p.length}`); }
  return q(`SELECT m.id, m.fecha, m.tipo, m.cantidad, m.valor, m.referencia, m.motivo, m.usuario, l.codigo lote, p.marca, p.nombre
            FROM movimientos_inventario m JOIN lotes l ON l.id=m.lote_id JOIN perfumes p ON p.id=m.perfume_id
            ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY m.id DESC LIMIT 300`, p);
});
