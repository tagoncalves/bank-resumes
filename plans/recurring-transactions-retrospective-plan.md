# Plan: Movimientos Recurrentes Con Carga Retrospectiva

## Objetivo

Evolucionar el soporte actual de movimientos recurrentes para que el usuario pueda crear gastos o ingresos recurrentes desde el flujo normal de movimientos, configurar facilmente su periodicidad, decidir si cada ocurrencia se crea automaticamente o requiere confirmacion, y generar movimientos historicos hacia atras desde una fecha elegida.

Ejemplo objetivo: cargar `Alquiler` por primera vez en junio, configurarlo como gasto mensual, pedir que se cargue desde enero del mismo anio, y crear automaticamente las ocurrencias de enero a junio o dejarlas pendientes de confirmacion segun la configuracion elegida.

## Estado Actual

Ya existe una base util:

- `RecurringTransaction` y `RecurringTransactionOccurrence` en Prisma.
- Creacion de recurrente desde `AddTransactionForm`, pero con configuracion minima.
- Frecuencia actualmente fija en `MONTHLY`.
- `nextRunAt`, `dayOfMonth`, `requiresConfirmation` y `reminderDaysBefore` ya existen.
- El engine de notificaciones genera recordatorios, confirma ocurrencias y crea movimientos automaticos.
- Confirmacion/rechazo de ocurrencias existe bajo rutas admin.

Limitaciones actuales:

- No hay UI clara para elegir periodicidad.
- No hay carga retrospectiva.
- No hay previsualizacion de ocurrencias a crear.
- La logica de avance usa `addMonth`, por lo que no escala a semanal, quincenal, anual, etc.
- La creacion desde movimiento solo contempla recordatorio mensual simple.
- La administracion de recurrentes esta en endpoints `admin`, pero el caso de uso pertenece al usuario autenticado que carga movimientos.

## Refinamiento Funcional

### Conceptos

Un movimiento recurrente es una regla que describe como crear o pedir confirmacion para movimientos futuros y, opcionalmente, historicos.

Campos principales:

- Descripcion: `Alquiler`, `Sueldo`, `Seguro`, `Netflix`.
- Tipo: gasto `DEBIT` o ingreso `CREDIT`.
- Categoria.
- Moneda e importe.
- Fecha base: primera fecha real de ocurrencia.
- Periodicidad.
- Politica de carga: automatica o con confirmacion.
- Recordatorio: cuantos dias antes avisar.
- Fecha desde para carga retrospectiva opcional.
- Fecha hasta para carga retrospectiva opcional, default: fecha del movimiento actual o hoy.

### Periodicidades MVP

Incluir primero:

- Semanal.
- Quincenal, cada 2 semanas.
- Mensual.
- Bimestral, cada 2 meses.
- Trimestral, cada 3 meses.
- Semestral, cada 6 meses.
- Anual.

Dejar fuera del MVP:

- Reglas complejas tipo "ultimo dia habil del mes".
- Dias habiles bancarios.
- Calendarios por feriados.
- Periodicidad custom arbitraria con UI avanzada.

### Carga Automatica vs Confirmacion

Modo automatico:

- Cuando una ocurrencia vence, el sistema crea el movimiento sin intervencion.
- Se registra la ocurrencia como `EXECUTED`.
- Puede enviarse notificacion informativa.
- Aplica a importes confiables y fijos: alquiler, abonos, sueldo fijo.

Modo con confirmacion:

- El sistema genera una ocurrencia `PENDING` o `NOTIFIED`.
- El usuario confirma o rechaza.
- Solo al confirmar se crea el movimiento.
- Aplica a importes variables o casos que requieren revision: tarjeta, servicios, cuotas variables.

### Retrospectiva

Al crear una regla recurrente, el usuario puede activar:

```text
Cargar ocurrencias anteriores
Desde: 2026-01-01
Hasta: 2026-06-21
Accion: crear movimientos ahora | dejarlas pendientes para confirmar
```

Reglas:

- La fecha `desde` debe ser menor o igual a la fecha base/proxima ocurrencia.
- Se generan fechas usando la misma periodicidad definida.
- No se crean duplicados si ya existe una ocurrencia con la misma `recurringTransactionId + dueDate`.
- Para movimientos creados automaticamente, guardar `source = RECURRENT`.
- Para ocurrencias pendientes, no crear `Transaction` hasta confirmar.
- La UI debe mostrar una previsualizacion antes de guardar: cantidad, primeras fechas y total estimado.

Ejemplo mensual:

```text
Descripcion: Alquiler
Fecha base/proxima: 2026-06-10
Periodicidad: mensual
Retrospectiva desde: 2026-01-10

Fechas generadas:
2026-01-10
2026-02-10
2026-03-10
2026-04-10
2026-05-10
2026-06-10
```

