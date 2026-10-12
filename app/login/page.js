'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Msg, useRun } from '@/components/ui';

export default function Login() {
  const [usuario, setU] = useState('');
  const [clave, setC] = useState('');
  const { busy, msg, run } = useRun();
  const enviar = (e) => {
    e.preventDefault();
    run(async () => { await api('/api/login', { method: 'POST', body: { usuario, clave } }); window.location.href = '/dashboard'; });
  };
  return (
    <div className="login card">
      <h1>PERFUMES JEAN</h1>
      <p className="sub">Control de importaciones, lotes y ventas</p>
      <form onSubmit={enviar} className="grid">
        <div><label className="f">Usuario</label><input value={usuario} onChange={(e) => setU(e.target.value)} autoComplete="username" required /></div>
        <div><label className="f">Contraseña</label><input type="password" value={clave} onChange={(e) => setC(e.target.value)} autoComplete="current-password" required /></div>
        <button className="primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <Msg msg={msg} />
    </div>
  );
}
