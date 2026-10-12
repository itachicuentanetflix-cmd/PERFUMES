'use client';
import { Fragment, useMemo, useState } from 'react';
import { useLoad } from '@/components/hooks';
import { Loading, Choice, Field, Msg, useRun } from '@/components/ui';
import { api, money, slug } from '@/lib/client';

const VACIO = { sku: '', marca: '', nombre: '', ml: '100', concentracion: 'EDP', categoria: 'Hombre', foto_url: '', codigo_barras: '', precio_sugerido: '', stock_minimo: '2' };

export default function Perfumes() {
  const { data, error, reload } = useLoad('/api/perfumes');
  const [f, setF] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [ver, setVer] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [open, setOpen] = useState(null);
  const [lotes, setLotes] = useState({});
  const { busy, msg, setMsg, run } = useRun();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const marcas = useMemo(() => [...new Set((data || []).map((p) => p.marca))], [data]);
  const skuAuto = () => slug(`${f.marca}-${f.nombre}-${f.ml}${f.concentracion || ''}`);

  const guardar = () => run(async () => {
    const body = { ...f, id: editId, sku: f.sku || skuAuto() };
    await api('/api/perfumes', { method: editId ? 'PUT' : 'POST', body });
    setF(VACIO); setEditId(null); setVer(false); await reload();
  }, editId ? 'Perfume actualizado.' : 'Perfume registrado.');
  const estado = (p) => run(async () => { await api('/api/perfumes', { method: 'PUT', body: { id: p.id, solo_estado: true, activo: !p.activo } }); await reload(); });
  const abrir = async (p) => {
    if (open === p.id) return setOpen(null);
    setOpen(p.id);
    if (!lotes[p.id]) { try { setLotes({ ...lotes, [p.id]: await api('/api/perfumes?id=' + p.id) }); } catch (e) { setMsg({ t: 'err', m: e.message }); } }
  };
  if (!data) return <Loading error={error} retry={reload} />;
  const lista = data.filter((p) => (p.marca + ' ' + p.nombre + ' ' + p.sku).toLowerCase().includes(buscar.toLowerCase()));

  return (
    <>
      <h1>Perfumes</h1>
      <p className="sub">Catálogo de productos. El stock y el costo viven en los lotes de cada importación.</p>
      <Msg msg={msg} />
      {!ver ? <button className="primary" type="button" onClick={() => { setVer(true); setEditId(null); setF(VACIO); }}>Nuevo perfume</button> : (
        <div className="card">
          <h2>{editId ? 'Editar perfume' : 'Nuevo perfume'}</h2>
          <div className="grid g3">
            <Field label="Marca *"><input list="marcas" value={f.marca} onChange={set('marca')} /><datalist id="marcas">{marcas.map((m) => <option key={m} value={m} />)}</datalist></Field>
            <Field label="Nombre *"><input value={f.nombre} onChange={set('nombre')} /></Field>
            <Field label="SKU (se genera solo si lo dejas vacío)"><input value={f.sku} placeholder={skuAuto()} onChange={set('sku')} /></Field>
            <Field label="Presentación (ml)">
              <Choice options={['30', '50', '75', '100', '125', '200']} value={String(f.ml)} onChange={(v) => setF({ ...f, ml: v })} />
              <input style={{ marginTop: 6 }} type="number" min="1" value={f.ml ?? ''} onChange={set('ml')} placeholder="Otro valor" />
            </Field>
            <Field label="Concentración"><Choice options={['EDT', 'EDP', 'Parfum', 'Extrait', 'EDC']} value={f.concentracion} onChange={(v) => setF({ ...f, concentracion: v })} /></Field>
            <Field label="Categoría"><Choice options={['Hombre', 'Mujer', 'Unisex']} value={f.categoria} onChange={(v) => setF({ ...f, categoria: v })} /></Field>
            <Field label="Precio de venta sugerido (S/)"><input type="number" min="0" step="0.01" value={f.precio_sugerido} onChange={set('precio_sugerido')} /></Field>
            <Field label="Stock mínimo (alerta)"><input type="number" min="0" value={f.stock_minimo} onChange={set('stock_minimo')} /></Field>
            <Field label="Código de barras"><input value={f.codigo_barras || ''} onChange={set('codigo_barras')} /></Field>
            <Field label="Foto (enlace a una imagen)"><input value={f.foto_url || ''} onChange={set('foto_url')} placeholder="https://…" /></Field>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="primary fit" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar perfume'}</button>
            <button type="button" className="fit" onClick={() => { setVer(false); setEditId(null); }}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="card" style={{ marginTop: 16 }}>
        <input placeholder="Buscar por marca, nombre o SKU" value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ marginBottom: 10, maxWidth: 360 }} />
        {lista.length === 0 ? <div className="empty">No hay perfumes. Registra el primero con el botón de arriba.</div> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th></th><th>SKU</th><th>Perfume</th><th>Categoría</th><th className="n">Stock</th><th className="n">Último costo</th><th className="n">Precio sugerido</th><th>Estado</th><th></th></tr></thead>
            <tbody>{lista.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td style={{ width: 44 }}>{p.foto_url ? <img src={p.foto_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} /> : null}</td>
                  <td>{p.sku}</td><td>{p.marca} {p.nombre} {p.ml}ml {p.concentracion}</td><td>{p.categoria}</td>
                  <td className="n">{p.stock}{p.stock <= p.stock_minimo && <> <span className={'badge ' + (p.stock === 0 ? 'bad' : 'warn')}>{p.stock === 0 ? 'Agotado' : 'Bajo'}</span></>}</td>
                  <td className="n">{p.ultimo_costo != null ? money(p.ultimo_costo) : '—'}</td><td className="n">{money(p.precio_sugerido)}</td>
                  <td><span className={'badge ' + (p.activo ? 'ok' : 'bad')}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="sm" onClick={() => abrir(p)}>{open === p.id ? 'Ocultar' : 'Lotes'}</button>{' '}
                    <button type="button" className="sm" onClick={() => { setEditId(p.id); setF({ ...p, ml: String(p.ml ?? '') }); setVer(true); window.scrollTo(0, 0); }}>Editar</button>{' '}
                    <button type="button" className="sm" disabled={busy} onClick={() => estado(p)}>{p.activo ? 'Desactivar' : 'Activar'}</button>
                  </td>
                </tr>
                {open === p.id && (<tr><td colSpan={9} style={{ background: '#fafbfc' }}>
                  {!lotes[p.id] ? 'Cargando…' : lotes[p.id].length === 0 ? <span className="muted">Sin compras registradas.</span> : (
                    <table><thead><tr><th>Lote</th><th>Proveedor</th><th>Caja</th><th>Ingreso</th><th className="n">Cant.</th><th className="n">Stock</th><th className="n">Costo compra</th><th className="n">Desaduanaje</th><th className="n">Costo final unit.</th></tr></thead>
                      <tbody>{lotes[p.id].map((l) => (<tr key={l.id}><td>{l.codigo}</td><td>{l.proveedor}</td><td>{l.importacion}</td><td>{l.fecha_ingreso}</td><td className="n">{l.cantidad_inicial}</td><td className="n">{l.stock}</td><td className="n">{money(l.compra_pen / l.cantidad_inicial)}</td><td className="n">{money(l.desaduanaje_pen / l.cantidad_inicial)}</td><td className="n"><b>{money(l.costo_unit)}</b></td></tr>))}</tbody></table>)}
                </td></tr>)}
              </Fragment>
            ))}</tbody>
          </table></div>)}
      </div>
    </>
  );
}