### UX Propuesta

En `Agregar movimiento`, reemplazar el bloque actual:

```text
Activar recordatorio mensual para este movimiento
```

Por:

```text
Convertir en recurrente

Periodicidad: [Mensual v]
Proxima fecha: [date]
Modo de carga: [Crear automaticamente | Pedir confirmacion]
Recordar: [3] dias antes

[ ] Cargar retrospectivamente
Desde: [date]
Hasta: [date]
Accion historica: [Crear movimientos ahora | Dejar pendientes]

Vista previa:
6 ocurrencias, total estimado $ 1.200.000
10/01/2026, 10/02/2026, 10/03/2026 ...
```

Agregar tambien una accion desde cada movimiento existente:

- `Hacer recurrente`.
- Precarga descripcion, importe, tipo, categoria y fecha.
- Permite retrospectiva.

### Pantalla de Gestion

Crear una vista simple para recurrentes, preferentemente dentro de `Movimientos` como tab o seccion:

- Activas.
- Pausadas.
- Pendientes de confirmacion.
- Historial de ocurrencias.

Acciones:

- Pausar/reactivar regla.
- Editar importe/categoria/proxima fecha/periodicidad.
- Confirmar o rechazar ocurrencias pendientes.
- Ejecutar ahora.
- Generar retrospectiva adicional.

## Modelo De Datos

### Cambios Recomendados

Extender `RecurringTransaction`:

```prisma
model RecurringTransaction {
  frequency        String   @default("MONTHLY")
  interval         Int      @default(1)
  anchorDate       DateTime?
  autoCreate       Boolean  @default(false)
  endDate          DateTime?
  lastGeneratedAt  DateTime?
}
```

Notas:

- Mantener `requiresConfirmation` por compatibilidad funcional, pero definir semantica clara:
  - `requiresConfirmation = true` equivale a `autoCreate = false`.
  - `requiresConfirmation = false` equivale a `autoCreate = true`.
- `frequency` puede ser `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`.
- `interval` expresa cada cuanto: mensual = `MONTHLY + 1`, bimestral = `MONTHLY + 2`, quincenal = `WEEKLY + 2`.
- `anchorDate` preserva el dia original para calcular nuevas fechas.
- `endDate` permite terminar reglas en el futuro sin borrarlas.

Extender `RecurringTransactionOccurrence`:

```prisma
model RecurringTransactionOccurrence {
  generationType String? // FUTURE | BACKFILL | MANUAL
}
```

Opcional para auditoria:

```prisma
createdByMode String? // AUTO | CONFIRMATION | BACKFILL_AUTO
```

## API Propuesta

### Usuario Autenticado

Crear endpoint no-admin:

```text
GET    /api/recurring-transactions
POST   /api/recurring-transactions
PATCH  /api/recurring-transactions/[id]
DELETE /api/recurring-transactions/[id]
POST   /api/recurring-transactions/preview
POST   /api/recurring-transactions/[id]/backfill
POST   /api/recurring-transactions/occurrences/[id]/confirm
POST   /api/recurring-transactions/occurrences/[id]/reject
```

Mantener endpoints admin existentes solo para administracion global o migrarlos gradualmente.

### Crear Regla

Payload:

```json
{
  "merchantName": "Alquiler",
  "amountArs": 250000,
  "amountUsd": null,
  "currency": "ARS",
  "transactionType": "DEBIT",
  "categoryId": "...",
  "frequency": "MONTHLY",
  "interval": 1,
  "anchorDate": "2026-06-10",
  "nextRunAt": "2026-07-10",
  "requiresConfirmation": false,
  "reminderDaysBefore": 3,
  "backfill": {
    "enabled": true,
    "from": "2026-01-10",
    "to": "2026-06-10",
    "mode": "CREATE_TRANSACTIONS"
  }
}
```

### Preview

El endpoint `preview` recibe periodicidad y rango, y devuelve:

```json
{
  "count": 6,
  "dates": ["2026-01-10", "2026-02-10", "2026-03-10"],
  "hasMore": true,
  "totalArs": 1500000
}
```

## Logica De Calendario

Crear helper central:

```text
web/src/lib/recurring/schedule.ts
```

Funciones:

- `getNextOccurrenceDate(anchorDate, frequency, interval, afterDate)`.
- `generateOccurrenceDates({ from, to, anchorDate, frequency, interval, max })`.
- `advanceDate(date, frequency, interval, anchorDay?)`.
- `normalizeRecurringConfig(input)`.

Reglas importantes:

