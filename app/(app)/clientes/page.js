'use client';
import { Fragment, useState } from 'react';
import { useLoad } from '@/components/hooks';
import { Loading, Field, Msg, useRun } from '@/components/ui';
import { api, money } from '@/lib/client';

const VACIO = { nombre: '', telefono: '', email: '', observaciones: '' };

export default function Clientes() {
  const { data, error, reload } = useLoad('/api/clientes');
  const [f, setF] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [ver, setVer] = useState(false);
  const [open, setOpen] = useState(null);
  const [hist, setHist] = useState({});
  const [buscar, setBuscar] = useState('');
  const { busy, msg, setMsg, run } = useRun();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = () => run(async () => { await api('/api/clientes', { method: editId ? 'PUT' : 'POST', body: { ...f, id: editId } }); setF(VACIO); setEditId(null); setVer(false); await reload(); }, 'Cliente guardado.');
  const abrir = async (c) => {
    if (open === c.id) return setOpen(null);
    setOpen(c.id);
    try { setHist({ ...hist, [c.id]: await api('/api/clientes?id=' + c.id) }); } catch (e) { setMsg({ t: 'err', m: e.message }); }
  };
  if (!data) return <Loading error={error} retry={reload} />;
  const lista = data.filter((c) => (c.nombre + (c.telefono || '')).toLowerCase().includes(buscar.toLowerCase()));
  return (
    <>
      <h1>Clientes</h1>
      <p className="sub">Se consideran frecuentes los clientes con 3 o más compras.</p>
      <Msg msg={msg} />
      {!ver ? <button className="primary" type="button" onClick={() => { setVer(true); setEditId(null); setF(VACIO); }}>Nuevo cliente</button> : (
        <div className="card">
          <div className="grid g3">
            <Field label="Nombre *"><input value={f.nombre} onChange={set('nombre')} /></Field>
            <Field label="Teléfono"><input value={f.telefono || ''} onChange={set('telefono')} inputMode="tel" /></Field>
            <Field label="Correo (opcional)"><input type="email" value={f.email || ''} onChange={set('email')} /></Field>
          </div>
          <div style={{ marginTop: 10 }}><Field label="Observaciones"><textarea rows={2} value={f.observaciones || ''} onChange={set('observaciones')} /></Field></div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="primary fit" disabled={busy} onClick={guardar}>Guardar cliente</button>
            <button type="button" className="fit" onClick={() => { setVer(false); setEditId(null); }}>Cancelar</button>
          </div>
        </div>)}
      <div className="card" style={{ marginTop: 16 }}>
        <input placeholder="Buscar por nombre o teléfono" value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ marginBottom: 10, maxWidth: 360 }} />
        {lista.length === 0 ? <div className="empty">No hay clientes.</div> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Código</th><th>Cliente</th><th>Teléfono</th><th className="n">Compras</th><th className="n">Total gastado</th><th>Última compra</th><th></th></tr></thead>
            <tbody>{lista.map((c) => (
              <Fragment key={c.id}>
                <tr><td>{c.codigo}</td><td>{c.nombre} {c.compras >= 3 && <span className="badge ok">Frecuente</span>}</td><td>{c.telefono}</td><td className="n">{c.compras}</td><td className="n">{money(c.total)}</td><td>{c.ultima || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><button type="button" className="sm" onClick={() => abrir(c)}>{open === c.id ? 'Ocultar' : 'Compras'}</button> <button type="button" className="sm" onClick={() => { setEditId(c.id); setF(c); setVer(true); window.scrollTo(0, 0); }}>Editar</button></td></tr>
                {open === c.id && (<tr><td colSpan={7} style={{ background: '#fafbfc' }}>
                  {!hist[c.id] ? 'Cargando…' : hist[c.id].length === 0 ? <span className="muted">Sin compras.</span> : (
                    <table><thead><tr><th>Venta</th><th>Fecha</th><th>Estado</th><th className="n">Total</th></tr></thead>
                      <tbody>{hist[c.id].map((v) => (<tr key={v.id}><td>{v.codigo}</td><td>{v.fecha}</td><td>{v.estado}</td><td className="n">{money(v.total)}</td></tr>))}</tbody></table>)}
                  {c.observaciones && <p className="muted">Observaciones: {c.observaciones}</p>}
                </td></tr>)}
              </Fragment>))}</tbody>
          </table></div>)}
      </div>
    </>
  );
}
