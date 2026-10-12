'use client';
import { Fragment, useState } from 'react';
import { useLoad } from '@/components/hooks';
import { Loading, Choice, Field, Msg, useRun } from '@/components/ui';
import { api, money, usd } from '@/lib/client';

const PAISES = ['Estados Unidos', 'Emiratos Árabes Unidos', 'España', 'Francia', 'Italia', 'China', 'Arabia Saudita', 'Otro'];
const VACIO = { nombre: '', pais: 'Estados Unidos', telefono: '', email: '', contacto: '', moneda: 'USD', observaciones: '' };

export default function Proveedores() {
  const { data, error, reload } = useLoad('/api/proveedores');
  const [f, setF] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [ver, setVer] = useState(false);
  const [hist, setHist] = useState({});
  const [open, setOpen] = useState(null);
  const { busy, msg, setMsg, run } = useRun();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const guardar = () => run(async () => {
    await api('/api/proveedores', { method: editId ? 'PUT' : 'POST', body: { ...f, id: editId } });
    setF(VACIO); setEditId(null); setVer(false); await reload();
  }, editId ? 'Proveedor actualizado.' : 'Proveedor creado.');
  const estado = (p) => run(async () => { await api('/api/proveedores', { method: 'PUT', body: { id: p.id, solo_estado: true, activo: !p.activo } }); await reload(); }, p.activo ? 'Proveedor desactivado. Su historial se conserva.' : 'Proveedor activado.');
  const abrir = async (p) => {
    if (open === p.id) return setOpen(null);
    setOpen(p.id);
    if (!hist[p.id]) { try { setHist({ ...hist, [p.id]: await api('/api/proveedores?id=' + p.id) }); } catch (e) { setMsg({ t: 'err', m: e.message }); } }
  };
  if (!data) return <Loading error={error} retry={reload} />;

  return (
    <>
      <h1>Proveedores</h1>
      <p className="sub">Directorio de proveedores y su historial de compras. Desactivar no borra nada.</p>
      <Msg msg={msg} />
      {!ver ? <button className="primary" type="button" onClick={() => { setVer(true); setEditId(null); setF(VACIO); }}>Nuevo proveedor</button> : (
        <div className="card">
          <h2>{editId ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
          <div className="grid g3">
            <Field label="Nombre comercial *"><input value={f.nombre} onChange={set('nombre')} /></Field>
            <Field label="País"><select value={f.pais || ''} onChange={set('pais')}>{PAISES.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Contacto"><input value={f.contacto || ''} onChange={set('contacto')} /></Field>
            <Field label="Teléfono"><input value={f.telefono || ''} onChange={set('telefono')} inputMode="tel" /></Field>
            <Field label="Correo"><input type="email" value={f.email || ''} onChange={set('email')} /></Field>
            <Field label="Moneda habitual"><Choice options={['USD', 'EUR', 'PEN']} value={f.moneda} onChange={(v) => setF({ ...f, moneda: v })} /></Field>
          </div>
          <div style={{ marginTop: 10 }}><Field label="Observaciones"><textarea rows={2} value={f.observaciones || ''} onChange={set('observaciones')} /></Field></div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="primary fit" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar proveedor'}</button>
            <button type="button" className="fit" onClick={() => { setVer(false); setEditId(null); }}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="card" style={{ marginTop: 16 }}>
        {data.length === 0 ? <div className="empty">Aún no hay proveedores. Crea el primero con el botón de arriba.</div> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Código</th><th>Proveedor</th><th>País</th><th>Contacto</th><th className="n">Cajas</th><th className="n">Total comprado</th><th>Estado</th><th></th></tr></thead>
            <tbody>{data.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>{p.codigo}</td><td>{p.nombre}</td><td>{p.pais}</td><td>{p.contacto} {p.telefono}</td>
                  <td className="n">{p.cajas}</td><td className="n">{usd(p.total_usd)} · {money(p.total_pen)}</td>
                  <td><span className={'badge ' + (p.activo ? 'ok' : 'bad')}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="sm" onClick={() => abrir(p)}>{open === p.id ? 'Ocultar' : 'Historial'}</button>{' '}
                    <button type="button" className="sm" onClick={() => { setEditId(p.id); setF(p); setVer(true); window.scrollTo(0, 0); }}>Editar</button>{' '}
                    <button type="button" className="sm" disabled={busy} onClick={() => estado(p)}>{p.activo ? 'Desactivar' : 'Activar'}</button>
                  </td>
                </tr>
                {open === p.id && (<tr><td colSpan={8} style={{ background: '#fafbfc' }}>
                  {!hist[p.id] ? 'Cargando…' : (<>
                    <b>Importaciones</b>
                    {hist[p.id].imports.length === 0 ? <div className="muted">Sin importaciones.</div> : (
                      <table><thead><tr><th>Caja</th><th>Fecha</th><th className="n">Unidades</th><th className="n">USD</th><th className="n">Costo total</th></tr></thead>
                        <tbody>{hist[p.id].imports.map((i) => (<tr key={i.id}><td>{i.codigo}{i.anulada && ' (anulada)'}</td><td>{i.fecha_compra}</td><td className="n">{i.total_unidades}</td><td className="n">{usd(i.total_usd)}</td><td className="n">{money(i.costo_total_pen)}</td></tr>))}</tbody></table>)}
                    <div style={{ height: 8 }} /><b>Productos y costos históricos</b>
                    {hist[p.id].productos.length === 0 ? <div className="muted">Sin productos.</div> : (
                      <table><thead><tr><th>Perfume</th><th>Lote</th><th>Caja</th><th className="n">Cant.</th><th className="n">Stock</th><th className="n">Costo unit.</th></tr></thead>
                        <tbody>{hist[p.id].productos.map((x, i) => (<tr key={i}><td>{x.marca} {x.nombre} {x.ml}ml</td><td>{x.lote}</td><td>{x.importacion}</td><td className="n">{x.cantidad_inicial}</td><td className="n">{x.stock}</td><td className="n">{money(x.costo_unit)}</td></tr>))}</tbody></table>)}
                  </>)}
                </td></tr>)}
              </Fragment>
            ))}</tbody>
          </table></div>)}
      </div>
    </>
  );
}
