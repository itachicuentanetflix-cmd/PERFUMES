# PERFUMES JEAN — Control de importaciones, lotes, costos y ventas

Página web propia (Next.js) que se publica gratis en **Vercel**, con base de datos **Neon (PostgreSQL)**.
No usa Google Sheets ni Apps Script. Cuando quieras una hoja de cálculo, el botón **Descargar Excel completo** genera un `.xlsx` con todos los datos.

## Qué hace

- **Calculadora de cajas**: calcula el costo real de cada perfume (compra + comisión BCP + desaduanaje + flete + transporte + otros). Cada gasto se reparte **por valor**, **por cantidad** o **manual**, y puedes elegir un método distinto por gasto. Todo cuadra al céntimo.
- **Importaciones**: la misma calculadora guarda la caja, sus pagos BCP y crea un **lote** por cada perfume, con su costo propio. Los lotes viejos nunca se recalculan.
- **Ventas**: eliges perfume → lote (proveedor y caja) → cantidad y precio. Ves costo original, comisión, desaduanaje, flete, costo total, lo que cobras y tu utilidad. Solo se descuenta el stock de ese lote. Incluye ticket imprimible, devoluciones y anulaciones.
- **Proveedores, perfumes, clientes, inventario, gastos, flujo de caja, reportes y panel.**
- **Excel completo** con una hoja por tabla (proveedores, importaciones, pagos, lotes, movimientos, ventas, detalle de ventas, gastos, caja, auditoría).

## Reglas contables del sistema

1. **Costo del lote** = compra convertida a soles + (lo debitado por el banco − compra convertida) + desaduanaje + flete + transporte + otros. Es dinero que realmente salió.
2. **La comisión bancaria no se cuenta dos veces**: ya está dentro del importe debitado. En caja se registra un solo egreso por pago.
3. **Desaduanaje, flete y comisión de las cajas son costo del inventario**, no gasto. Los **gastos operativos** (publicidad, alquiler, etc.) se registran aparte y solo restan en la utilidad neta.
4. **Utilidad bruta** = ventas netas − costo real de los lotes vendidos. **Utilidad neta** = utilidad bruta − gastos operativos. **Flujo de caja** = dinero que entró − dinero que salió (incluye la mercadería aún sin vender).
5. Al vender, el costo sale del **valor restante del lote**; la última unidad se lleva el saldo exacto, así que costo vendido + inventario restante = costo del lote al céntimo.
6. Nada se borra: las anulaciones y devoluciones crean movimientos de reversión, y cada operación queda en la tabla `auditoria` con usuario y fecha.
7. Las operaciones críticas (importación, venta, ajuste, devolución) corren en una transacción con candado global (`pg_advisory_xact_lock`), y cada una lleva una clave única para que un doble clic no la duplique.

Si el banco debitó un importe distinto de compra + comisión, el sistema avisa y **exige una explicación**. El costo bancario real siempre es lo debitado menos la compra convertida.

## Instalación (una sola vez, gratis)

### 1. Base de datos en Neon
1. Crea una cuenta en https://neon.tech y un proyecto nuevo.
2. En **Connection Details** copia la cadena **Pooled connection** (empieza con `postgresql://`).
3. Abre **SQL Editor**, pega todo el contenido de `schema.sql` y pulsa **Run**. Se puede ejecutar varias veces sin perder datos.

### 2. Subir el código a GitHub
1. Crea un repositorio privado en https://github.com y sube esta carpeta completa.

### 3. Publicar en Vercel
1. En https://vercel.com elige **Add New → Project** e importa el repositorio.
2. Antes de desplegar, abre **Environment Variables** y crea:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | la cadena de Neon del paso 1 |
| `AUTH_SECRET` | un texto largo y aleatorio (32+ caracteres) |
| `APP_USERS` | `jean:TuClaveSegura` — para varios usuarios sepáralos con coma: `jean:clave1,vendedor:clave2` |

3. Pulsa **Deploy**. Vercel te da una dirección como `perfumes-jean.vercel.app`; ábrela desde la computadora o el celular.

### Tu logo
Sube un archivo `logo.png` a la carpeta `public/` y aparecerá junto a “PERFUMES JEAN”.

### Probar en tu computadora (opcional)
```
npm install
copy .env.example .env.local      (en Mac/Linux: cp)
npm run dev
```
Edita `.env.local` con tus datos. Las pruebas del motor de cálculo: `npm test`.

## Cómo actualizar
Cambia el código, súbelo a GitHub y Vercel publica solo. Los datos viven en Neon, así que **no se pierden al actualizar**. Si una versión nueva cambia la base, se entregará un archivo SQL con `ALTER TABLE`.

## Copias de seguridad
- Pulsa **Descargar Excel completo** con regularidad (por ejemplo cada semana).
- Neon guarda un historial de restauración en su plan gratuito (ventana corta); para más seguridad usa `pg_dump` con tu cadena de conexión.

