'use client';
import { useState } from 'react';
import { useLoad } from '@/components/hooks';
import { Loading, Choice } from '@/components/ui';
import { money } from '@/lib/client';

export default function Caja() {
  const [tipo, setTipo] = useState('Todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const qs = new URLSearchParams({ ...(tipo !== 'Todos' ? { tipo: tipo === 'Ingresos' ? 'INGRESO' : 'EGRESO' } : {}), ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) }).toString();
  const { data, error, reload } = useLoad('/api/caja?' + qs);
  if (!data) return <Loading error={error} retry={reload} />;
  return (
    <>
      <h1>Flujo de caja</h1>
      <p className="sub">Todo el dinero que entra y sale, con su origen. Las anulaciones aparecen como movimientos de reversión.</p>
      <div className="card">
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="fit"><Choice options={['Todos', 'Ingresos', 'Egresos']} value={tipo} onChange={setTipo} /></div>
          <div><label className="f">Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
          <div><label className="f">Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        </div>
      </div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="kpi"><span>Ingresos</span><b className="pos">{money(data.ingresos)}</b></div>
        <div className="kpi"><span>Egresos</span><b className="neg">{money(data.egresos)}</b></div>
        <div className="kpi"><span>Saldo del período</span><b>{money(data.ingresos - data.egresos)}</b></div>
      </div>
      <div className="card">
        {data.rows.length === 0 ? <div className="empty">Sin movimientos.</div> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Origen</th><th>Medio</th><th>Referencia</th><th className="n">Monto</th></tr></thead>
            <tbody>{data.rows.map((m) => (<tr key={m.id}><td>{m.fecha}</td><td><span className={'badge ' + (m.tipo === 'INGRESO' ? 'ok' : 'bad')}>{m.tipo}</span></td><td>{m.concepto}</td><td>{m.origen}</td><td>{m.medio_pago}</td><td>{m.referencia}</td><td className={'n ' + (m.tipo === 'INGRESO' ? 'pos' : 'neg')}>{m.tipo === 'INGRESO' ? '+' : '−'} {money(m.monto_pen)}</td></tr>))}</tbody>
          </table></div>)}
      </div>
    </>
  );
}
