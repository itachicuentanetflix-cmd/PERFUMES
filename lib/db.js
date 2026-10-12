import pg from 'pg';

pg.types.setTypeParser(1700, (v) => parseFloat(v)); // numeric -> número
pg.types.setTypeParser(20, (v) => parseInt(v, 10));  // bigint/count -> número
pg.types.setTypeParser(1082, (v) => v);              // date -> 'YYYY-MM-DD'

const g = globalThis;
export const pool =
  g._pjPool ||
  (g._pjPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3, connectionTimeoutMillis: 10000 }));

export const q = (text, params) => pool.query(text, params).then((r) => r.rows);

// Transacción con candado global (equivale al LockService): una operación crítica a la vez.
export async function tx(fn) {
  const cl = await pool.connect();
  try {
    await cl.query('BEGIN');
    await cl.query('SELECT pg_advisory_xact_lock(42)');
    const r = await fn(cl);
    await cl.query('COMMIT');
    return r;
  } catch (e) {
    await cl.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cl.release();
  }
}

export const audit = (cl, usuario, accion, entidad, entidad_id, detalle) =>
  cl.query('INSERT INTO auditoria(usuario,accion,entidad,entidad_id,detalle) VALUES($1,$2,$3,$4,$5)', [usuario, accion, entidad, entidad_id, detalle ? JSON.stringify(detalle) : null]);

export const caja = (cl, { fecha, tipo, concepto, origen, origen_id, monto, medio, referencia, usuario }) =>
  cl.query('INSERT INTO movimientos_caja(fecha,tipo,concepto,origen,origen_id,monto_pen,medio_pago,referencia,usuario) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [fecha, tipo, concepto, origen, origen_id, monto, medio || null, referencia || null, usuario]);