- Usar helpers date-only existentes para evitar drift timezone.
- Para mensual con dia 31, si un mes no tiene 31, usar ultimo dia del mes.
- Mantener idempotencia con unique `(recurringTransactionId, dueDate)`.
- Limitar preview/backfill a un maximo razonable, por ejemplo 120 ocurrencias.

## Worker / Engine

Actualizar `generateRecurringReminders`:

- Reemplazar `addMonth(item.nextRunAt)` por helper de schedule.
- Generar todas las ocurrencias vencidas hasta `now`, no solo una, con limite de seguridad.
- Si `requiresConfirmation = false`, crear movimiento automaticamente cuando `dueDate <= now`.
- Si `requiresConfirmation = true`, crear ocurrencia pendiente y notificar segun `reminderDaysBefore`.
- No avanzar `nextRunAt` si falla la creacion de ocurrencia critica.

## Flujo De Backfill

Dentro de la transaccion de creacion:

1. Crear `RecurringTransaction`.
2. Generar fechas retrospectivas con `generateOccurrenceDates`.
3. Crear `RecurringTransactionOccurrence` por fecha con `generationType = BACKFILL`.
4. Si modo `CREATE_TRANSACTIONS`, crear `Transaction` por cada ocurrencia y marcar `EXECUTED`.
5. Si modo `PENDING_CONFIRMATION`, dejar `PENDING`.
6. Setear `nextRunAt` al proximo vencimiento futuro posterior al `to` o posterior a hoy.

Estados:

```text
PENDING -> NOTIFIED -> EXECUTED
PENDING -> REJECTED
PENDING -> SKIPPED
```

## Implementacion Por Fases

### Fase 1: Motor De Periodicidad

- Crear `web/src/lib/recurring/schedule.ts`.
- Agregar tests unitarios para mensual, quincenal, anual y dia 31.
- Actualizar engine para usar helper en lugar de `addMonth`.

### Fase 2: Schema Y API

- Agregar `interval`, `anchorDate`, `endDate`, `lastGeneratedAt` y `generationType`.
- Crear endpoints no-admin para usuario autenticado.
- Agregar endpoint `preview`.
- Mantener compatibilidad con registros existentes: si `interval` es null/default, tratar como `1`; si `anchorDate` falta, usar `nextRunAt`.

### Fase 3: UI En Alta De Movimiento

- Reemplazar bloque mensual simple por configurador recurrente.
- Agregar periodicidad, modo automatico/confirmacion y preview.
- Agregar retrospectiva opcional.
- Integrar payload nuevo en `/api/transactions` o migrar a endpoint dedicado.

### Fase 4: Gestion De Recurrentes

- Agregar vista de reglas recurrentes.
- Listar pendientes de confirmacion.
- Acciones: confirmar, rechazar, pausar, reactivar, editar, ejecutar ahora.

### Fase 5: Calidad Y Migracion

- Revisar registros existentes `frequency = MONTHLY`.
- Backfill de `interval = 1` y `anchorDate = nextRunAt`.
- Agregar validaciones de duplicados.
- Documentar comportamiento de fechas y limites.

## Criterios De Aceptacion

- Puedo crear un movimiento como recurrente desde el formulario de movimientos.
- Puedo elegir periodicidad semanal, quincenal, mensual, bimestral, trimestral, semestral o anual.
- Puedo elegir carga automatica o confirmacion manual.
- Puedo activar retrospectiva desde una fecha anterior.
- Antes de guardar, veo cuantas ocurrencias se van a generar.
- Si elijo crear historicos automaticamente, se crean movimientos con `source = RECURRENT`.
- Si elijo confirmar historicos, quedan ocurrencias pendientes sin crear movimientos.
- No se generan duplicados ante reintentos.
- El worker genera futuras ocurrencias con la periodicidad correcta.
- `npm run build` pasa.

## Riesgos Y Decisiones Pendientes

- Decidir si los movimientos recurrentes deben poder editar importes historicos individualmente antes de confirmar.
- Decidir si `source = RECURRENT` debe habilitar edicion/eliminacion desde movimientos como los manuales.
- Definir limite maximo de backfill para evitar creaciones accidentales masivas.
- Definir si la retrospectiva debe crear desde la fecha exacta elegida o desde la primera fecha alineada con `anchorDate`.
- Evaluar si las reglas recurrentes deben ser visibles solo para el usuario o tambien en admin global.

## Recomendacion

Implementar primero Fase 1 a Fase 3. Eso entrega el valor principal: crear recurrentes flexibles y cargar historicos desde movimientos. La pantalla avanzada de gestion puede venir despues, reutilizando los endpoints y el motor ya estabilizados.
