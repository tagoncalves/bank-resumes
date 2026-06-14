# Analisis bancario del proyecto BankResume

## Objetivo del analisis

Este documento evalua `bank-resumes` con criterio de producto financiero y de ingenieria bancaria. El foco no es solo tecnico: tambien considera integridad monetaria, trazabilidad, seguridad, gobierno del dato, operacion y evolucion posible del producto.

El analisis se basa en el codigo actual, principalmente en:

- `README.md`
- `web/prisma/schema.prisma`
- `web/src/app/api/statements/upload/route.ts`
- `web/src/lib/data.ts`
- `web/src/lib/auth.ts`
- `web/src/middleware.ts`
- `web/src/app/api/transactions/route.ts`
- `web/src/app/api/transactions/[id]/route.ts`
- `web/src/lib/pdf-parser/index.ts`
- `web/src/lib/parser-client.ts`
- `parser/main.py`
- `parser/routers/parse.py`

## Resumen ejecutivo

El proyecto ya aplica varios conceptos valiosos de un producto financiero digital:

- normalizacion de datos de resumenes bancarios
- separacion entre dominio de tarjetas, resumenes y movimientos
- persistencia atomica del resumen importado
- deduplicacion por hash del documento
- segmentacion por usuario y RBAC basico
- soporte multi-banco y multi-moneda
- modelado de cargos financieros e impuestos locales

Sin embargo, todavia esta mas cerca de una buena app fintech de analitica personal que de una plataforma con estandares bancarios fuertes. Las principales brechas hoy son:

- uso de `Float` para importes monetarios
- ausencia de auditoria funcional y operativa
- secretos y controles de sesion debiles por default
- falta de controles anti abuso y hardening de APIs
- almacenamiento de PDFs sin cifrado ni politica de retencion
- duplicidad arquitectonica entre parser TypeScript y parser Python
- falta de testing automatizado visible

La conclusion es positiva: la base de dominio esta bien elegida para el problema de negocio, pero para escalar en confiabilidad, compliance y operacion necesita una segunda etapa mas orientada a controles y consistencia.

## Que conceptos bancarios ya se aplican

### 1. Ingestion y normalizacion de extractos

El producto implementa un flujo parecido a una capa de ingestion documental bancaria:

- detecta banco y estructura de resumen
- extrae cabecera, saldos y movimientos
- persiste una representacion normalizada

Esto aparece en `web/src/app/api/statements/upload/route.ts` y en los parsers de `web/src/lib/pdf-parser` y `parser/`.

Valor bancario:

- desacopla el documento fuente del modelo analitico
- permite agregar nuevos bancos con adaptadores especificos
- habilita controles posteriores de reconciliacion y calidad

### 2. Modelo de dominio financiero razonable

El schema Prisma separa entidades importantes:

- `Bank`
- `Card`
- `Statement`
- `BalanceSummary`
- `Transaction`
- `Category`
- `User`

Esto es correcto para un producto que consume resumenes de tarjeta y construye reporting. En particular, `BalanceSummary` captura conceptos relevantes para el dominio local:

- saldo anterior
- pagos aplicados
- consumo total
- comisiones
- impuestos (`sello`, `IVA`, `IIBB`)
- intereses de financiacion
- pago minimo
- tasas `TNA`, `TEM`, `TEA`

Ese nivel de detalle es bueno y ya lo diferencia de un simple tracker de gastos.

### 3. Persistencia atomica de la importacion

En `web/src/app/api/statements/upload/route.ts` el alta del resumen, balance y movimientos se hace dentro de `prisma.$transaction(...)`.

Concepto aplicado:

- consistencia transaccional
- evitar estados parciales de carga

Desde una perspectiva bancaria, esto es imprescindible. Si falla una parte de la carga, no queda un resumen medio persistido.

### 4. Deteccion de duplicados

El uso de `sourceHash` unico en `Statement` y la validacion previa del PDF aplican un control de unicidad documental.

Concepto aplicado:

- idempotencia de importacion
- control de reproceso

Es una buena base para ingestion confiable.

