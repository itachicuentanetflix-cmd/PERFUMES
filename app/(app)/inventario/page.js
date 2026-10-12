'use client';
import { Fragment, useMemo, useState } from 'react';
import { useLoad } from '@/components/hooks';
import { Loading, Choice, Field, Msg, useRun } from '@/components/ui';
import { api, money } from '@/lib/client';

const MOTIVOS = ['Conteo físico', 'Producto dañado', 'Pérdida o robo', 'Muestra o regalo', 'Error de registro', 'Otro'];

export default function Inventario() {
  const [tab, setTab] = useState('Stock por lote');
  const [fPerf, setFPerf] = useState('');
  const [fProv, setFProv] = useState('');
  const [soloStock, setSolo] = useState(true);
  const qs = `?con_stock=${soloStock ? 1 : 0}${fPerf ? '&perfume_id=' + fPerf : ''}${fProv ? '&proveedor_id=' + fProv : ''}`;
  const { data: lotes, error, reload } = useLoad('/api/lotes' + qs);
  const { data: perfumes } = useLoad('/api/perfumes');
  const { data: provs } = useLoad('/api/proveedores');
  const { data: movs, reload: reloadMov } = useLoad('/api/movimientos');
  const [aj, setAj] = useState(null);
  const { busy, msg, run } = useRun();

  const totales = useMemo(() => (lotes || []).reduce((t, l) => ({ u: t.u + l.stock, v: t.v + l.valor_restante }), { u: 0, v: 0 }), [lotes]);
  const guardar = () => run(async () => {
    const motivo = aj.motivo === 'Otro' ? aj.otro : aj.motivo;
    await api('/api/inventario', { method: 'POST', body: { lote_id: aj.lote.id, tipo: aj.tipo, cantidad: aj.cantidad, motivo } });
    setAj(null); await reload(); await reloadMov();
  }, 'Ajuste registrado con su movimiento.');
  if (!lotes) return <Loading error={error} retry={reload} />;

  return (
    <>
      <h1>Inventario</h1>
      <p className="sub">Cada lote conserva su costo, proveedor y caja. El stock solo cambia con compras, ventas, devoluciones o ajustes con motivo.</p>
      <div className="tabs"><Choice options={['Stock por lote', 'Historial de movimientos']} value={tab} onChange={setTab} /></div>
      <Msg msg={msg} />
      {tab === 'Stock por lote' ? (
        <>
          <div className="card">
            <div className="row">
              <Field label="Perfume"><select value={fPerf} onChange={(e) => setFPerf(e.target.value)}><option value="">Todos</option>{(perfumes || []).map((p) => <option key={p.id} value={p.id}>{p.marca} {p.nombre} {p.ml}ml</option>)}</select></Field>
              <Field label="Proveedor"><select value={fProv} onChange={(e) => setFProv(e.target.value)}><option value="">Todos</option>{(provs || []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
              <div className="fit"><label className="f">&nbsp;</label><label><input type="checkbox" checked={soloStock} onChange={(e) => setSolo(e.target.checked)} /> Solo con stock</label></div>
            </div>
          </div>
          {aj && (
            <div className="card">
              <h2>Ajustar lote {aj.lote.codigo} · {aj.lote.marca} {aj.lote.nombre} (stock {aj.lote.stock})</h2>
              <div className="row">
                <Field label="Tipo"><Choice options={['+', '-']} value={aj.tipo} onChange={(v) => setAj({ ...aj, tipo: v })} /></Field>
                <Field label="Cantidad"><input type="number" min="1" step="1" value={aj.cantidad} onChange={(e) => setAj({ ...aj, cantidad: e.target.value })} /></Field>
              </div>
              <div style={{ marginTop: 10 }}><Field label="Motivo (obligatorio)"><Choice options={MOTIVOS} value={aj.motivo} onChange={(v) => setAj({ ...aj, motivo: v })} /></Field></div>
              {aj.motivo === 'Otro' && <div style={{ marginTop: 8 }}><input placeholder="Describe el motivo" value={aj.otro} onChange={(e) => setAj({ ...aj, otro: e.target.value })} /></div>}
              <div className="row" style={{ marginTop: 12 }}>
                <button type="button" className="primary fit" disabled={busy || !aj.motivo || !aj.cantidad} onClick={() => window.confirm('¿Registrar este ajuste de inventario?') && guardar()}>Registrar ajuste</button>
                <button type="button" className="fit" onClick={() => setAj(null)}>Cancelar</button>
              </div>
            </div>)}
          <div className="card">
            {lotes.length === 0 ? <div className="empty">No hay lotes con esos filtros.</div> : (
              <div className="tbl-wrap"><table>
                <thead><tr><th>Perfume</th><th>Lote</th><th>Proveedor</th><th>Caja</th><th>Ingreso</th><th className="n">Stock</th><th className="n">Costo unit.</th><th className="n">Valor</th><th className="n">Precio sugerido</th><th></th></tr></thead>
                <tbody>
                  {lotes.map((l) => (
                    <tr key={l.id}><td>{l.marca} {l.nombre} {l.ml}ml</td><td>{l.codigo}</td><td>{l.proveedor}</td><td>{l.importacion}</td><td>{l.fecha_ingreso}</td>
                      <td className="n">{l.stock} <span className="muted">/ {l.cantidad_inicial}</span></td><td className="n">{money(l.costo_unit)}</td><td className="n">{money(l.valor_restante)}</td><td className="n">{money(l.precio_sugerido)}</td>
                      <td><button type="button" className="sm" onClick={() => setAj({ lote: l, tipo: '-', cantidad: 1, motivo: '', otro: '' })}>Ajustar</button></td></tr>))}
                  <tr className="tot"><td colSpan={5}>Total</td><td className="n">{totales.u}</td><td></td><td className="n">{money(totales.v)}</td><td colSpan={2}></td></tr>
                </tbody>
              </table></div>)}
          </div>
        </>
      ) : (
        <div className="card">
          {!movs ? 'Cargando…' : movs.length === 0 ? <div className="empty">Sin movimientos.</div> : (
            <div className="tbl-wrap"><table>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Perfume</th><th>Lote</th><th className="n">Cantidad</th><th className="n">Valor</th><th>Referencia</th><th>Motivo</th><th>Usuario</th></tr></thead>
              <tbody>{movs.map((m) => (<tr key={m.id}><td>{new Date(m.fecha).toLocaleString('es-PE')}</td><td><span className="badge">{m.tipo}</span></td><td>{m.marca} {m.nombre}</td><td>{m.lote}</td><td className={'n ' + (m.cantidad >= 0 ? 'pos' : 'neg')}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</td><td className="n">{money(m.valor)}</td><td>{m.referencia}</td><td>{m.motivo}</td><td>{m.usuario}</td></tr>))}</tbody>
            </table></div>)}
          <p className="muted">Se muestran los últimos 300 movimientos. El Excel descargable trae todos.</p>
        </div>)}
    </>
  );
}
