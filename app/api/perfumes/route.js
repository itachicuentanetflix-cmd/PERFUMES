import { q, tx, audit } from '@/lib/db';
import { route, bad, txt, num } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    return q(`SELECT l.*, pr.nombre proveedor, i.codigo importacion, ROUND(l.total_pen/l.cantidad_inicial,2) costo_unit
              FROM lotes l JOIN proveedores pr ON pr.id=l.proveedor_id JOIN importaciones i ON i.id=l.importacion_id
              WHERE l.perfume_id=$1 ORDER BY l.fecha_ingreso DESC, l.id DESC`, [id]);
  }
  return q(`SELECT p.*, COALESCE(s.stock,0) stock, COALESCE(s.valor,0) valor,
              (SELECT ROUND(l.total_pen/l.cantidad_inicial,2) FROM lotes l WHERE l.perfume_id=p.id ORDER BY l.fecha_ingreso DESC, l.id DESC LIMIT 1) ultimo_costo
            FROM perfumes p LEFT JOIN (SELECT perfume_id, SUM(stock) stock, SUM(valor_restante) valor FROM lotes GROUP BY perfume_id) s ON s.perfume_id=p.id
            ORDER BY p.activo DESC, p.marca, p.nombre`);
});

const clean = (b) => ({
  sku: txt(b.sku, 'El SKU', true).toUpperCase(), marca: txt(b.marca, 'La marca', true), nombre: txt(b.nombre, 'El nombre', true),
  ml: b.ml === '' || b.ml == null ? null : Math.trunc(num(b.ml, 'Los ml', { min: 1 })),
  concentracion: txt(b.concentracion), categoria: ['Hombre', 'Mujer', 'Unisex'].includes(b.categoria) ? b.categoria : null,
  foto_url: txt(b.foto_url), codigo_barras: txt(b.codigo_barras),
  precio_sugerido: num(b.precio_sugerido, 'El precio sugerido'), stock_minimo: Math.trunc(num(b.stock_minimo, 'El stock mínimo')),
});

export const POST = route(async (req, ctx, user) => {
  const c = clean(await req.json());
  return tx(async (cl) => {
    const r = await cl.query('INSERT INTO perfumes(sku,marca,nombre,ml,concentracion,categoria,foto_url,codigo_barras,precio_sugerido,stock_minimo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', Object.values(c));
    await audit(cl, user, 'CREAR', 'perfume', r.rows[0].id, c);
    return r.rows[0];
  });
});

export const PUT = route(async (req, ctx, user) => {
  const b = await req.json();
  if (!b.id) bad('Falta el perfume.');
  return tx(async (cl) => {
    if (b.solo_estado) {
      await cl.query('UPDATE perfumes SET activo=$2 WHERE id=$1', [b.id, !!b.activo]);
      await audit(cl, user, b.activo ? 'ACTIVAR' : 'DESACTIVAR', 'perfume', b.id);
      return { ok: true };
    }
    const c = clean(b);
    await cl.query('UPDATE perfumes SET sku=$2,marca=$3,nombre=$4,ml=$5,concentracion=$6,categoria=$7,foto_url=$8,codigo_barras=$9,precio_sugerido=$10,stock_minimo=$11 WHERE id=$1', [b.id, ...Object.values(c)]);
    await audit(cl, user, 'EDITAR', 'perfume', b.id, c);
    return { ok: true };
  });
});
