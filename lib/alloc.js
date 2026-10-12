// Cálculo de costos de una caja. Todo se calcula en CÉNTIMOS (enteros) para que
// los repartos cuadren exactamente. El mismo archivo lo usan la pantalla y el servidor.

export const toC = (n) => {
  const x = Number(n);
  if (!isFinite(x)) return 0;
  return Math.round(x * 100 + (x < 0 ? -1e-7 : 1e-7));
};
export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const fmtC = (c) => (c / 100).toFixed(2);

export const GASTOS = [
  ['desaduanaje', 'Desaduanaje'],
  ['flete', 'Flete internacional'],
  ['transporte', 'Transporte local'],
  ['otros', 'Otros gastos'],
];
export const KEYS = ['comision', 'desaduanaje', 'flete', 'transporte', 'otros'];
export const LABEL = { comision: 'Comisión bancaria', desaduanaje: 'Desaduanaje', flete: 'Flete internacional', transporte: 'Transporte local', otros: 'Otros gastos' };

// Reparte `total` (céntimos enteros) según `weights` con el método del mayor resto.
// La suma del resultado es SIEMPRE igual a total.
export function allocate(total, weights) {
  const n = weights.length;
  if (!n) return [];
  let w = weights.map((x) => Math.max(0, x));
  let s = sum(w);
  if (s <= 0) { w = w.map(() => 1); s = n; }
  const raw = w.map((x) => (total * x) / s);
  const base = raw.map(Math.floor);
  const rem = total - sum(base);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < rem; k++) base[order[k][1]]++;
  return base;
}

/**
 * input = {
 *   items:  [{ qty, usd, manual: {desaduanaje, flete, transporte, otros, comision} }],
 *   pagos:  [{ monto_usd, tc, comision, comision_moneda:'PEN'|'USD', otros, debitado }],
 *   gastos: { desaduanaje:{monto,metodo}, flete:{...}, transporte:{...}, otros:{...}, comision:{metodo} }
 * }
 * Métodos: 'VALOR' | 'CANTIDAD' | 'MANUAL'
 */
export function computeCaja({ items = [], pagos = [], gastos = {} }) {
  const errors = [];
  const lines = items.map((it) => {
    const qty = Math.trunc(Number(it.qty) || 0);
    return { qty, usdC: toC(qty * (Number(it.usd) || 0)) };
  });
  if (!lines.length) errors.push('Agrega al menos un perfume a la caja.');
  if (lines.some((l) => l.qty <= 0)) errors.push('Cada perfume debe tener una cantidad mayor que 0.');
  const totalUsdC = sum(lines.map((l) => l.usdC));

  const pg = pagos.map((p) => {
    const usdC = toC(p.monto_usd);
    const tc = Number(p.tc) || 0;
    const equivC = Math.round(usdC * tc);
    const comC = p.comision_moneda === 'USD' ? Math.round(toC(p.comision) * tc) : toC(p.comision);
    const otrosC = toC(p.otros);
    const expC = equivC + comC + otrosC;
    const hasDeb = p.debitado !== '' && p.debitado != null && isFinite(Number(p.debitado));
    const debC = hasDeb ? toC(p.debitado) : null;
    return { usdC, tc, equivC, comC, otrosC, expC, debC, diffC: hasDeb ? debC - expC : null, bankC: hasDeb ? debC - equivC : comC + otrosC };
  });
  if (!pg.length) errors.push('Registra al menos un pago.');
  if (pg.some((p) => p.tc <= 0)) errors.push('Cada pago necesita un tipo de cambio mayor que 0.');
  const pagosUsdC = sum(pg.map((p) => p.usdC));
  const equivTotC = sum(pg.map((p) => p.equivC));
  const bankTotC = sum(pg.map((p) => p.bankC));
  if (pg.length && pagosUsdC !== totalUsdC)
    errors.push(`Los pagos en USD (${fmtC(pagosUsdC)}) no coinciden con el total de la caja (${fmtC(totalUsdC)}).`);
  if (bankTotC < 0) errors.push('El importe debitado es menor que la compra convertida. Revisa los montos.');

  const purchase = allocate(equivTotC, lines.map((l) => l.usdC));
  const alloc = {};
  let expectedTotal = equivTotC + bankTotC;
  for (const k of KEYS) {
    const totalC = k === 'comision' ? bankTotC : toC(gastos[k]?.monto);
    if (totalC < 0) errors.push(`${LABEL[k]} no puede ser negativo.`);
    if (k !== 'comision') expectedTotal += totalC;
    const metodo = gastos[k]?.metodo || 'VALOR';
    let a;
    if (metodo === 'CANTIDAD') a = allocate(totalC, lines.map((l) => l.qty));
    else if (metodo === 'MANUAL') {
      a = items.map((it) => toC(it.manual?.[k]));
      const s = sum(a);
      if (s !== totalC) errors.push(`${LABEL[k]}: la asignación manual suma ${fmtC(s)} y el gasto es ${fmtC(totalC)}.`);
    } else a = allocate(totalC, purchase);
    alloc[k] = { totalC, metodo, a };
  }

  const out = lines.map((l, i) => {
    const p = {};
    let totalC = purchase[i];
    for (const k of KEYS) { p[k] = alloc[k].a[i] || 0; totalC += p[k]; }
    return { ...l, compraC: purchase[i], p, totalC, unitC: l.qty > 0 ? totalC / l.qty : 0, origUnitC: l.qty > 0 ? purchase[i] / l.qty : 0 };
  });
  const totalC = sum(out.map((l) => l.totalC));
  if (!errors.length && totalC !== expectedTotal) errors.push('Descuadre interno de redondeo. No se puede guardar.');
  return { lines: out, pagos: pg, alloc, errors, totals: { totalUsdC, equivTotC, bankTotC, totalC, units: sum(lines.map((l) => l.qty)) } };
}
