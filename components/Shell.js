'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const LINKS = [
  ['/dashboard', 'Panel'], ['/calculadora', 'Calculadora de cajas'], ['/importaciones', 'Importaciones'], ['/proveedores', 'Proveedores'],
  ['/perfumes', 'Perfumes'], ['/inventario', 'Inventario'], ['/ventas', 'Ventas'], ['/clientes', 'Clientes'], ['/gastos', 'Gastos'], ['/caja', 'Flujo de caja'], ['/reportes', 'Reportes'],
];

export default function Shell({ children }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const logout = async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = '/login'; };
  return (
    <div className="app">
      <div className="topbar noprint">
        <button type="button" onClick={() => setOpen(!open)} aria-label="Menú">☰ Menú</button><b>PERFUMES JEAN</b>
      </div>
      <aside className={'sidebar noprint' + (open ? ' open' : '')} onClick={() => setOpen(false)}>
        <div className="brand">
          {/* Para poner tu logo: sube un archivo logo.png a la carpeta /public */}
          <img src="/logo.png" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div><b>PERFUMES JEAN</b><small>Importaciones e inventario</small></div>
        </div>
        <nav className="nav">
          {LINKS.map(([h, t]) => (<Link key={h} href={h} className={path.startsWith(h) ? 'on' : ''}>{t}</Link>))}
        </nav>
        <div className="side-foot">
          <a className="btn primary" href="/api/export" onClick={(e) => e.stopPropagation()}>Descargar Excel completo</a>
          <button type="button" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
