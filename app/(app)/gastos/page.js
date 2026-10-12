'use client';
import { useState } from 'react';
import { useLoad } from '@/components/hooks';
import { Loading, Choice, Field, Msg, useRun } from '@/components/ui';
import { api, money, todayStr } from '@/lib/client';

const CATS = ['Publicidad', 'Alquiler', 'Empaques', 'Delivery', 'Servicios', 'Transporte', 'Comisiones de cobro', 'Administrativos', 'Otros'];
const MEDIOS = ['Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta', 'BCP'];
const VACIO = () => ({ categoria: 'Publicidad', monto: '', medio_pago: 'Efectivo', fecha: todayStr(), referencia: '', descripcion: '' });

export default function Gastos() {
  const { data, error, reload } = useLoad('/api/gastos');
  const [f, setF] = useState(VACIO());
  const { busy, msg, run } = useRun();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = () => run(async () => { await api('/api/gastos', { method: 'POST', body: f }); setF(VACIO()); await reload(); }, 'Gasto registrado y descontado de caja.');
  const anular = (g) => {
    if (!window.confirm('¿Anular este gasto? Se registra un movimiento de reversión en caja.')) return;
    run(async () => { await api('/api/gastos', { method: 'PATCH', body: { id: g.id } }); await reload(); }, 'Gasto anulado.');
  };
  if (!data) return <Loading error={error} retry={reload} />;
  const total = data.filter((g) => !g.anulado).reduce((s, g) => s + g.monto_pen, 0);
  return (
    <>
      <h1>Gastos operativos</h1>
      <p className="sub">Aquí van los gastos del negocio. El desaduanaje, flete y comisión bancaria de las cajas se registran en la importación, no aquí, para no contarlos dos veces.</p>
      <div className="card">
        <Field label="Categoría"><Choice options={CATS} value={f.categoria} onChange={(v) => setF({ ...f, categoria: v })} /></Field>
        <div className="row" style={{ marginTop: 10 }}>
          <Field label="Monto (S/)"><input type="number" min="0" step="0.01" value={f.monto} onChange={set('monto')} /></Field>
          <Field label="Fecha"><input type="date" value={f.fecha} onChange={set('fecha')} /></Field>
          <Field label="Referencia"><input value={f.referencia} onChange={set('referencia')} /></Field>
        </div>
        <div style={{ marginTop: 10 }}><Field label="Medio de pago"><Choice options={MEDIOS} value={f.medio_pago} onChange={(v) => setF({ ...f, medio_pago: v })} /></Field></div>
        <div style={{ marginTop: 10 }}><Field label="Descripción"><input value={f.descripcion} onChange={set('descripcion')} /></Field></div>
        <Msg msg={msg} />
        <button type="button" className="primary" style={{ marginTop: 12 }} disabled={busy || !f.monto} onClick={guardar}>{busy ? 'Guardando…' : 'Registrar gasto'}</button>
      </div>
      <div className="card">
        <h2>Gastos registrados — total vigente {money(total)}</h2>
        {data.length === 0 ? <div className="empty">Sin gastos registrados.</div> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Medio</th><th>Referencia</th><th className="n">Monto</th><th></th></tr></thead>
            <tbody>{data.map((g) => (<tr key={g.id} style={g.anulado ? { opacity: 0.5, textDecoration: 'line-through' } : null}><td>{g.fecha}</td><td>{g.categoria}</td><td>{g.descripcion}</td><td>{g.medio_pago}</td><td>{g.referencia}</td><td className="n">{money(g.monto_pen)}</td>
              <td>{!g.anulado && !g.venta_id && <button type="button" className="sm danger" disabled={busy} onClick={() => anular(g)}>Anular</button>}</td></tr>))}</tbody>
          </table></div>)}
      </div>
    </>
  );
}
