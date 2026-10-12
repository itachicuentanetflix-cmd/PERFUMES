export async function api(url, opts = {}) {
  let r;
  try {
    r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa tu internet y vuelve a intentar.');
  }
  let d = null;
  try { d = await r.json(); } catch { /* respuesta vacía */ }
  if (r.status === 401 && typeof window !== 'undefined' && !url.startsWith('/api/login')) { window.location.href = '/login'; throw new Error('Sesión vencida.'); }
  if (!r.ok) throw new Error(d?.error || `Error del servidor (${r.status}).`);
  return d;
}
export const money = (n) => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd = (n) => '$ ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (n) => (n == null ? '—' : Number(n).toFixed(1) + '%');
export const todayStr = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
export const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
export const perfumeName = (p) => [p.marca, p.nombre, p.ml ? p.ml + 'ml' : '', p.concentracion].filter(Boolean).join(' ');
export const slug = (s) => (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
export function toCsv(columns, rows) {
  const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  return '\ufeff' + [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.k])).join(','))].join('\n');
}
export function download(name, text, type = 'text/csv;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
}
