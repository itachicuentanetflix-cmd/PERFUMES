-- PERFUMES JEAN · Estructura de base de datos (PostgreSQL / Neon)
-- Se puede ejecutar varias veces sin borrar datos.

CREATE SEQUENCE IF NOT EXISTS seq_prov;
CREATE SEQUENCE IF NOT EXISTS seq_cli;
CREATE SEQUENCE IF NOT EXISTS seq_imp;
CREATE SEQUENCE IF NOT EXISTS seq_ven;

CREATE TABLE IF NOT EXISTS proveedores (
  id serial PRIMARY KEY,
  codigo text UNIQUE NOT NULL DEFAULT ('PRV-' || lpad(nextval('seq_prov')::text, 3, '0')),
  nombre text NOT NULL, pais text, telefono text, email text, contacto text,
  moneda text NOT NULL DEFAULT 'USD', observaciones text,
  activo boolean NOT NULL DEFAULT true, creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perfumes (
  id serial PRIMARY KEY,
  sku text UNIQUE NOT NULL,
  marca text NOT NULL, nombre text NOT NULL, ml int, concentracion text,
  categoria text CHECK (categoria IN ('Hombre','Mujer','Unisex')),
  foto_url text, codigo_barras text,
  precio_sugerido numeric(12,2) NOT NULL DEFAULT 0 CHECK (precio_sugerido >= 0),
  stock_minimo int NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  activo boolean NOT NULL DEFAULT true, creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id serial PRIMARY KEY,
  codigo text UNIQUE NOT NULL DEFAULT ('CLI-' || lpad(nextval('seq_cli')::text, 4, '0')),
  nombre text NOT NULL, telefono text, email text, observaciones text,
  activo boolean NOT NULL DEFAULT true, creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS importaciones (
  id serial PRIMARY KEY,
  codigo text UNIQUE NOT NULL DEFAULT ('IMP-' || lpad(nextval('seq_imp')::text, 4, '0')),
  idem_key text UNIQUE,
  proveedor_id int NOT NULL REFERENCES proveedores(id),
  fecha_compra date NOT NULL, fecha_llegada date,
  referencia text, tracking text, estado text NOT NULL DEFAULT 'RECIBIDA',
  total_usd numeric(14,2) NOT NULL,
  compra_pen numeric(14,2) NOT NULL,      -- compra convertida a soles
  banco_pen numeric(14,2) NOT NULL,       -- comisión y cargos reales (debitado - compra convertida)
  desaduanaje_pen numeric(14,2) NOT NULL DEFAULT 0,
  flete_pen numeric(14,2) NOT NULL DEFAULT 0,
  transporte_pen numeric(14,2) NOT NULL DEFAULT 0,
  otros_pen numeric(14,2) NOT NULL DEFAULT 0,
  costo_total_pen numeric(14,2) NOT NULL,
  metodos jsonb, total_unidades int NOT NULL, observaciones text,
  anulada boolean NOT NULL DEFAULT false, motivo_anulacion text,
  usuario text, creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS importacion_pagos (
  id serial PRIMARY KEY,
  importacion_id int NOT NULL REFERENCES importaciones(id),
  fecha date NOT NULL,
  monto_usd numeric(14,2) NOT NULL CHECK (monto_usd >= 0),
  tipo_cambio numeric(10,4) NOT NULL CHECK (tipo_cambio > 0),
  equivalente_pen numeric(14,2) NOT NULL,
  comision numeric(14,2) NOT NULL DEFAULT 0, comision_moneda text NOT NULL DEFAULT 'PEN',
  otros_cargos_pen numeric(14,2) NOT NULL DEFAULT 0,
  debitado_pen numeric(14,2) NOT NULL,
  diferencia_pen numeric(14,2) NOT NULL DEFAULT 0, explicacion text,
  referencia text, estado text NOT NULL DEFAULT 'PAGADO'
);

CREATE TABLE IF NOT EXISTS lotes (
  id serial PRIMARY KEY,
  codigo text UNIQUE NOT NULL,
  importacion_id int NOT NULL REFERENCES importaciones(id),
  perfume_id int NOT NULL REFERENCES perfumes(id),
  proveedor_id int NOT NULL REFERENCES proveedores(id),
  cantidad_inicial int NOT NULL CHECK (cantidad_inicial > 0),
  stock int NOT NULL CHECK (stock >= 0),
  precio_usd numeric(14,4) NOT NULL,
  compra_pen numeric(14,2) NOT NULL, comision_pen numeric(14,2) NOT NULL,
  desaduanaje_pen numeric(14,2) NOT NULL, flete_pen numeric(14,2) NOT NULL,
  transporte_pen numeric(14,2) NOT NULL, otros_pen numeric(14,2) NOT NULL,
  total_pen numeric(14,2) NOT NULL,
  valor_restante numeric(14,2) NOT NULL CHECK (valor_restante >= 0),
  fecha_ingreso date NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_lotes_perfume ON lotes(perfume_id);
CREATE INDEX IF NOT EXISTS ix_lotes_imp ON lotes(importacion_id);

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id serial PRIMARY KEY, fecha timestamptz NOT NULL DEFAULT now(),
  lote_id int NOT NULL REFERENCES lotes(id), perfume_id int NOT NULL REFERENCES perfumes(id),
  tipo text NOT NULL CHECK (tipo IN ('ENTRADA','VENTA','DEVOLUCION','AJUSTE+','AJUSTE-','ANULACION')),
  cantidad int NOT NULL, valor numeric(14,2) NOT NULL,
  referencia text, motivo text, usuario text
);

CREATE TABLE IF NOT EXISTS ventas (
  id serial PRIMARY KEY,
  codigo text UNIQUE NOT NULL DEFAULT ('VTA-' || lpad(nextval('seq_ven')::text, 5, '0')),
  idem_key text UNIQUE,
  fecha date NOT NULL, cliente_id int REFERENCES clientes(id),
  medio_pago text NOT NULL, descuento_pen numeric(14,2) NOT NULL DEFAULT 0,
  subtotal_pen numeric(14,2) NOT NULL, total_pen numeric(14,2) NOT NULL,
  costo_pen numeric(14,2) NOT NULL,
  estado text NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','DEVUELTA','ANULADA')),
  observaciones text, motivo text, usuario text, creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venta_detalle (
  id serial PRIMARY KEY,
  venta_id int NOT NULL REFERENCES ventas(id),
  lote_id int NOT NULL REFERENCES lotes(id), perfume_id int NOT NULL REFERENCES perfumes(id),
  cantidad int NOT NULL CHECK (cantidad > 0),
  precio_unit numeric(12,2) NOT NULL CHECK (precio_unit >= 0),
  subtotal numeric(14,2) NOT NULL, descuento_pen numeric(14,2) NOT NULL DEFAULT 0,
  ingreso_neto numeric(14,2) NOT NULL, costo_pen numeric(14,2) NOT NULL,
  cant_devuelta int NOT NULL DEFAULT 0, ingreso_devuelto numeric(14,2) NOT NULL DEFAULT 0,
  costo_devuelto numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_vd_venta ON venta_detalle(venta_id);
CREATE INDEX IF NOT EXISTS ix_vd_lote ON venta_detalle(lote_id);

CREATE TABLE IF NOT EXISTS gastos (
  id serial PRIMARY KEY, fecha date NOT NULL, categoria text NOT NULL, descripcion text,
  monto_pen numeric(14,2) NOT NULL CHECK (monto_pen >= 0),
  medio_pago text, referencia text, venta_id int REFERENCES ventas(id),
  anulado boolean NOT NULL DEFAULT false, usuario text, creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movimientos_caja (
  id serial PRIMARY KEY, fecha date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('INGRESO','EGRESO')),
  concepto text NOT NULL, origen text NOT NULL, origen_id int,
  monto_pen numeric(14,2) NOT NULL CHECK (monto_pen >= 0),
  medio_pago text, referencia text, usuario text, creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditoria (
  id serial PRIMARY KEY, fecha timestamptz NOT NULL DEFAULT now(), usuario text,
  accion text NOT NULL, entidad text NOT NULL, entidad_id int, detalle jsonb
);
