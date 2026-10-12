import { q, tx, audit } from '@/lib/db';
import { route, bad, txt } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    return q(`SELECT v.id, v.codigo, v.fecha, v.estado, COALESCE(SUM(d.ingreso_neto-d.ingreso_devuelto),0) total
              FROM ventas v LEFT JOIN venta_detalle d ON d.venta_id=v.id WHERE v.cliente_id=$1 GROUP BY v.id ORDER BY v.fecha DESC, v.id DESC`, [id]);
  }
  return q(`SELECT c.*, COALESCE(s.compras,0) compras, COALESCE(s.total,0) total, s.ultima
            FROM clientes c LEFT JOIN (SELECT v.cliente_id, COUNT(DISTINCT v.id) FILTER (WHERE v.estado<>'ANULADA') compras,
                 SUM(d.ingreso_neto-d.ingreso_devuelto) total, MAX(v.fecha) FILTER (WHERE v.estado<>'ANULADA') ultima
                 FROM ventas v JOIN venta_detalle d ON d.venta_id=v.id GROUP BY v.cliente_id) s ON s.cliente_id=c.id
            ORDER BY c.activo DESC, c.nombre`);
});

export const POST = route(async (req, ctx, user) => {
  const b = await req.json();
  const c = [txt(b.nombre, 'El nombre', true), txt(b.telefono), txt(b.email), txt(b.observaciones)];
  return tx(async (cl) => {
    const r = await cl.query('INSERT INTO clientes(nombre,telefono,email,observaciones) VALUES($1,$2,$3,$4) RETURNING *', c);
    await audit(cl, user, 'CREAR', 'cliente', r.rows[0].id, b);
    return r.rows[0];
  });
});

export const PUT = route(async (req, ctx, user) => {
  const b = await req.json();
  if (!b.id) bad('Falta el cliente.');
  return tx(async (cl) => {
    if (b.solo_estado) await cl.query('UPDATE clientes SET activo=$2 WHERE id=$1', [b.id, !!b.activo]);
    else await cl.query('UPDATE clientes SET nombre=$2,telefono=$3,email=$4,observaciones=$5 WHERE id=$1', [b.id, txt(b.nombre, 'El nombre', true), txt(b.telefono), txt(b.email), txt(b.observaciones)]);
    await audit(cl, user, 'EDITAR', 'cliente', b.id, b);
    return { ok: true };
  });
});
