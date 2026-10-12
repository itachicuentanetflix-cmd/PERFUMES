'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money, pct } from '@/lib/client';
import { Loading } from '@/components/ui';

export default function Ticket() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    api('/api/ventas?id=' + id).then(setD).catch((e) => setError(e.message));
  }, []);
  if (!d) return <Loading error={error} retry={() => window.location.reload()} />;
  const { venta: v, lineas, gastos } = d;
  const costo = lineas.reduce((s, l) => s + l.costo_pen, 0);
  const total = lineas.reduce((s, l) => s + l.ingreso_neto, 0);
  const gasto = gastos.filter((g) => !g.anulado).reduce((s, g) => s + g.monto_pen, 0);
  return (
    <>
      <div className="noprint" style={{ marginBottom: 12 }}>
        <button type="button" className="primary" onClick={() => window.print()}>Imprimir ticket</button>{' '}
        <Link className="btn" href="/ventas">Volver a ventas</Link>
      </div>
      <div className="ticket">
        <div style={{ textAlign: 'center' }}><b>PERFUMES JEAN</b><br />Ticket interno de venta</div>
        <hr />
        <div className="l"><span>N°</span><span>{v.codigo}</span></div>
        <div className="l"><span>Fecha</span><span>{v.fecha}</span></div>
        <div className="l"><span>Cliente</span><span>{v.cliente || 'General'}</span></div>
        <div className="l"><span>Pago</span><span>{v.medio_pago}</span></div>
        <div className="l"><span>Estado</span><span>{v.estado}</span></div>
        <hr />
        {lineas.map((l) => (
          <div key={l.id} style={{ marginBottom: 8 }}>
            <div>{l.marca} {l.nombre} {l.ml}ml</div>
            <div className="l"><span>{l.cantidad} × {money(l.precio_unit)}</span><span>{money(l.subtotal)}</span></div>
            <div className="muted" style={{ fontSize: 11 }}>Lote {l.lote} · {l.proveedor} · caja {l.importacion}</div>
            <div className="muted" style={{ fontSize: 11 }}>Costo/u: compra {money(l.c_compra)} + banco {money(l.c_comision)} + desad. {money(l.c_desaduanaje)} + flete {money(l.c_flete)} + otros {money(l.c_otros)}</div>
          </div>))}
        <hr />
        <div className="l"><span>Subtotal</span><span>{money(v.subtotal_pen)}</span></div>
        <div className="l"><span>Descuento</span><span>− {money(v.descuento_pen)}</span></div>
        <div className="l"><b>TOTAL</b><b>{money(v.total_pen)}</b></div>
        <hr />
        <div className="l"><span>Costo de adquisición</span><span>{money(costo)}</span></div>
        <div className="l"><span>Utilidad bruta</span><span>{money(total - costo)} ({pct(total ? ((total - costo) * 100) / total : null)})</span></div>
        {gasto > 0 && <div className="l"><span>Gasto de la venta</span><span>{money(gasto)}</span></div>}
        <hr />
        <div style={{ textAlign: 'center', fontSize: 11 }}>Documento interno, no válido como comprobante tributario.</div>
      </div>
    </>
  );
}
