import { q, tx, audit } from '@/lib/db';
import { route, bad, txt } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    const imports = await q(`SELECT i.id, i.codigo, i.fecha_compra, i.total_usd, i.costo_total_pen, i.total_unidades, i.anulada FROM importaciones i WHERE i.proveedor_id=$1 ORDER BY i.fecha_compra DESC, i.id DESC`, [id]);
    const productos = await q(`SELECT p.marca, p.nombre, p.ml, l.codigo lote, i.codigo importacion, l.cantidad_inicial, l.stock, ROUND(l.total_pen/l.cantidad_inicial,2) costo_unit FROM lotes l JOIN perfumes p ON p.id=l.perfume_id JOIN importaciones i ON i.id=l.importacion_id WHERE l.proveedor_id=$1 ORDER BY l.fecha_ingreso DESC, l.id DESC`, [id]);
    return { imports, productos };
  }
  return q(`SELECT p.*, COALESCE(s.cajas,0) cajas, COALESCE(s.total_usd,0) total_usd, COALESCE(s.total_pen,0) total_pen
            FROM proveedores p LEFT JOIN (SELECT proveedor_id, COUNT(*) cajas, SUM(total_usd) total_usd, SUM(costo_total_pen) total_pen FROM importaciones WHERE NOT anulada GROUP BY proveedor_id) s ON s.proveedor_id=p.id
            ORDER BY p.activo DESC, p.nombre`);
});

const clean = (b) => ({
  nombre: txt(b.nombre, 'El nombre', true), pais: txt(b.pais), telefono: txt(b.telefono), email: txt(b.email),
  contacto: txt(b.contacto), moneda: ['USD', 'EUR', 'PEN'].includes(b.moneda) ? b.moneda : 'USD', observaciones: txt(b.observaciones),
});

export const POST = route(async (req, ctx, user) => {
  const c = clean(await req.json());
  return tx(async (cl) => {
    const r = await cl.query('INSERT INTO proveedores(nombre,pais,telefono,email,contacto,moneda,observaciones) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [c.nombre, c.pais, c.telefono, c.email, c.contacto, c.moneda, c.observaciones]);
    await audit(cl, user, 'CREAR', 'proveedor', r.rows[0].id, c);
    return r.rows[0];
  });
});

export const PUT = route(async (req, ctx, user) => {
  const b = await req.json();
  if (!b.id) bad('Falta el proveedor.');
  return tx(async (cl) => {
    if (b.solo_estado) {
      await cl.query('UPDATE proveedores SET activo=$2 WHERE id=$1', [b.id, !!b.activo]);
      await audit(cl, user, b.activo ? 'ACTIVAR' : 'DESACTIVAR', 'proveedor', b.id);
      return { ok: true };
    }
    const c = clean(b);
    await cl.query('UPDATE proveedores SET nombre=$2,pais=$3,telefono=$4,email=$5,contacto=$6,moneda=$7,observaciones=$8 WHERE id=$1', [b.id, c.nombre, c.pais, c.telefono, c.email, c.contacto, c.moneda, c.observaciones]);
    await audit(cl, user, 'EDITAR', 'proveedor', b.id, c);
    return { ok: true };
  });
});
