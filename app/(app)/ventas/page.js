'use client';
import { Fragment, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLoad } from '@/components/hooks';
import { Loading, Choice, Field, Msg, useRun } from '@/components/ui';
import { api, money, pct, todayStr, uid } from '@/lib/client';
import { toC, allocate } from '@/lib/alloc';

const MEDIOS = ['Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta'];
const c2 = (c) => c / 100;

export default function Ventas() {
  const [tab, setTab] = useState('Nueva venta');
  const { data: lotes, error, reload: reloadLotes } = useLoad('/api/lotes?con_stock=1');
  const { data: clientes, reload: reloadCli } = useLoad('/api/clientes');
  const { data: ventas, reload: reloadVentas } = useLoad('/api/ventas');
  const [perfumeId, setPerfumeId] = useState('');
  const [sel, setSel] = useState(null);
  const [cant, setCant] = useState(1);
  const [precio, setPrecio] = useState('');
  const [cart, setCart] = useState([]);
  const [f, setF] = useState({ cliente_id: '', medio_pago: 'Efectivo', descuento: '', fecha: todayStr(), gasto: '', gasto_cat: 'Comisiones de cobro' });
  const [nuevoCli, setNuevoCli] = useState(null);
  const idem = useRef(uid());
  const [ultima, setUltima] = useState(null);
  const { busy, msg, setMsg, run } = useRun();

  const perfumesConStock = useMemo(() => {
    const m = new Map();
    (lotes || []).forEach((l) => m.set(l.perfume_id, { id: l.perfume_id, txt: `${l.marca} ${l.nombre} ${l.ml}ml ${l.concentracion || ''}` }));
    return [...m.values()];
  }, [lotes]);
  const lotesDe = (lotes || []).filter((l) => String(l.perfume_id) === perfumeId);
  const enCarrito = (id) => cart.filter((c) => c.lote.id === id).reduce((s, c) => s + c.cant, 0);
  const disponible = sel ? sel.stock - enCarrito(sel.id) : 0;
  const unitCosto = (l) => ({ compra: l.compra_pen / l.cantidad_inicial, com: l.comision_pen / l.cantidad_inicial, desa: l.desaduanaje_pen / l.cantidad_inicial, flete: l.flete_pen / l.cantidad_inicial, otros: (l.transporte_pen + l.otros_pen) / l.cantidad_inicial, total: l.total_pen / l.cantidad_inicial });

  const elegirLote = (l) => { setSel(l); setPrecio(l.precio_sugerido || ''); setCant(1); };
  const agregar = () => {
    if (!sel) return setMsg({ t: 'err', m: 'Elige el lote del que sale el perfume.' });
    const q = Math.trunc(Number(cant));
    if (!(q > 0)) return setMsg({ t: 'err', m: 'La cantidad debe ser mayor que 0.' });
    if (q > disponible) return setMsg({ t: 'err', m: `Solo quedan ${disponible} unidades disponibles en ${sel.codigo}.` });
    if (precio === '' || Number(precio) < 0) return setMsg({ t: 'err', m: 'Escribe el precio de venta real.' });
    setCart([...cart, { key: uid(), lote: sel, cant: q, precio: Number(precio) }]);
    setSel(null); setPerfumeId(''); setMsg(null);
  };

  const sub = cart.reduce((s, c) => s + toC(c.cant * c.precio), 0);
  const desc = toC(f.descuento);
  const disc = allocate(Math.min(desc, sub), cart.map((c) => toC(c.cant * c.precio)));
  const total = sub - Math.min(desc, sub);
  const costoTotal = cart.reduce((s, c) => s + Math.round(toC(c.lote.total_pen) * c.cant / c.lote.cantidad_inicial), 0);
  const gasto = toC(f.gasto);

  const confirmar = () => run(async () => {
    if (!cart.length) throw new Error('Agrega al menos un perfume.');
    if (desc > sub) throw new Error('El descuento no puede ser mayor que el subtotal.');
    if (!window.confirm(`Registrar venta por ${money(c2(total))}? Se descontará el stock de los lotes elegidos.`)) return;
    const r = await api('/api/ventas', { method: 'POST', body: {
      idem_key: idem.current, fecha: f.fecha, cliente_id: f.cliente_id || null, medio_pago: f.medio_pago, descuento: f.descuento,
      items: cart.map((c) => ({ lote_id: c.lote.id, cantidad: c.cant, precio_unit: c.precio })),
      gasto_venta: f.gasto ? { monto: f.gasto, categoria: f.gasto_cat } : null,
    } });
    setUltima(r); setCart([]); setF({ ...f, descuento: '', gasto: '' }); idem.current = uid();
    await Promise.all([reloadLotes(), reloadVentas(), reloadCli()]);
  }, 'Venta registrada.');

  const crearCliente = () => run(async () => {
    const c = await api('/api/clientes', { method: 'POST', body: nuevoCli });
    await reloadCli(); setF({ ...f, cliente_id: String(c.id) }); setNuevoCli(null);
  }, 'Cliente creado.');

  if (!lotes) return <Loading error={error} retry={reloadLotes} />;
  return (
    <>
      <h1>Ventas</h1>
      <p className="sub">Elige el perfume y el lote (proveedor y caja). Solo se descuenta el stock del lote elegido.</p>
      <div className="tabs"><Choice options={['Nueva venta', 'Historial']} value={tab} onChange={setTab} /></div>
      <Msg msg={msg} />
      {ultima && tab === 'Nueva venta' && <div className="msg ok">Venta {ultima.codigo} guardada. <Link href={'/ventas/ticket?id=' + ultima.id}>Ver e imprimir ticket</Link></div>}
      {tab === 'Nueva venta' ? (
        <>
          <div className="card">
            <h2>1. Agregar perfume</h2>
            <Field label="Perfume (solo los que tienen stock)">
              <select value={perfumeId} onChange={(e) => { setPerfumeId(e.target.value); setSel(null); }}><option value="">— Elige —</option>{perfumesConStock.map((p) => <option key={p.id} value={p.id}>{p.txt}</option>)}</select>
            </Field>
            {perfumeId && (
              <div style={{ marginTop: 12 }}>
                <label className="f">Lote / proveedor</label>
                <div className="grid g3">
                  {lotesDe.map((l) => (
                    <button type="button" key={l.id} className={'chip' + (sel?.id === l.id ? ' on' : '')} style={{ borderRadius: 6, textAlign: 'left', padding: '10px 12px' }} onClick={() => elegirLote(l)}>
                      <b>{l.codigo}</b> · {l.proveedor}<br /><small>Caja {l.importacion} · stock {l.stock - enCarrito(l.id)} · costo {money(l.costo_unit)}</small>
                    </button>))}
                </div>
              </div>)}
            {sel && (() => { const u = unitCosto(sel); const p = Number(precio) || 0; const ut = p - u.total; return (
              <div style={{ marginTop: 14 }}>
                <div className="row">
                  <Field label={`Cantidad (disponible ${disponible})`}><input type="number" min="1" step="1" value={cant} onChange={(e) => setCant(e.target.value)} /></Field>
                  <Field label="Precio de venta real (S/ por unidad)"><input type="number" min="0" step="0.5" value={precio} onChange={(e) => setPrecio(e.target.value)} /></Field>
                </div>
                <div className="tbl-wrap" style={{ marginTop: 10 }}><table>
                  <thead><tr><th className="n">Costo original</th><th className="n">Comisión banc.</th><th className="n">Desaduanaje</th><th className="n">Flete</th><th className="n">Otros</th><th className="n">Costo total</th><th className="n">Cobras</th><th className="n">Utilidad unit.</th><th className="n">Margen</th></tr></thead>
                  <tbody><tr><td className="n">{money(u.compra)}</td><td className="n">{money(u.com)}</td><td className="n">{money(u.desa)}</td><td className="n">{money(u.flete)}</td><td className="n">{money(u.otros)}</td><td className="n"><b>{money(u.total)}</b></td><td className="n">{money(p)}</td><td className={'n ' + (ut >= 0 ? 'pos' : 'neg')}><b>{money(ut)}</b></td><td className="n">{p ? pct((ut * 100) / p) : '—'}</td></tr></tbody>
                </table></div>
                {ut < 0 && <div className="msg warn">Estás vendiendo por debajo del costo de este lote.</div>}
                <button type="button" className="primary" style={{ marginTop: 10 }} onClick={agregar}>Agregar a la venta</button>
              </div>); })()}
          </div>

          <div className="card">
            <h2>2. Detalle de la venta</h2>
            {cart.length === 0 ? <div className="empty">Aún no agregaste perfumes.</div> : (
              <div className="tbl-wrap"><table>
                <thead><tr><th>Perfume</th><th>Lote</th><th>Proveedor</th><th className="n">Cant.</th><th className="n">Precio</th><th className="n">Subtotal</th><th className="n">Costo</th><th className="n">Utilidad</th><th></th></tr></thead>
                <tbody>
                  {cart.map((c, i) => { const costo = Math.round(toC(c.lote.total_pen) * c.cant / c.lote.cantidad_inicial); const ing = toC(c.cant * c.precio) - disc[i]; return (
                    <tr key={c.key}><td>{c.lote.marca} {c.lote.nombre}</td><td>{c.lote.codigo}</td><td>{c.lote.proveedor}</td><td className="n">{c.cant}</td><td className="n">{money(c.precio)}</td><td className="n">{money(c2(toC(c.cant * c.precio)))}</td><td className="n">{money(c2(costo))}</td><td className={'n ' + (ing - costo >= 0 ? 'pos' : 'neg')}>{money(c2(ing - costo))}</td>
                      <td><button type="button" className="sm danger" onClick={() => setCart(cart.filter((x) => x.key !== c.key))}>Quitar</button></td></tr>); })}
                </tbody>
              </table></div>)}
            <p className="muted">El costo del cuadro es referencial; el sistema fija el costo exacto del lote al confirmar.</p>
          </div>

          <div className="card">
            <h2>3. Cliente, pago y confirmación</h2>
            <div className="row">
              <Field label="Cliente"><select value={f.cliente_id} onChange={(e) => setF({ ...f, cliente_id: e.target.value })}><option value="">Cliente general</option>{(clientes || []).filter((c) => c.activo).map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.telefono ? ' · ' + c.telefono : ''}</option>)}</select></Field>
              <div className="fit"><label className="f">&nbsp;</label><button type="button" onClick={() => setNuevoCli({ nombre: '', telefono: '' })}>Nuevo cliente</button></div>
              <Field label="Fecha"><input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
            </div>
            {nuevoCli && (<div className="row" style={{ marginTop: 10 }}>
              <Field label="Nombre"><input value={nuevoCli.nombre} onChange={(e) => setNuevoCli({ ...nuevoCli, nombre: e.target.value })} /></Field>
              <Field label="Teléfono"><input value={nuevoCli.telefono} onChange={(e) => setNuevoCli({ ...nuevoCli, telefono: e.target.value })} inputMode="tel" /></Field>
              <div className="fit"><button type="button" className="primary" disabled={busy} onClick={crearCliente}>Guardar cliente</button> <button type="button" onClick={() => setNuevoCli(null)}>Cancelar</button></div>
            </div>)}
            <div style={{ marginTop: 12 }}><Field label="Medio de pago"><Choice options={MEDIOS} value={f.medio_pago} onChange={(v) => setF({ ...f, medio_pago: v })} /></Field></div>
            <div className="row" style={{ marginTop: 12 }}>
              <Field label="Descuento total (S/)"><input type="number" min="0" step="0.5" value={f.descuento} onChange={(e) => setF({ ...f, descuento: e.target.value })} /></Field>
              <Field label="Gasto asociado a la venta (S/)"><input type="number" min="0" step="0.01" value={f.gasto} onChange={(e) => setF({ ...f, gasto: e.target.value })} /></Field>
              <Field label="Tipo de gasto"><select value={f.gasto_cat} onChange={(e) => setF({ ...f, gasto_cat: e.target.value })}>{['Comisiones de cobro', 'Delivery', 'Empaques', 'Publicidad', 'Otros'].map((c) => <option key={c}>{c}</option>)}</select></Field>
            </div>
            <div className="grid g4" style={{ marginTop: 14 }}>
              <div className="kpi"><span>Subtotal</span><b>{money(c2(sub))}</b></div>
              <div className="kpi"><span>Total a cobrar</span><b>{money(c2(total))}</b></div>
              <div className="kpi"><span>Costo de adquisición</span><b>{money(c2(costoTotal))}</b></div>
              <div className="kpi"><span>Utilidad bruta / margen</span><b className={total - costoTotal >= 0 ? 'pos' : 'neg'}>{money(c2(total - costoTotal))}</b><small>{total ? pct(((total - costoTotal) * 100) / total) : '—'} · después del gasto: {money(c2(total - costoTotal - gasto))}</small></div>
            </div>
            <button type="button" className="primary" style={{ marginTop: 14 }} disabled={busy || !cart.length} onClick={confirmar}>{busy ? 'Registrando…' : 'Confirmar venta'}</button>
          </div>
        </>
      ) : (
        <Historial ventas={ventas} reload={async () => { await Promise.all([reloadVentas(), reloadLotes(), reloadCli()]); }} />
      )}
    </>
  );
}

