'use client';
import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useLoad } from '@/components/hooks';
import { Loading, Msg, useRun } from '@/components/ui';
import { api, money, usd } from '@/lib/client';

export default function Importaciones() {
  const { data, error, reload } = useLoad('/api/importaciones');
  const [open, setOpen] = useState(null);
  const [det, setDet] = useState({});
  const { busy, msg, setMsg, run } = useRun();
  const abrir = async (i) => {
    if (open === i.id) return setOpen(null);
    setOpen(i.id);
    if (!det[i.id]) { try { setDet({ ...det, [i.id]: await api('/api/importaciones?id=' + i.id) }); } catch (e) { setMsg({ t: 'err', m: e.message }); } }
  };
  const anular = (i) => {
    const motivo = window.prompt(`Motivo para anular ${i.codigo} (obligatorio).\nSolo se puede si no se vendió nada de sus lotes. La reversión se registra en caja como ingreso.`);
    if (!motivo) return;
    run(async () => { await api('/api/importaciones', { method: 'PATCH', body: { id: i.id, motivo } }); setDet({}); await reload(); }, `${i.codigo} anulada.`);
  };
  if (!data) return <Loading error={error} retry={reload} />;
  return (
    <>
      <h1>Importaciones</h1>
      <p className="sub">Cada caja con su inversión real, sus pagos y sus lotes. Para registrar una nueva usa la calculadora.</p>
      <Link className="btn primary" href="/calculadora">Nueva caja</Link>
      <Msg msg={msg} />
      <div className="card" style={{ marginTop: 16 }}>
        {data.length === 0 ? <div className="empty">Aún no hay importaciones registradas.</div> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Caja</th><th>Fecha</th><th>Proveedor</th><th className="n">Uds.</th><th className="n">Compra USD</th><th className="n">Banco</th><th className="n">Desaduanaje</th><th className="n">Inversión total</th><th className="n">Recuperado</th><th className="n">Pendiente</th><th></th></tr></thead>
            <tbody>{data.map((i) => (
              <Fragment key={i.id}>
                <tr style={i.anulada ? { opacity: 0.55 } : null}>
                  <td>{i.codigo}{i.anulada && <> <span className="badge bad">Anulada</span></>}</td><td>{i.fecha_compra}</td><td>{i.proveedor}</td><td className="n">{i.total_unidades}</td>
                  <td className="n">{usd(i.total_usd)}</td><td className="n">{money(i.banco_pen)}</td><td className="n">{money(i.desaduanaje_pen)}</td>
                  <td className="n"><b>{money(i.costo_total_pen)}</b></td><td className="n">{money(i.recuperado)}</td><td className="n">{money(Math.max(0, i.costo_total_pen - i.recuperado))}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><button type="button" className="sm" onClick={() => abrir(i)}>{open === i.id ? 'Ocultar' : 'Detalle'}</button>{!i.anulada && <> <button type="button" className="sm danger" disabled={busy} onClick={() => anular(i)}>Anular</button></>}</td>
                </tr>
                {open === i.id && (<tr><td colSpan={11} style={{ background: '#fafbfc' }}>
                  {!det[i.id] ? 'Cargando…' : (<>
                    <b>Pagos por BCP</b>
                    <table><thead><tr><th>Fecha</th><th className="n">USD</th><th className="n">T. cambio</th><th className="n">Equiv. S/</th><th className="n">Comisión</th><th className="n">Otros cargos</th><th className="n">Debitado</th><th className="n">Diferencia</th><th>Referencia / explicación</th></tr></thead>
                      <tbody>{det[i.id].pagos.map((p) => (<tr key={p.id}><td>{p.fecha}</td><td className="n">{usd(p.monto_usd)}</td><td className="n">{p.tipo_cambio}</td><td className="n">{money(p.equivalente_pen)}</td><td className="n">{p.comision} {p.comision_moneda}</td><td className="n">{money(p.otros_cargos_pen)}</td><td className="n">{money(p.debitado_pen)}</td><td className="n">{money(p.diferencia_pen)}</td><td>{p.referencia} {p.explicacion}</td></tr>))}</tbody></table>
                    <div style={{ height: 8 }} /><b>Lotes generados</b>
                    <table><thead><tr><th>Lote</th><th>Perfume</th><th className="n">Cant.</th><th className="n">Stock</th><th className="n">Compra</th><th className="n">Comisión</th><th className="n">Desaduanaje</th><th className="n">Flete</th><th className="n">Transp.+otros</th><th className="n">Total lote</th><th className="n">Costo unit.</th></tr></thead>
                      <tbody>{det[i.id].lotes.map((l) => (<tr key={l.id}><td>{l.codigo}</td><td>{l.marca} {l.nombre} {l.ml}ml</td><td className="n">{l.cantidad_inicial}</td><td className="n">{l.stock}</td><td className="n">{money(l.compra_pen)}</td><td className="n">{money(l.comision_pen)}</td><td className="n">{money(l.desaduanaje_pen)}</td><td className="n">{money(l.flete_pen)}</td><td className="n">{money(l.transporte_pen + l.otros_pen)}</td><td className="n">{money(l.total_pen)}</td><td className="n"><b>{money(l.costo_unit)}</b></td></tr>))}</tbody></table>
                  </>)}
                </td></tr>)}
              </Fragment>
            ))}</tbody>
          </table></div>)}
      </div>
    </>
  );
}
