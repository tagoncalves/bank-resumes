# Roadmap tecnico priorizado

## Objetivo

Transformar `bank-resumes` desde un MVP funcional de analitica financiera a una base mas confiable, consistente y segura para un producto de datos bancarios.

## Prioridades

### Fase 1. Hardening y exactitud monetaria

Objetivo: eliminar los riesgos mas importantes de precision y seguridad basica.

- migrar importes monetarios de `Float` a `Decimal`
- normalizar conversiones y serializacion de dinero en APIs y vistas
- exigir `JWT_SECRET` en produccion
- marcar cookies de sesion como `secure` en produccion
- agregar rate limit a login y upload
- cerrar CORS abierto en rutas autenticadas que no lo necesitan
- actualizar documentacion si el flujo real de parsing sigue en `web/`

Resultado esperado:

- menos riesgo de redondeo
- menor superficie de abuso
- base mas segura para evolucionar

### Fase 2. Trazabilidad y controles operativos

Objetivo: mejorar auditabilidad y confiabilidad de carga.

- crear audit trail para login, uploads, cambios manuales y admin
- incorporar estados funcionales del resumen
- agregar validaciones de reconciliacion post-parse
- registrar errores por categoria y advertencias de parsing
- definir politicas de retencion para PDFs

Resultado esperado:

- mejor soporte operativo
- mas capacidad de diagnostico
- mayor confianza en los datos importados

### Fase 3. Simplificacion arquitectonica del parser

Objetivo: reducir drift y costo de mantenimiento.

- elegir una sola fuente de verdad para parsing
- eliminar o deprecate el camino alternativo
- versionar parser y reglas de extraccion
- agregar fixtures anonimizados por banco

Resultado esperado:

- menos duplicacion
- menos inconsistencias entre ambientes
- onboard mas simple para nuevos bancos

### Fase 4. Observabilidad y calidad automatizada

Objetivo: poder operar y cambiar el sistema con seguridad.

- agregar tests unitarios de parseo
- agregar tests de integracion de upload/persistencia
- agregar tests de auth/RBAC
- medir metricas de parseo y carga
- incorporar correlation ids y logs estructurados

Resultado esperado:

- menor regresion funcional
- mejor soporte de produccion

### Fase 5. Evolucion funcional

Objetivo: ampliar el producto con base robusta.

- conciliacion de pagos y consumos
- alertas de cargos atipicos
- comparativas entre tarjetas y bancos
- analitica avanzada de interes financiado
- posibles conectores Open Finance si el alcance comercial lo requiere

### Fase 6. Mapeo asistido por AI para bancos no soportados

Objetivo: convertir la importacion de bancos no mapeados en un flujo asistido y operable.

- detectar banco o formato no soportado durante el upload
- crear el banco en el dominio si todavia no existe
- dejar el statement en estado `ANALYZING` o `PROCESSING`
- derivar el documento a un flujo asincronico de relevamiento y mapeo
- integrar un modelo LLM para extraer estructura, proponer mapping y explicar supuestos
- correr pruebas de consistencia sobre header, balances, fechas y movimientos
- requerir aprobacion manual o validacion automatica segun nivel de confianza

Consideraciones:

- el LLM no deberia persistir directo en produccion sin una capa de validacion
- el resultado del modelo debe quedar versionado y auditable
- la integracion deberia desacoplarse del request HTTP inicial
- si se usa DeepSeek, conviene encapsularlo detras de un `mapping service` propio para no acoplar reglas al proveedor

## Orden recomendado

1. Exactitud monetaria y auth/API hardening.
2. Auditoria y reconciliacion.
3. Parser unico y documentacion consistente.
4. Testing y observabilidad.
5. Expansion funcional.
6. Mapeo AI para bancos no soportados.