function Historial({ ventas, reload }) {
  const [open, setOpen] = useState(null);
  const [det, setDet] = useState({});
  const [dev, setDev] = useState({});
  const { busy, msg, setMsg, run } = useRun();
  if (!ventas) return <Loading />;
  const abrir = async (v) => {
    if (open === v.id) return setOpen(null);
    setOpen(v.id); setDev({});
    try { setDet({ ...det, [v.id]: await api('/api/ventas?id=' + v.id) }); } catch (e) { setMsg({ t: 'err', m: e.message }); }
  };
  const accion = (v, accion) => {
    const motivo = window.prompt(accion === 'anular' ? `Motivo para anular ${v.codigo} (obligatorio). Se devuelve todo el stock a sus lotes.` : `Motivo de la devolución de ${v.codigo} (obligatorio):`);
    if (!motivo) return;
    const items = Object.entries(dev).map(([detalle_id, cantidad]) => ({ detalle_id, cantidad }));
    run(async () => { await api('/api/ventas', { method: 'PATCH', body: { id: v.id, accion, motivo, items } }); setOpen(null); setDet({}); await reload(); }, accion === 'anular' ? 'Venta anulada con sus movimientos compensatorios.' : 'Devolución registrada.');
  };
  const color = { ACTIVA: 'ok', DEVUELTA: 'warn', ANULADA: 'bad' };
  return (
    <div className="card">
      <Msg msg={msg} />
      {ventas.length === 0 ? <div className="empty">Aún no hay ventas.</div> : (
        <div className="tbl-wrap"><table>
          <thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th>Pago</th><th className="n">Total neto</th><th className="n">Costo</th><th className="n">Utilidad</th><th>Estado</th><th></th></tr></thead>
          <tbody>{ventas.map((v) => (
            <Fragment key={v.id}>
              <tr><td>{v.codigo}</td><td>{v.fecha}</td><td>{v.cliente || 'General'}</td><td>{v.medio_pago}</td><td className="n">{money(v.total)}</td><td className="n">{money(v.costo)}</td><td className="n">{money(v.total - v.costo)}</td><td><span className={'badge ' + color[v.estado]}>{v.estado}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}><button type="button" className="sm" onClick={() => abrir(v)}>{open === v.id ? 'Ocultar' : 'Detalle'}</button> <Link className="btn sm" href={'/ventas/ticket?id=' + v.id}>Ticket</Link></td></tr>
              {open === v.id && (<tr><td colSpan={9} style={{ background: '#fafbfc' }}>
                {!det[v.id] ? 'Cargando…' : (<>
                  <table><thead><tr><th>Perfume</th><th>Lote / proveedor</th><th className="n">Cant.</th><th className="n">Precio</th><th className="n">Ingreso neto</th><th className="n">Costo</th><th className="n">Devueltas</th>{v.estado === 'ACTIVA' && <th className="n">Devolver</th>}</tr></thead>
                    <tbody>{det[v.id].lineas.map((l) => (<tr key={l.id}><td>{l.marca} {l.nombre}</td><td>{l.lote} · {l.proveedor}</td><td className="n">{l.cantidad}</td><td className="n">{money(l.precio_unit)}</td><td className="n">{money(l.ingreso_neto)}</td><td className="n">{money(l.costo_pen)}</td><td className="n">{l.cant_devuelta}</td>
                      {v.estado === 'ACTIVA' && <td className="n"><input type="number" min="0" max={l.cantidad - l.cant_devuelta} style={{ width: 70 }} value={dev[l.id] ?? ''} onChange={(e) => setDev({ ...dev, [l.id]: e.target.value })} /></td>}</tr>))}</tbody></table>
                  {v.estado === 'ACTIVA' && <div className="row" style={{ marginTop: 10 }}>
                    <button type="button" className="fit" disabled={busy || !Object.values(dev).some((x) => Number(x) > 0)} onClick={() => accion(v, 'devolver')}>Registrar devolución</button>
                    <button type="button" className="fit danger" disabled={busy} onClick={() => accion(v, 'anular')}>Anular venta completa</button>
                  </div>}
                </>)}
              </td></tr>)}
            </Fragment>))}</tbody>
        </table></div>)}
    </div>
  );
}
