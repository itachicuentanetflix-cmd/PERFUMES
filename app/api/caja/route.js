import { q } from '@/lib/db';
import { route } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const s = new URL(req.url).searchParams;
  const w = [], p = [];
  if (s.get('desde')) { p.push(s.get('desde')); w.push(`fecha>=$${p.length}`); }
  if (s.get('hasta')) { p.push(s.get('hasta')); w.push(`fecha<=$${p.length}`); }
  if (s.get('tipo')) { p.push(s.get('tipo')); w.push(`tipo=$${p.length}`); }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const rows = await q(`SELECT * FROM movimientos_caja ${where} ORDER BY fecha DESC, id DESC LIMIT 500`, p);
  const [t] = await q(`SELECT COALESCE(SUM(monto_pen) FILTER (WHERE tipo='INGRESO'),0) ingresos, COALESCE(SUM(monto_pen) FILTER (WHERE tipo='EGRESO'),0) egresos FROM movimientos_caja ${where}`, p);
  return { rows, ingresos: t.ingresos, egresos: t.egresos };
});