### 5. Segmentacion por usuario y control de acceso

El proyecto ya tiene:

- autenticacion por JWT en cookie: `web/src/lib/auth.ts`
- middleware de proteccion: `web/src/middleware.ts`
- separacion `ADMIN` / `USER`
- filtro por `userId` en consultas sensibles

Esto introduce conceptos de:

- data isolation por usuario
- RBAC basico
- seguridad perimetral para rutas privadas

### 6. Soft delete de movimientos

`Transaction.deletedAt` y su uso en consultas y borrado permiten conservar historial logico de eliminacion.

Concepto aplicado:

- trazabilidad funcional parcial
- no destruccion inmediata de registros operativos

### 7. Multi-moneda

La presencia de campos `ARS` y `USD` tanto en saldos como en transacciones refleja una realidad bancaria concreta de Argentina.

Concepto aplicado:

- modelado monetario multimoneda
- analitica diferenciada por moneda

## Que conceptos deberian aplicarse y hoy faltan

### 1. Precision monetaria estricta

Hoy casi todos los importes monetarios se almacenan como `Float` en `web/prisma/schema.prisma`.

Riesgo:

- errores de redondeo acumulados
- diferencias entre visualizacion, agregacion y persistencia
- problemas al reconciliar contra el resumen original

En sistemas financieros no deberia usarse `float` para dinero. Lo correcto seria:

- `Decimal`/`Numeric` en base de datos
- libreria decimal en capa de aplicacion
- reglas de redondeo explicitas por campo

Este es el gap mas importante del proyecto desde la perspectiva bancaria.

### 2. Auditoria completa

No se observa un audit trail real de:

- quien subio un PDF
- quien edito un movimiento manualmente
- valores anteriores y nuevos
- fecha, IP, user-agent, motivo del cambio

El soft delete ayuda, pero no reemplaza una bitacora de auditoria.

En un producto financiero esto deberia existir como minimo para:

- altas de resumenes
- ediciones manuales
- borrados logicos
- administracion de usuarios
- eventos de autenticacion

### 3. Seguridad de autenticacion mas robusta

En `web/src/lib/auth.ts` existe un secreto por default:

- `dev-secret-please-change-in-production`

Y en `web/src/app/api/auth/login/route.ts` la cookie no define `secure: true`.

Riesgo:

- despliegue inseguro por configuracion incompleta
- menor endurecimiento de sesion en entornos reales

Deberia aplicarse:

- secreto obligatorio en produccion
- cookie `secure` en produccion
- expiracion con rotacion o renovacion controlada
- invalidacion de sesiones si se cambia credencial critica

### 4. Rate limiting y proteccion anti abuso

No aparecen controles de rate limit para:

- login
- upload de PDFs
- operaciones administrativas
- APIs de lectura mas pesadas

En aplicaciones con login y carga de archivos esto es importante para:

- frenar fuerza bruta
- limitar denegacion de servicio
- proteger costos de parseo

### 5. Gobierno del documento fuente

Los PDFs se guardan en disco local en `uploads/statements` desde `web/src/app/api/statements/upload/route.ts`.

No se observan:

- cifrado en reposo
- politica de retencion
- clasificacion de sensibilidad
- borrado seguro o purga
- metadata de custodia documental

Dado que un resumen bancario contiene informacion financiera personal, deberia tratarse como dato sensible.

### 6. Reconciliacion y controles de calidad de carga

El sistema persiste movimientos y balance, pero no se ve una capa formal de validacion de consistencia tipo:

- suma de movimientos vs total de consumo
- validacion de saldo anterior, pagos, intereses e impuestos contra saldo actual
- conteo esperado de movimientos
- deteccion de transacciones sospechosamente duplicadas dentro del mismo resumen

Esto mejoraria mucho la confiabilidad del parser.

### 7. Arquitectura de parsing unificada

Hay una divergencia importante:

- `README.md` dice que la web llama al parser Python
- `web/src/lib/parser-client.ts` existe para ese fin
- pero el flujo real usa `parseStatementBuffer` en `web/src/lib/pdf-parser/index.ts`

