import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCaja, allocate } from '../lib/alloc.js';

test('allocate siempre suma el total', () => {
  for (const [t, w] of [[1000, [1, 1, 1]], [1, [5, 5, 5]], [999, [3, 7, 11, 13]], [0, [1, 2]], [100, [0, 0, 0]]]) {
    assert.equal(allocate(t, w).reduce((a, b) => a + b, 0), t);
  }
});

test('caja de ejemplo del README', () => {
  const r = computeCaja({
    items: [{ qty: 2, usd: 30 }, { qty: 1, usd: 90 }, { qty: 3, usd: 10 }],
    pagos: [{ monto_usd: 180, tc: 3.75, comision: 6.75, comision_moneda: 'PEN', otros: 0, debitado: 681.75 }],
    gastos: { desaduanaje: { monto: 45, metodo: 'VALOR' }, flete: { monto: 30, metodo: 'CANTIDAD' }, transporte: { monto: 0 }, otros: { monto: 0 }, comision: { metodo: 'VALOR' } },
  });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines.map((l) => l.totalC), [25225, 36838, 13612]);
  assert.equal(r.totals.totalC, 75675);
  assert.equal(r.pagos[0].diffC, 0);
});

test('detecta pagos que no cuadran con la caja y asignación manual incorrecta', () => {
  const r = computeCaja({
    items: [{ qty: 1, usd: 100, manual: { desaduanaje: 5 } }, { qty: 1, usd: 50, manual: { desaduanaje: 4 } }],
    pagos: [{ monto_usd: 140, tc: 3.7, comision: 0, otros: 0, debitado: '' }],
    gastos: { desaduanaje: { monto: 10, metodo: 'MANUAL' } },
  });
  assert.ok(r.errors.length >= 2);
});
