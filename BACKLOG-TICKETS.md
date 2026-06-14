# Backlog de tickets

## Fase 1

### BR-001 Migrar importes monetarios a Decimal

- actualizar `web/prisma/schema.prisma`
- adaptar lecturas y agregaciones para `Decimal`
- revisar respuestas JSON y componentes que esperan `number`
- verificar dashboard, statements y transactions

### BR-002 Centralizar helpers de dinero

- crear helpers para parseo, suma y serializacion
- evitar conversiones ad hoc en rutas y vistas

### BR-003 Endurecer JWT en produccion

- exigir `JWT_SECRET` fuera de desarrollo
- mantener fallback solo en desarrollo local

### BR-004 Endurecer cookie de sesion

- agregar `secure` en produccion
- revisar atributos de expiracion y `sameSite`

### BR-005 Agregar rate limit a login

- limitar intentos por IP
- devolver `429` con mensaje claro

### BR-006 Agregar rate limit a upload

- limitar uploads por IP y ventana temporal
- proteger parseo y almacenamiento

### BR-007 Cerrar CORS abierto en APIs autenticadas

- remover cabeceras `*` innecesarias en transactions
- dejar solo comportamiento same-origin

### BR-008 Corregir documentacion del parser activo

- alinear `README.md` con el flujo de importacion real

## Fase 2

### BR-009 Crear tabla de auditoria

- actor, accion, entidad, before/after, fecha, IP

### BR-010 Auditar login y logout

- registrar exitos y fallos

### BR-011 Auditar operaciones admin

- alta, edicion y borrado de usuarios

### BR-012 Auditar cambios de transacciones

- altas manuales, ediciones y soft delete

### BR-013 Agregar estado al Statement

- `UPLOADED`, `PARSED`, `VALIDATED`, `REVIEW_REQUIRED`, `REJECTED`

### BR-014 Validaciones de reconciliacion post-parse

- consumos vs balance
- pagos y saldo actual
- reglas de tolerancia

### BR-015 Politica de retencion de PDFs

- definir retencion, purga y acceso

## Fase 3

### BR-016 Definir parser oficial

- decidir TypeScript o Python como fuente de verdad

### BR-017 Eliminar drift entre parsers

- retirar el parser no oficial o dejarlo expresamente deprecated

### BR-018 Versionar reglas de parsing

- version por banco y formato

### BR-019 Crear fixtures anonimizados por banco

- BBVA y Galicia

## Fase 4

### BR-020 Tests unitarios de parser

- cobertura de deteccion, cabecera, balances y movimientos

### BR-021 Tests de integracion de upload

- carga exitosa, duplicado y errores de parseo

### BR-022 Tests de auth y RBAC

- login, acceso denegado y rutas admin

### BR-023 Logs estructurados y correlation ids

- web y parser

### BR-024 Metricas operativas

- tiempos de parseo, errores, duplicados, uploads exitosos

## Fase 5

### BR-025 Conciliacion de pagos

- relacionar movimientos, pagos aplicados y saldo financiado

### BR-026 Alertas de cargos atipicos

- repeticion, monto inusual, comercio nuevo

### BR-027 Analitica avanzada de financiamiento

- costo financiero, simulaciones y evolucion de deuda

## Fase 6

### BR-028 Detectar banco no soportado en upload

- distinguir entre banco desconocido y error tecnico de parseo
- devolver estado funcional reutilizable por UI

### BR-029 Crear flujo asincronico de analisis de resumen

- crear job de procesamiento
- persistir estado `ANALYZING` o `PROCESSING`
- permitir polling o refresco desde UI

### BR-030 Crear entidad de mapeo por banco/formato

- guardar version, campos detectados, reglas y confianza

### BR-031 Integrar proveedor LLM para relevamiento inicial

- enviar texto estructurado o paginas relevantes del PDF
- pedir extraccion de header, balances y movimientos
- pedir propuesta de mapping con explicacion

### BR-032 Integrar DeepSeek V4 via adapter

- encapsular credenciales y llamadas del proveedor
- desacoplar el dominio del SDK o API externa
- soportar reemplazo futuro por otro modelo

### BR-033 Ejecutar validaciones de consistencia sobre salida AI

- fechas del periodo
- suma de consumos
- saldo actual
- pago minimo
- duplicados sospechosos

### BR-034 Crear UI de estado de procesamiento

- mostrar `analizando` o `procesando`
- mostrar resultado, confianza y acciones pendientes

### BR-035 Crear flujo de aprobacion manual para mappings nuevos

- aprobar o rechazar propuesta AI
- dejar trazabilidad de quien valido el mapping

### BR-036 Alta automatica de banco durante el flujo AI

- crear `Bank` si no existe
- asociar mapping y statements futuros al banco detectado
