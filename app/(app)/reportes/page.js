'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLoad } from '@/components/hooks';
import { Choice, Field, Msg } from '@/components/ui';
import { api, money, usd, pct, toCsv, download } from '@/lib/client';

const TIPOS = { 'Por producto': 'producto', 'Por lote': 'lote', 'Por proveedor': 'proveedor', 'Por caja importada': 'caja', 'Por mes': 'periodo', 'Gastos por categoría': 'gastos', 'Inventario valorizado': 'inventario' };
const FMT = { money, usd, pct, int: (v) => v ?? 0, text: (v) => v ?? '' };

export default function Reportes() {
  const [tipo, setTipo] = useState('Por producto');
  const [f, setF] = useState({ desde: '', hasta: '', proveedor_id: '', marca: '', perfume_id: '' });
  const [res, setRes] = useState(null);
  const [msg, setMsg] = useState(null);
  const [cargando, setCargando] = useState(false);
  const { data: provs } = useLoad('/api/proveedores');
  const { data: perfumes } = useLoad('/api/perfumes');
  const marcas = useMemo(() => [...new Set((perfumes || []).map((p) => p.marca))], [perfumes]);

  const cargar = async () => {
    setCargando(true); setMsg(null);
    try {
      const qs = new URLSearchParams({ tipo: TIPOS[tipo], ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }).toString();
      setRes(await api('/api/reportes?' + qs));
    } catch (e) { setMsg({ t: 'err', m: e.message }); } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [tipo]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <h1>Reportes</h1>
      <p className="sub">Rentabilidad y costos calculados con los lotes reales. Exporta cada reporte a CSV o descarga todo en Excel.</p>
      <div className="tabs"><Choice options={Object.keys(TIPOS)} value={tipo} onChange={setTipo} /></div>
      <div className="card">
        <div className="row">
          <Field label="Desde"><input type="date" value={f.desde} onChange={set('desde')} /></Field>
          <Field label="Hasta"><input type="date" value={f.hasta} onChange={set('hasta')} /></Field>
          <Field label="Proveedor"><select value={f.proveedor_id} onChange={set('proveedor_id')}><option value="">Todos</option>{(provs || []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
          <Field label="Marca"><select value={f.marca} onChange={set('marca')}><option value="">Todas</option>{marcas.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Perfume"><select value={f.perfume_id} onChange={set('perfume_id')}><option value="">Todos</option>{(perfumes || []).map((p) => <option key={p.id} value={p.id}>{p.marca} {p.nombre} {p.ml}ml</option>)}</select></Field>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="primary fit" disabled={cargando} onClick={cargar}>{cargando ? 'Calculando…' : 'Aplicar filtros'}</button>
          <button type="button" className="fit" disabled={!res || !res.rows.length} onClick={() => download(`reporte-${TIPOS[tipo]}.csv`, toCsv(res.columns, res.rows))}>Exportar este reporte a CSV</button>
          <a className="btn fit" href="/api/export">Descargar Excel completo</a>
        </div>
      </div>
      <Msg msg={msg} />
      <div className="card">
        {!res ? <div className="empty">Cargando…</div> : res.rows.length === 0 ? <div className="empty">Sin datos para estos filtros.</div> : (
          <div className="tbl-wrap"><table>
            <thead><tr>{res.columns.map((c) => <th key={c.k} className={c.fmt !== 'text' ? 'n' : ''}>{c.label}</th>)}</tr></thead>
            <tbody>{res.rows.map((r, i) => (<tr key={i}>{res.columns.map((c) => <td key={c.k} className={c.fmt !== 'text' ? 'n' : ''}>{(FMT[c.fmt] || FMT.text)(r[c.k])}</td>)}</tr>))}</tbody>
          </table></div>)}
        {tipo === 'Por caja importada' && <p className="muted">Pendiente por recuperar = inversión total − lo cobrado en ventas de esa caja (neto de devoluciones). El inventario restante sigue valorizado a su costo real.</p>}
      </div>
    </>
  );
}
