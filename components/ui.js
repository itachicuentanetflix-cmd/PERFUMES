'use client';
import { useState } from 'react';

// Ejecuta una acción evitando doble clic y mostrando mensajes claros.
export function useRun() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const run = async (fn, okText) => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try { const r = await fn(); if (okText) setMsg({ t: 'ok', m: okText }); return r ?? true; }
    catch (e) { setMsg({ t: 'err', m: e.message }); return false; }
    finally { setBusy(false); }
  };
  return { busy, msg, setMsg, run };
}
export const Msg = ({ msg }) => (msg ? <div className={'msg ' + msg.t} role="alert">{msg.m}</div> : null);

export function Choice({ options, value, onChange }) {
  return (
    <div className="choice">
      {options.map((o) => (
        <button type="button" key={o} className={'chip' + (value === o ? ' on' : '')} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

export const Field = ({ label, children }) => (<div><label className="f">{label}</label>{children}</div>);

export function Loading({ error, retry }) {
  if (error) return (<div className="msg err">{error} <button type="button" className="sm" onClick={retry}>Reintentar</button></div>);
  return <div className="empty">Cargando…</div>;
}

export function Table({ columns, rows, empty = 'Sin registros.' }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr>{columns.map((c) => <th key={c.k} className={c.n ? 'n' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (<tr key={r.id ?? i}>{columns.map((c) => <td key={c.k} className={c.n ? 'n' : ''}>{c.render ? c.render(r) : r[c.k]}</td>)}</tr>))}</tbody>
      </table>
    </div>
  );
}