Riesgo:

- documentacion desalineada
- doble mantenimiento de reglas de parseo
- resultados distintos entre ambos parsers
- mas costo de evolucion por cada banco nuevo

Para un producto financiero conviene una unica fuente de verdad de parsing.

### 8. Observabilidad y operacion

El parser Python tiene logging basico, pero no se ve una estrategia de observabilidad con:

- metricas de exito/falla por banco
- tiempos de parseo
- ratio de duplicados
- ratio de errores por tipo
- dashboard operativo
- correlation ids

Sin esto, escalar soporte y calidad parser se vuelve dificil.

### 9. Testing automatizado

No aparecen tests en el repo. Para un dominio financiero, al menos deberia haber:

- tests unitarios de parseo por banco
- fixtures PDF o snapshots estructurados
- tests de integracion de upload y persistencia
- tests de auth y permisos
- tests de agregaciones del dashboard

## Mejoras sobre lo ya implementado

### 1. Endurecer el manejo de dinero

Mejora recomendada:

- migrar importes a `Decimal`
- definir precision/scale por campo
- centralizar helpers de parseo, redondeo y formateo

Impacto:

- mejora exactitud
- facilita reconciliacion
- evita bugs silenciosos en reporting

### 2. Incorporar tabla de auditoria

Crear un modelo tipo `AuditEvent` o `ActivityLog` con:

- actorId
- action
- entityType
- entityId
- beforeJson
- afterJson
- createdAt
- ip

Eventos minimos:

- login exitoso/fallido
- upload de resumen
- alta/edicion/borrado de transaccion
- alta/edicion/borrado de usuario admin

### 3. Agregar controles de consistencia post-parse

Despues de parsear y antes de persistir:

- validar que fechas del resumen sean coherentes
- validar que `minimumPayment <= currentBalance` cuando aplique
- comparar suma de consumos contra campos de resumen con tolerancia definida
- marcar el statement con estado `VALID`, `WARN`, `ERROR`

Esto permitiria un modelo operativo mas maduro que un simple parse success/failure.

### 4. Formalizar estados del resumen

`Statement` hoy actua como documento cargado, pero puede crecer con un ciclo de vida mas bancario:

- `UPLOADED`
- `PARSED`
- `VALIDATED`
- `REVIEW_REQUIRED`
- `REJECTED`

Esto habilita colas operativas, QA y re-proceso.

### 5. Mejorar seguridad de API

Aplicar:

- rate limit por IP y por usuario
- validacion de payloads con schemas explicitos
- CORS mas restrictivo en endpoints que hoy exponen `*`
- secreto JWT obligatorio en produccion
- cookie segura y politica de expiracion revisada

Nota: en `web/src/app/api/transactions/route.ts` y `[id]/route.ts` hay cabeceras CORS abiertas a `*`. Aunque la app usa sesion por cookie y esas rutas exigen autenticacion, no suma valor abrirlas asi en un sistema financiero.

### 6. Reducir uso de SQL raw innecesario

En APIs de admin y login hay uso de `prisma.$queryRawUnsafe` y `prisma.$executeRawUnsafe`.

Aunque se usan placeholders, para este caso el estandar recomendado seria:

- usar Prisma ORM cuando sea posible
- reservar SQL raw para casos realmente necesarios

Beneficios:

- menos superficie de riesgo
- mejor mantenibilidad
- validacion tipada mas clara

### 7. Politica de retencion y cifrado de PDFs

Definir:

- si el PDF original se conserva o no
- por cuanto tiempo
- donde se guarda en produccion
- si se cifra
- quien puede descargarlo

Idealmente:

- storage gestionado
- cifrado en reposo
- acceso autenticado y auditado

### 8. Unificar parser activo

Elegir una estrategia:

1. parser unico en TypeScript dentro de `web/`
2. parser unico como servicio Python

No conviene sostener ambos como soluciones paralelas de largo plazo. Para evolucion bancaria, una unica fuente de verdad reduce drift funcional.

## Mejoras como evolucion del proyecto

### Etapa 1. Hardening basico

