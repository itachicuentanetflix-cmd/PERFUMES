'use client';
import { useState } from 'react';
import { useLoad } from '@/components/hooks';
import { Loading, Choice } from '@/components/ui';
import { money, pct } from '@/lib/client';

const PER = { Día: 'day', Semana: 'week', Mes: 'month' };

export default function Dashboard() {
  const [per, setPer] = useState('Mes');
  const { data: d, error, reload } = useLoad('/api/dashboard?periodo=' + PER[per]);
  if (!d) return <Loading error={error} retry={reload} />;
  const max = Math.max(1, ...d.serie.map((s) => Math.max(s.ventas, 0)));
  const K = ({ t, v, s, cls }) => (<div className="kpi"><span>{t}</span><b className={cls}>{v}</b>{s && <small>{s}</small>}</div>);
  return (
    <>
      <h1>Panel general</h1>
      <p className="sub">Todo sale de los registros reales de compras, ventas y gastos.</p>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <K t="Inversión total en mercadería" v={money(d.inversion)} s={`${d.cajas} cajas importadas`} />
        <K t="Valor del inventario (a costo)" v={money(d.inventarioValor)} s={`${d.unidades} unidades disponibles`} />
        <K t="Ventas netas" v={money(d.ventas)} s={`Costo vendido ${money(d.costoVendido)}`} />
        <K t="Utilidad bruta realizada" v={money(d.utilidadBruta)} cls={d.utilidadBruta >= 0 ? 'pos' : 'neg'} s="Ventas − costo real de los lotes vendidos" />
        <K t="Gastos operativos" v={money(d.gastos)} s="No incluye desaduanaje ni comisión bancaria de las cajas" />
        <K t="Utilidad neta" v={money(d.utilidadNeta)} cls={d.utilidadNeta >= 0 ? 'pos' : 'neg'} s="Utilidad bruta − gastos operativos" />
        <K t="Saldo de caja" v={money(d.saldoCaja)} cls={d.saldoCaja >= 0 ? 'pos' : 'neg'} s={`Entró ${money(d.ingresos)} · Salió ${money(d.egresos)}`} />
        <K t="Perfumes / Proveedores" v={`${d.perfumes} / ${d.proveedores}`} s={`${d.agotados.length} agotados · ${d.bajos.length} con stock bajo`} />
      </div>

      <div className="card">
        <div className="row" style={{ alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Ventas y utilidad por período</h2>
          <div className="fit"><Choice options={Object.keys(PER)} value={per} onChange={setPer} /></div>
        </div>
        {d.serie.length === 0 ? <div className="empty">Aún no hay ventas registradas.</div> : (
          <div className="bars">
            {d.serie.map((s) => (
              <div className="bar" key={s.periodo} title={`${s.periodo}: ventas ${money(s.ventas)} · utilidad ${money(s.utilidad)}`}>
                <i style={{ height: Math.max(1, (Math.max(s.ventas, 0) / max) * 100) + '%' }} />
                <em>{s.periodo.slice(per === 'Mes' ? 0 : 5)}</em>
              </div>
            ))}
          </div>
        )}
        <p className="muted" style={{ margin: '8px 0 0' }}>Cada barra es la venta neta del período; pasa el cursor para ver la utilidad.</p>
      </div>

      <div className="grid g2">
        <div className="card"><h2>Alertas de stock</h2>
          {d.agotados.length + d.bajos.length === 0 ? <div className="empty">Sin alertas.</div> : (
            <table><tbody>
              {d.bajos.map((p) => (<tr key={'b' + p.id}><td>{p.marca} {p.nombre} {p.ml}ml</td><td className="n">{p.stock} / mín. {p.stock_minimo}</td><td><span className="badge warn">Stock bajo</span></td></tr>))}
              {d.agotados.map((p) => (<tr key={'a' + p.id}><td>{p.marca} {p.nombre} {p.ml}ml</td><td className="n">0</td><td><span className="badge bad">Agotado</span></td></tr>))}
            </tbody></table>)}
        </div>
        <div className="card"><h2>Capital invertido por proveedor</h2>
          {d.porProveedor.length === 0 ? <div className="empty">Sin importaciones.</div> : (
            <table><thead><tr><th>Proveedor</th><th className="n">Cajas</th><th className="n">Capital</th></tr></thead>
              <tbody>{d.porProveedor.map((p) => (<tr key={p.nombre}><td>{p.nombre}</td><td className="n">{p.cajas}</td><td className="n">{money(p.capital)}</td></tr>))}</tbody></table>)}
        </div>
        <div className="card"><h2>Perfumes más vendidos</h2>
          {d.masVendidos.length === 0 ? <div className="empty">Sin ventas.</div> : (
            <table><tbody>{d.masVendidos.map((p, i) => (<tr key={i}><td>{p.marca} {p.nombre} {p.ml}ml</td><td className="n">{p.unidades} uds.</td></tr>))}</tbody></table>)}
        </div>
        <div className="card"><h2>Perfumes más rentables</h2>
          {d.masRentables.length === 0 ? <div className="empty">Sin ventas.</div> : (
            <table><tbody>{d.masRentables.map((p, i) => (<tr key={i}><td>{p.marca} {p.nombre} {p.ml}ml</td><td className="n">{money(p.utilidad)}</td><td className="n muted">{pct(p.ingreso ? (p.utilidad * 100) / p.ingreso : null)}</td></tr>))}</tbody></table>)}
        </div>
        <div className="card"><h2>Importaciones con mayores costos adicionales</h2>
          {d.costosExtra.length === 0 ? <div className="empty">Sin importaciones.</div> : (
            <table><thead><tr><th>Caja</th><th className="n">Costos adicionales</th><th className="n">% sobre compra</th></tr></thead>
              <tbody>{d.costosExtra.map((c) => (<tr key={c.codigo}><td>{c.codigo}</td><td className="n">{money(c.extra)}</td><td className="n">{pct(c.pct)}</td></tr>))}</tbody></table>)}
        </div>
        <div className="card"><h2>Utilidad contable y flujo de caja</h2>
          <p className="muted" style={{ marginTop: 0 }}>La utilidad contable solo resta el costo de lo que ya vendiste. El flujo de caja cuenta el dinero que realmente entró y salió, incluida la mercadería que aún tienes en stock. Por eso el saldo de caja suele ser menor que la utilidad mientras haya inventario sin vender.</p>
          <table><tbody>
            <tr><td>Inventario sin vender (dinero inmovilizado)</td><td className="n">{money(d.inventarioValor)}</td></tr>
            <tr><td>Comisiones bancarias pagadas en cajas</td><td className="n">{money(d.banco)}</td></tr>
            <tr><td>Desaduanaje pagado en cajas</td><td className="n">{money(d.desaduanaje)}</td></tr>
          </tbody></table>
        </div>
      </div>
    </>
  );
}