## Cómo usarlo, paso a paso
1. **Proveedores** → Nuevo proveedor.
2. **Perfumes** → Nuevo perfume (marca, ml y concentración se eligen con botones; el SKU se genera solo).
3. **Calculadora de cajas** → elige proveedor, agrega los perfumes con cantidad y precio en USD, registra el pago (USD, tipo de cambio, comisión BCP, lo realmente debitado), escribe desaduanaje y demás gastos, elige cómo repartir cada uno, revisa la tabla y pulsa **Registrar como importación**.
4. **Ventas** → perfume → lote → cantidad y precio → cliente y medio de pago → **Confirmar venta**.
5. **Panel** y **Reportes** se actualizan solos.

## Prueba de verificación con números (caja de ejemplo)

Caja: A = 2 uds × $30, B = 1 ud × $90, C = 3 uds × $10. Total $180. Un pago de $180, tipo de cambio 3.75, comisión S/ 6.75, debitado S/ 681.75. Desaduanaje S/ 45 **por valor**, flete S/ 30 **por cantidad**.

| Línea | Compra | Comisión | Desaduanaje | Flete | Total línea |
|---|---|---|---|---|---|
| A (2 uds) | 225.00 | 2.25 | 15.00 | 10.00 | **252.25** |
| B (1 ud) | 337.50 | 3.38 | 22.50 | 5.00 | **368.38** |
| C (3 uds) | 112.50 | 1.12 | 7.50 | 15.00 | **136.12** |
| **Total** | 675.00 | 6.75 | 45.00 | 30.00 | **756.75** |

## Casos de prueba (24) y resultado esperado

Estado: las pruebas **automáticas** del motor de cálculo (`npm test`, casos 7 a 10) pasaron. El resto son **pruebas manuales** que debes hacer en tu despliegue, porque este código no se ha ejecutado contra tu base Neon ni tu Vercel.

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Crear proveedor | Aparece en la lista con código PRV-001 |
| 2 | Editar proveedor | Los cambios se guardan y la lista se actualiza |
| 3 | Registrar perfume | Aparece con SKU único; un SKU repetido da error claro |
| 4 | Crear caja con varias marcas | Se genera IMP-0001 con un lote por línea |
| 5 | Pago en USD con comisión | Muestra “Cuadra” si compra convertida + comisión = debitado |
| 6 | Registrar desaduanaje | Aparece en la caja y como egreso en Flujo de caja |
| 7 | Repartir por valor | En el ejemplo: desaduanaje 15.00 / 22.50 / 7.50 |
| 8 | Repartir por cantidad | En el ejemplo: flete 10.00 / 5.00 / 15.00 |
| 9 | Asignación manual | Si la suma no es igual al gasto, no deja guardar |
| 10 | Cuadre al céntimo | Total de líneas = S/ 756.75 exactos |
| 11 | Dos lotes del mismo perfume | Dos lotes con costos distintos; el stock total es la suma |
| 12 | Vender desde un lote | La venta guarda el lote y proveedor elegidos |
| 13 | Solo baja el lote elegido | Los demás lotes del perfume no cambian |
| 14 | Venta sin stock | Mensaje de stock insuficiente y no se guarda |
| 15 | Ticket | Se abre e imprime con el detalle y los costos por unidad |
| 16 | Rentabilidad | Línea A vendida a S/ 180: costo 126.13, utilidad 53.87 |
| 17 | Panel | Ventas, utilidad, inventario y caja cambian al registrar |
| 18 | Gastos | El gasto resta en utilidad neta y sale en caja |
| 19 | Recarga | Al recargar, todo sigue ahí (datos en Neon) |
| 20 | Formularios | Ningún botón redirige ni recarga la página |
| 21 | Error de conexión | Mensaje legible con botón Reintentar; el doble clic no duplica |
| 22 | Calculadora sin confirmar | No cambia inventario ni caja hasta confirmar |
| 23 | Celular y computadora | Menú plegable y tablas con desplazamiento lateral |
| 24 | Actualizar versión | Los datos de Neon se conservan |

## Estructura
```
schema.sql            tablas de la base de datos
lib/alloc.js          motor de cálculo en céntimos (usado en pantalla y servidor)
lib/db.js             conexión, transacciones, caja y auditoría
app/api/*             operaciones del servidor
app/(app)/*           pantallas
tests/                pruebas del motor de cálculo
```

## Límites de esta versión
- Los pagos de una importación deben sumar exactamente el total de la caja (no se guardan cajas con deuda pendiente).
- La comisión bancaria y los cargos se ingresan en soles o con la moneda indicada; el importe debitado se ingresa en soles.
- La foto del perfume es un enlace a una imagen, no una subida de archivo.
- Exportación a PDF: usa Imprimir → Guardar como PDF del navegador; el Excel y el CSV son directos.
- Los usuarios se definen en `APP_USERS`; todos tienen los mismos permisos y cada operación queda registrada con su nombre.