Prioridad alta, bajo costo relativo:

- pasar dinero a decimal
- exigir `JWT_SECRET` en produccion
- agregar `secure` a cookies en produccion
- rate limit de login y upload
- cerrar CORS no necesario
- agregar tests minimos de parser y auth

### Etapa 2. Confiabilidad operativa

- audit trail completo
- validaciones de reconciliacion
- estados del resumen
- observabilidad de parseo y carga
- manejo de errores por categoria
- reportes de calidad por banco/version de parser

### Etapa 3. Plataforma financiera mas madura

- versionado de parser y reglas de extraccion
- cola asincronica de procesamiento
- reproceso de documentos
- storage externo seguro para PDFs
- panel operativo de incidencias
- gestion de excepciones y revision manual

### Etapa 4. Expansion funcional

Si el producto evoluciona de analitica personal a plataforma financiera ampliada, se podria incorporar:

- cuentas bancarias y no solo tarjetas
- conciliacion entre movimientos y pagos
- presupuestos y proyecciones de deuda
- alertas de cargos atipicos
- analitica de interes financiado y costo financiero total
- conectores Open Finance/Open Banking si el mercado objetivo lo justifica

## Conceptos que aplican solo si el alcance crece

No todo concepto bancario tradicional es necesario hoy. Por ejemplo, KYC/AML, antifraude transaccional en tiempo real, motor contable de doble entrada o integracion con rails de pago no parecen obligatorios para el alcance actual, porque el sistema:

- no mueve dinero
- no origina pagos
- no abre cuentas
- no ejecuta transferencias

Si evoluciona hacia pagos, agregacion financiera mas profunda o servicios para terceros, ahi si esos conceptos pasan a ser requeridos.

## Hallazgos puntuales del estado actual

### Hallazgo 1. Desalineacion entre documentacion y flujo real

`README.md` indica que la web llama al parser Python, pero el upload real usa el parser local TypeScript en `web/src/app/api/statements/upload/route.ts`.

Esto deberia corregirse, ya sea en documentacion o en arquitectura.

### Hallazgo 2. Riesgo monetario por `Float`

`BalanceSummary` y `Transaction` usan `Float` para importes en `web/prisma/schema.prisma`.

Es el principal riesgo tecnico-financiero del modelo actual.

### Hallazgo 3. Seguridad aceptable para MVP, insuficiente para una app financiera madura

Hay auth, RBAC y aislamiento por usuario, pero faltan controles de endurecimiento tipicos:

- secreto obligatorio
- cookies seguras
- rate limiting
- auditoria
- storage sensible protegido

### Hallazgo 4. Buen modelado de resumen local argentino

La inclusion de tasas e impuestos argentinos muestra buen entendimiento del dominio de tarjetas local. Esto es una fortaleza clara del proyecto.

### Hallazgo 5. Sin evidencia de suite automatizada

No se encontraron tests, lo cual limita evolucion segura de parsers y agregaciones.

## Recomendacion priorizada

Orden recomendado de ejecucion:

1. Resolver dinero con `Decimal`.
2. Unificar parser y actualizar documentacion.
3. Agregar audit trail para cambios y uploads.
4. Endurecer autenticacion y APIs.
5. Implementar validaciones de reconciliacion.
6. Incorporar testing automatizado con fixtures reales anonimizados.
7. Profesionalizar storage y retencion de PDFs.

## Conclusion

`BankResume` ya tiene una base funcional fuerte y un dominio bien orientado al problema de resumenes de tarjeta en Argentina. Lo mejor del proyecto hoy es su modelo de negocio-dato: entiende bancos, tarjetas, periodos, impuestos, tasas, cuotas y multi-moneda.

Lo que mas necesita para dar un salto de calidad no es una gran expansion de features, sino endurecimiento financiero-tecnico:

- exactitud monetaria
- trazabilidad
- seguridad operativa
- controles de consistencia
- simplificacion arquitectonica del parsing

Si esas capas se incorporan, el proyecto puede evolucionar de una buena herramienta personal de analitica a una plataforma financiera mucho mas confiable y profesional.
