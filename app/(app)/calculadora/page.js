'use client';
import { useMemo, useRef, useState } from 'react';
import { useLoad } from '@/components/hooks';
import { Choice, Msg, useRun } from '@/components/ui';
import { api, money, usd, pct, todayStr, uid, perfumeName } from '@/lib/client';
import { computeCaja, GASTOS, KEYS, LABEL, toC } from '@/lib/alloc';

const METODOS = { 'Por valor': 'VALOR', 'Por cantidad': 'CANTIDAD', 'Manual': 'MANUAL' };
const inv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const newItem = () => ({ key: uid(), perfume_id: '', marca: '', nombre: '', cantidad: 1, usd: '', precio_venta: '', manual: {} });
const newPago = () => ({ key: uid(), fecha: todayStr(), monto_usd: '', tc: '', comision: '', comision_moneda: 'PEN', otros: '', debitado: '', referencia: '', explicacion: '' });
const GVACIO = () => ({ desaduanaje: { monto: '', metodo: 'VALOR' }, flete: { monto: '', metodo: 'VALOR' }, transporte: { monto: '', metodo: 'CANTIDAD' }, otros: { monto: '', metodo: 'VALOR' }, comision: { metodo: 'VALOR' } });
const c2 = (c) => c / 100;

export default function Calculadora() {
  const { data: perfumes } = useLoad('/api/perfumes');
  const { data: provs } = useLoad('/api/proveedores');
  const [head, setHead] = useState({ proveedor_id: '', fecha_compra: todayStr(), fecha_llegada: '', referencia: '', tracking: '', observaciones: '' });
  const [items, setItems] = useState([newItem()]);
  const [pagos, setPagos] = useState([newPago()]);
  const [gastos, setGastos] = useState(GVACIO());
  const idem = useRef(uid());
  const { busy, msg, setMsg, run } = useRun();

  const calc = useMemo(() => computeCaja({
    items: items.map((i) => ({ qty: i.cantidad, usd: i.usd, manual: i.manual })),
    pagos: pagos.map((p) => ({ monto_usd: p.monto_usd, tc: p.tc, comision: p.comision, comision_moneda: p.comision_moneda, otros: p.otros, debitado: p.debitado })),
    gastos,
  }), [items, pagos, gastos]);

  const upItem = (k, patch) => setItems(items.map((i) => (i.key === k ? { ...i, ...patch } : i)));
  const upPago = (k, patch) => setPagos(pagos.map((p) => (p.key === k ? { ...p, ...patch } : p)));
  const upG = (k, patch) => setGastos({ ...gastos, [k]: { ...gastos[k], ...patch } });
  const elegir = (key, id) => {
    const p = (perfumes || []).find((x) => String(x.id) === id);
    upItem(key, { perfume_id: id, ...(p && !items.find((i) => i.key === key).precio_venta ? { precio_venta: p.precio_sugerido || '' } : {}) });
  };
  const aplicarMargen = (m) => setItems(items.map((i, n) => {
    const u = calc.lines[n]?.unitC; if (!u) return i;
    return { ...i, precio_venta: Math.ceil(c2(u) / (1 - m / 100)) };
  }));

  const manuales = KEYS.filter((k) => gastos[k].metodo === 'MANUAL');
  const hasDeb = pagos.every((p) => p.debitado !== '');
  const listoParaGuardar = !calc.errors.length && head.proveedor_id && items.every((i) => i.perfume_id) && hasDeb;

  const limpiar = () => { if (!window.confirm('¿Limpiar toda la calculadora?')) return; setItems([newItem()]); setPagos([newPago()]); setGastos(GVACIO()); idem.current = uid(); setMsg(null); };

  const registrar = () => run(async () => {
    if (!head.proveedor_id) throw new Error('Elige el proveedor.');
    if (items.some((i) => !i.perfume_id)) throw new Error('Cada línea debe tener un perfume del catálogo. Si falta, regístralo primero en Perfumes.');
    if (!hasDeb) throw new Error('Escribe el importe realmente debitado por el banco en cada pago.');
    if (calc.errors.length) throw new Error(calc.errors[0]);
    const desc = `Se registrará la importación con ${calc.totals.units} perfumes.\nInversión total: ${money(c2(calc.totals.totalC))}\n\nSe crearán lotes con estos costos y se registrarán los egresos en caja. ¿Confirmas?`;
    if (!window.confirm(desc)) return;
    const r = await api('/api/importaciones', { method: 'POST', body: {
      ...head, idem_key: idem.current,
      items: items.map((i) => ({ perfume_id: i.perfume_id, cantidad: i.cantidad, precio_usd: i.usd, manual: i.manual })),
      pagos: pagos.map(({ key, ...p }) => p),
      gastos: Object.fromEntries(KEYS.map((k) => [k, { monto: gastos[k].monto, metodo: gastos[k].metodo }])),
    } });
    setMsg({ t: 'ok', m: `Importación ${r.codigo} registrada. Los lotes ya están en el inventario.` });
    setItems([newItem()]); setPagos([newPago()]); setGastos(GVACIO()); idem.current = uid();
  });

  const L = calc.lines;
  const T = calc.totals;
  return (
    <>
      <h1>Calculadora de cajas</h1>
      <p className="sub">Calcula el costo real de cada perfume. No guarda nada hasta que pulses “Registrar como importación” y confirmes.</p>

      <div className="card">
        <h2>1. Datos de la compra</h2>
        <div className="row">
          <div><label className="f">Proveedor</label><select value={head.proveedor_id} onChange={(e) => setHead({ ...head, proveedor_id: e.target.value })}><option value="">— Elige —</option>{(provs || []).filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
          <div><label className="f">Fecha de compra</label><input type="date" value={head.fecha_compra} onChange={(e) => setHead({ ...head, fecha_compra: e.target.value })} /></div>
          <div><label className="f">Fecha de llegada</label><input type="date" value={head.fecha_llegada} onChange={(e) => setHead({ ...head, fecha_llegada: e.target.value })} /></div>
          <div><label className="f">Referencia / comprobante</label><input value={head.referencia} onChange={(e) => setHead({ ...head, referencia: e.target.value })} /></div>
          <div><label className="f">Código de seguimiento</label><input value={head.tracking} onChange={(e) => setHead({ ...head, tracking: e.target.value })} /></div>
        </div>
      </div>

      <div className="card">
        <h2>2. Perfumes de la caja</h2>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Perfume</th><th className="n">Cantidad</th><th className="n">Precio unit. USD</th><th className="n">Total USD</th><th></th></tr></thead>
          <tbody>{items.map((i, n) => (
            <tr key={i.key}>
              <td style={{ minWidth: 260 }}>
                <select value={i.perfume_id} onChange={(e) => elegir(i.key, e.target.value)}>
                  <option value="">— Solo cálculo (sin registrar) —</option>
                  {(perfumes || []).filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{perfumeName(p)}</option>)}
                </select>
                {!i.perfume_id && <input style={{ marginTop: 4 }} placeholder="Marca y nombre (opcional)" value={i.nombre} onChange={(e) => upItem(i.key, { nombre: e.target.value })} />}
              </td>
              <td className="n"><input type="number" min="1" step="1" value={i.cantidad} onChange={(e) => upItem(i.key, { cantidad: e.target.value })} /></td>
              <td className="n"><input type="number" min="0" step="0.01" value={i.usd} onChange={(e) => upItem(i.key, { usd: e.target.value })} /></td>
              <td className="n">{usd(c2(L[n]?.usdC || 0))}</td>
              <td><button type="button" className="sm danger" disabled={items.length === 1} onClick={() => setItems(items.filter((x) => x.key !== i.key))}>Quitar</button></td>
            </tr>))}
            <tr className="tot"><td>Total de la caja</td><td className="n">{T.units}</td><td></td><td className="n">{usd(c2(T.totalUsdC))}</td><td></td></tr>
          </tbody>
        </table></div>
        <button type="button" style={{ marginTop: 10 }} onClick={() => setItems([...items, newItem()])}>Agregar perfume</button>
      </div>

      <div className="card">
        <h2>3. Pagos en dólares por BCP</h2>
        {pagos.map((p, n) => {
          const r = calc.pagos[n];
          return (
            <div key={p.key} style={{ borderBottom: '1px solid #eceff2', paddingBottom: 12, marginBottom: 12 }}>
              <div className="row">
                <div><label className="f">Fecha del pago</label><input type="date" value={p.fecha} onChange={(e) => upPago(p.key, { fecha: e.target.value })} /></div>
                <div><label className="f">Monto pagado (USD)</label><input type="number" min="0" step="0.01" value={p.monto_usd} onChange={(e) => upPago(p.key, { monto_usd: e.target.value })} /></div>
                <div className="fit"><button type="button" className="sm" onClick={() => upPago(p.key, { monto_usd: c2(Math.max(0, T.totalUsdC - calc.pagos.filter((_, j) => j !== n).reduce((s, x) => s + x.usdC, 0))) })}>Usar el saldo de la caja</button></div>
                <div><label className="f">Tipo de cambio real</label><input type="number" min="0" step="0.0001" value={p.tc} onChange={(e) => upPago(p.key, { tc: e.target.value })} /></div>
                <div><label className="f">Equivalente en soles</label><input readOnly value={r ? money(c2(r.equivC)) : ''} /></div>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <div><label className="f">Comisión BCP</label><input type="number" min="0" step="0.01" value={p.comision} onChange={(e) => upPago(p.key, { comision: e.target.value })} /></div>
                <div className="fit"><label className="f">Moneda de la comisión</label><Choice options={['PEN', 'USD']} value={p.comision_moneda} onChange={(v) => upPago(p.key, { comision_moneda: v })} /></div>
                <div><label className="f">Otros cargos bancarios (S/)</label><input type="number" min="0" step="0.01" value={p.otros} onChange={(e) => upPago(p.key, { otros: e.target.value })} /></div>
                <div><label className="f">Importe realmente debitado (S/)</label><input type="number" min="0" step="0.01" value={p.debitado} onChange={(e) => upPago(p.key, { debitado: e.target.value })} /></div>
                <div><label className="f">Referencia de operación</label><input value={p.referencia} onChange={(e) => upPago(p.key, { referencia: e.target.value })} /></div>
              </div>
              {r && r.diffC != null && (Math.abs(r.diffC) <= 1
                ? <div className="msg ok">Cuadra: compra convertida + comisión y cargos = {money(c2(r.expC))}, igual a lo debitado.</div>
                : <div className="msg warn">No cuadra: compra convertida + comisión y cargos = {money(c2(r.expC))}, pero el banco debitó {money(c2(r.debC))} (diferencia {money(c2(r.diffC))}). Explica el motivo.
                  <input style={{ marginTop: 6 }} placeholder="Explicación de la diferencia" value={p.explicacion} onChange={(e) => upPago(p.key, { explicacion: e.target.value })} /></div>)}
              {pagos.length > 1 && <button type="button" className="sm danger" style={{ marginTop: 6 }} onClick={() => setPagos(pagos.filter((x) => x.key !== p.key))}>Quitar este pago</button>}
            </div>
          );
        })}
        <button type="button" onClick={() => setPagos([...pagos, newPago()])}>Agregar otro pago (pago parcial u otro tipo de cambio)</button>
        <p className="muted" style={{ marginBottom: 0 }}>El costo bancario real es lo debitado menos la compra convertida; así no se cuenta nada dos veces ni se inventa una comisión. En modo cálculo puedes dejar “debitado” vacío y se usarán la comisión y los cargos que escribiste.</p>
      </div>

      <div className="card">
        <h2>4. Gastos de la importación y cómo se reparten</h2>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Gasto</th><th className="n">Monto (S/)</th><th>Método de reparto</th></tr></thead>
          <tbody>
            {GASTOS.map(([k, nombre]) => (
              <tr key={k}><td>{nombre}</td>
                <td className="n"><input type="number" min="0" step="0.01" value={gastos[k].monto} onChange={(e) => upG(k, { monto: e.target.value })} /></td>
                <td><Choice options={Object.keys(METODOS)} value={inv(METODOS)[gastos[k].metodo]} onChange={(v) => upG(k, { metodo: METODOS[v] })} /></td></tr>))}
            <tr><td>Comisión y cargos bancarios (de los pagos)</td><td className="n">{money(c2(T.bankTotC))}</td>
              <td><Choice options={Object.keys(METODOS)} value={inv(METODOS)[gastos.comision.metodo]} onChange={(v) => upG('comision', { metodo: METODOS[v] })} /></td></tr>
          </tbody>
        </table></div>
        <p className="muted" style={{ marginBottom: 0 }}>Por valor: los perfumes más caros cargan más gasto. Por cantidad: todos cargan lo mismo por unidad. Manual: tú indicas cuánto corresponde a cada línea.</p>
        {manuales.length > 0 && (
          <div className="tbl-wrap" style={{ marginTop: 10 }}><table>
            <thead><tr><th>Asignación manual (S/ por línea)</th>{manuales.map((k) => <th key={k} className="n">{LABEL[k]}</th>)}</tr></thead>
            <tbody>
              {items.map((i, n) => (<tr key={i.key}><td>{(perfumes || []).find((p) => String(p.id) === i.perfume_id)?.nombre || i.nombre || `Línea ${n + 1}`}</td>
                {manuales.map((k) => (<td key={k} className="n"><input type="number" min="0" step="0.01" value={i.manual[k] ?? ''} onChange={(e) => upItem(i.key, { manual: { ...i.manual, [k]: e.target.value } })} /></td>))}</tr>))}
              <tr className="tot"><td>Falta repartir</td>{manuales.map((k) => { const asign = items.reduce((s, i) => s + toC(i.manual[k]), 0); const falta = calc.alloc[k].totalC - asign; return <td key={k} className={'n ' + (falta === 0 ? 'pos' : 'neg')}>{money(c2(falta))}</td>; })}</tr>
            </tbody>
          </table></div>)}
      </div>

      <div className="card">
        <h2>5. Resultado: costo real por perfume</h2>
        <div className="row" style={{ alignItems: 'center', marginBottom: 10 }}>
          <span className="fit muted">Proponer precio con margen sobre la venta:</span>
          <div className="fit choice">{[20, 30, 40, 50].map((m) => <button key={m} type="button" className="chip" onClick={() => aplicarMargen(m)}>{m}%</button>)}</div>
        </div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Perfume</th><th className="n">Cant.</th><th className="n">Compra S/</th><th className="n">Comisión</th><th className="n">Desaduanaje</th><th className="n">Flete</th><th className="n">Transp.</th><th className="n">Otros</th><th className="n">Total línea</th><th className="n">Costo original unit.</th><th className="n">Costo final unit.</th><th className="n">Dif. unit.</th><th className="n">Precio venta</th><th className="n">Utilidad unit.</th><th className="n">Margen</th><th className="n">Recargo s/ costo</th></tr></thead>
          <tbody>
            {L.map((l, n) => {
              const pv = Number(items[n].precio_venta) || 0; const ut = pv - c2(l.unitC);
              const nombre = (perfumes || []).find((p) => String(p.id) === items[n].perfume_id);
              return (<tr key={items[n].key}>
                <td>{nombre ? nombre.marca + ' ' + nombre.nombre : items[n].nombre || `Línea ${n + 1}`}</td><td className="n">{l.qty}</td>
                <td className="n">{money(c2(l.compraC))}</td><td className="n">{money(c2(l.p.comision))}</td><td className="n">{money(c2(l.p.desaduanaje))}</td><td className="n">{money(c2(l.p.flete))}</td><td className="n">{money(c2(l.p.transporte))}</td><td className="n">{money(c2(l.p.otros))}</td>
                <td className="n">{money(c2(l.totalC))}</td><td className="n">{money(c2(l.origUnitC))}</td><td className="n"><b>{money(c2(l.unitC))}</b></td><td className="n">{money(c2(l.unitC - l.origUnitC))}</td>
                <td className="n"><input type="number" min="0" step="0.5" value={items[n].precio_venta} onChange={(e) => upItem(items[n].key, { precio_venta: e.target.value })} style={{ width: 90 }} /></td>
                <td className={'n ' + (ut >= 0 ? 'pos' : 'neg')}>{pv ? money(ut) : '—'}</td><td className="n">{pv ? pct((ut * 100) / pv) : '—'}</td><td className="n">{pv && l.unitC ? pct((ut * 100) / c2(l.unitC)) : '—'}</td>
              </tr>);
            })}
            <tr className="tot"><td>Total caja</td><td className="n">{T.units}</td>
              <td className="n">{money(c2(L.reduce((s, l) => s + l.compraC, 0)))}</td>
              {KEYS.map((k) => <td key={k} className="n">{money(c2(calc.alloc[k].totalC))}</td>)}
              <td className="n">{money(c2(T.totalC))}</td><td colSpan={7}></td></tr>
          </tbody>
        </table></div>
        <p className="muted">El costo unitario se muestra redondeado; el total de cada línea es exacto y la suma de todas las líneas es exactamente la inversión total.</p>
        {calc.errors.length > 0 ? <div className="msg err">{calc.errors.map((e, i) => <div key={i}>• {e}</div>)}</div> : <div className="msg ok">Todo cuadra al céntimo. Inversión total: {money(c2(T.totalC))} (compra {money(c2(T.equivTotC))} + bancos {money(c2(T.bankTotC))} + gastos {money(c2(T.totalC - T.equivTotC - T.bankTotC))}).</div>}
        <Msg msg={msg} />
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="primary fit" disabled={busy || !listoParaGuardar} onClick={registrar}>{busy ? 'Registrando…' : 'Registrar como importación'}</button>
          <button type="button" className="fit" onClick={limpiar}>Limpiar calculadora</button>
        </div>
        {!listoParaGuardar && <p className="muted">Para registrar: elige proveedor, un perfume del catálogo en cada línea, escribe lo debitado por el banco y corrige los avisos en rojo.</p>}
      </div>
    </>
  );
}
