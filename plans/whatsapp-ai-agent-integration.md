# Plan: Modulo De Notificaciones Multi-Canal + Recordatorios De Movimientos Recurrentes

## Objetivo

Antes de retomar la integracion puntual con WhatsApp, construir un modulo general de notificaciones que pueda enviar recordatorios y confirmaciones por distintos canales. El primer caso de uso sera la configuracion de movimientos recurrentes con recordatorio/confirmacion. El canal por defecto sera email y luego se podran agregar WhatsApp, Telegram u otros carriers sin cambiar la logica de negocio.

La funcionalidad de configuracion del modulo y carriers queda disponible solo para perfiles `ADMIN` de momento.

## Principios De Diseno

- Separar evento de negocio, plantilla, canal y delivery.
- El dominio no debe saber si se envia por email, WhatsApp o Telegram.
- Las notificaciones deben ser auditables, reintentables e idempotentes.
- El contenido debe ser configurable por canal.
- El canal email debe ser el default.
- WhatsApp queda como carrier posterior; CallMeBot solo soporta outbound, por lo que no debe condicionar el modelo.
- La confirmacion de acciones sensibles debe hacerse por link seguro o panel autenticado, no por texto libre salvo que exista proveedor inbound confiable.

## Alcance Inicial

### Incluido

- Modulo admin de configuracion de notificaciones.
- Carriers configurables: Email primero, WhatsApp y Telegram como extensiones planificadas.
- Templates por tipo de evento y canal.
- Programacion y envio de recordatorios.
- Registro de intentos, errores, estado y metadata de envio.
- Recordatorios/confirmaciones asociados a movimientos recurrentes.

### Fuera Del MVP

- Conversacion WhatsApp bidireccional completa.
- Confirmacion por respuesta de WhatsApp.
- Editor visual avanzado de templates.
- Segmentacion multi-usuario compleja.

## Casos De Uso

### Movimiento Recurrente Con Recordatorio

Un admin configura un movimiento recurrente:

- Descripcion: alquiler, obra social, suscripcion, sueldo, impuesto, tarjeta, etc.
- Tipo: `DEBIT` o `CREDIT`.
- Categoria.
- Monto esperado.
- Moneda.
- Frecuencia: mensual, semanal, anual, etc.
- Fecha esperada.
- Si requiere confirmacion antes de crear el movimiento.
- Cuantos dias antes recordar.
- Canales de notificacion preferidos.

Flujo:

```text
Scheduler detecta movimiento recurrente proximo
Genera NotificationEvent RECURRENT_TRANSACTION_REMINDER
NotificationEngine renderiza template segun canal
Email carrier envia mensaje por defecto
Admin abre link y confirma o descarta
Si confirma, backend crea Transaction
Se marca la ocurrencia como CONFIRMED/EXECUTED
```

### Movimiento Recurrente Auto-Confirmado

Para ciertos gastos/ingresos confiables, el admin puede configurar que se cree automaticamente y solo se envie una notificacion informativa.

```text
Scheduler detecta ocurrencia vencida
Crea Transaction automaticamente
Envia notificacion: "Movimiento recurrente creado"
```

## Arquitectura

```text
Business Event
  |-- recurring transaction due
  |-- pending AI action
  |-- import completed
  |-- import failed
        |
        v
NotificationEvent
        |
        v
NotificationEngine
        |
        |-- TemplateResolver
        |-- RecipientResolver
        |-- CarrierRouter
        v
NotificationDelivery
        |
        |-- EmailCarrier
        |-- WhatsAppCarrier
        |-- TelegramCarrier
        |-- InAppCarrier (opcional)
```

## Modelos Prisma Propuestos

### `NotificationChannel`

Configura carriers disponibles.

```prisma
model NotificationChannel {
  id             String   @id @default(cuid())
  name           String   @unique // EMAIL_DEFAULT | WHATSAPP_CALLMEBOT | TELEGRAM_BOT
  type           String   // EMAIL | WHATSAPP | TELEGRAM | IN_APP
  enabled        Boolean  @default(true)
  isDefault      Boolean  @default(false)
  configJson     String?  // host smtp, api keys refs, phone, chat id, etc.
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  templates NotificationTemplate[]
}
```

Nota: No guardar secrets planos si se puede evitar. Preferir referencias a variables de entorno dentro de `configJson`.

### `NotificationTemplate`

Template por evento y canal.

```prisma
model NotificationTemplate {
  id          String   @id @default(cuid())
  channelId   String
  eventType   String   // RECURRENT_TRANSACTION_REMINDER, RECURRENT_TRANSACTION_CREATED, AI_ACTION_PENDING
  subject     String?
  body        String
  bodyFormat  String   @default("TEXT") // TEXT | HTML | WHATSAPP | TELEGRAM_MARKDOWN
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  channel NotificationChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  @@unique([channelId, eventType])
  @@index([eventType])
}
```

### `NotificationPreference`

Preferencias por usuario y evento.

```prisma
model NotificationPreference {
  id         String   @id @default(cuid())
  userId     String
  eventType  String
  channelIds String   // JSON array de channel ids ordenados por prioridad
  enabled    Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, eventType])
}
```

### `NotificationEvent`

Evento logico pendiente de enviar.

```prisma
model NotificationEvent {
  id             String   @id @default(cuid())
  userId          String?
  eventType       String
  status          String   @default("PENDING") // PENDING | SENT | PARTIAL | FAILED | CANCELLED
  payloadJson     String
  scheduledFor    DateTime @default(now())
  dedupeKey       String?  @unique
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user User? @relation(fields: [userId], references: [id])
  deliveries NotificationDelivery[]

  @@index([status, scheduledFor])
  @@index([eventType])
}
```

### `NotificationDelivery`

Intento de envio por carrier.

```prisma
model NotificationDelivery {
  id              String   @id @default(cuid())
  eventId          String
  channelId        String
  status           String   @default("PENDING") // PENDING | SENT | FAILED | RETRYING | CANCELLED
  recipient        String
  renderedSubject  String?
  renderedBody     String
  providerMessageId String?
  attemptCount     Int      @default(0)
  lastError         String?
  sentAt            DateTime?
  nextRetryAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  event   NotificationEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  channel NotificationChannel @relation(fields: [channelId], references: [id])

  @@index([status, nextRetryAt])
  @@index([eventId])
}
```

### `RecurringTransaction`

Configuracion del movimiento recurrente.

```prisma
model RecurringTransaction {
  id                 String   @id @default(cuid())
  userId              String
  merchantName        String
  amountArs           Decimal
  amountUsd           Decimal?
  currency            String   @default("ARS")
  transactionType     String   // DEBIT | CREDIT
  categoryId          String?
  frequency           String   // MONTHLY | WEEKLY | YEARLY | CUSTOM
  dayOfMonth          Int?
  dayOfWeek           Int?
  nextRunAt           DateTime
  requiresConfirmation Boolean @default(true)
  reminderDaysBefore  Int      @default(3)
  enabled             Boolean  @default(true)
  notificationChannels String? // JSON array override, null = user preference/default
  notes               String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])
  category Category? @relation(fields: [categoryId], references: [id])
  occurrences RecurringTransactionOccurrence[]

  @@index([userId, enabled])
  @@index([nextRunAt])
}
```

### `RecurringTransactionOccurrence`

Instancia concreta pendiente/confirmada.

```prisma
model RecurringTransactionOccurrence {
  id                     String   @id @default(cuid())
  recurringTransactionId  String
  dueDate                DateTime
  status                 String   @default("PENDING") // PENDING | NOTIFIED | CONFIRMED | REJECTED | EXECUTED | SKIPPED | EXPIRED
  confirmationTokenHash  String?
  expiresAt              DateTime?
  transactionId          String?
  notificationEventId    String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  recurringTransaction RecurringTransaction @relation(fields: [recurringTransactionId], references: [id], onDelete: Cascade)
  transaction Transaction? @relation(fields: [transactionId], references: [id])

  @@index([status, dueDate])
  @@index([recurringTransactionId])
}
```

## Templates Por Carrier

### Email

- `subject`: requerido.
- `bodyFormat`: `HTML`.
- Soporta variables: `{{merchantName}}`, `{{amount}}`, `{{dueDate}}`, `{{confirmUrl}}`, `{{rejectUrl}}`, `{{categoryName}}`.
- Debe tener fallback texto plano generado automaticamente o template adicional.

Ejemplo:

```html
<h2>Confirmar movimiento recurrente</h2>
<p>Se acerca el movimiento <strong>{{merchantName}}</strong>.</p>
<p>Monto: <strong>{{amount}}</strong></p>
<p>Fecha: {{dueDate}}</p>
<p>
  <a href="{{confirmUrl}}">Confirmar</a>
  <a href="{{rejectUrl}}">Rechazar</a>
</p>
```

### WhatsApp

- `bodyFormat`: `WHATSAPP`.
- Formato soportado: `*bold*`, `_italic_`, saltos de linea, links.
- Sin botones en CallMeBot.
- Si luego se usa WhatsApp Business Cloud API, se podran soportar templates aprobados y botones interactivos.

Ejemplo:

```text
*Recordatorio de movimiento recurrente*

{{merchantName}}
{{amount}}
Vence: {{dueDate}}

Confirmar: {{confirmUrl}}
Rechazar: {{rejectUrl}}
```

### Telegram

- `bodyFormat`: `TELEGRAM_MARKDOWN` o `TELEGRAM_HTML`.
- Puede soportar inline keyboard en una version posterior.

Ejemplo:

```text
*Recordatorio de movimiento recurrente*
{{merchantName}} - {{amount}}
Vence: {{dueDate}}

[Confirmar]({{confirmUrl}})
[Rechazar]({{rejectUrl}})
```

### In-App Opcional

- Notificaciones dentro del dashboard.
- Util para fallback si falla email/WhatsApp/Telegram.
- Puede ser el canal de auditoria visual para admins.

## Panel Admin De Configuracion

Agregar seccion `/admin/notifications`.

Pantallas sugeridas:

### Canales

- Listar canales configurados.
- Activar/desactivar canal.
- Marcar canal default.
- Configurar carrier:
  - Email SMTP/provider.
  - WhatsApp CallMeBot outbound.
  - Telegram Bot API.
  - In-App.

### Templates

- Selector de evento.
- Selector de canal.
- Editor de `subject` y `body`.
- Preview con payload de ejemplo.
- Validacion de variables disponibles.
- Reset a template default.

### Preferencias

- Por usuario admin o global.
- Eventos habilitados.
- Orden de canales por evento.
- Fallback si falla canal primario.

### Movimientos Recurrentes

- CRUD de `RecurringTransaction`.
- Toggle `requiresConfirmation`.
- Configurar `reminderDaysBefore`.
- Elegir canales de recordatorio o usar default.
- Ver proxima ocurrencia.
- Ver historial de ocurrencias.

### Auditoria

- Listado de `NotificationEvent`.
- Listado de `NotificationDelivery` con estado, errores, reintentos.
- Reenviar delivery fallido.
- Cancelar evento pendiente.

## Carriers Sugeridos

### Email Default

Recomendacion MVP: usar un provider simple con env vars.

Opciones:

- SMTP generico con `nodemailer`.
- Resend.
- SendGrid.
- Postmark.

Para MVP local, SMTP o Resend son los mas simples.

### WhatsApp

Primera version: CallMeBot outbound.

Limitaciones:

- No inbound.
- No botones.
- No adjuntos.
- Uso personal.

Uso recomendado:

- Recordatorios salientes.
- Links de confirmacion/rechazo que abren la app.

Version futura:

- WhatsApp Business Cloud API o Twilio para inbound, templates aprobados y botones.

### Telegram

Recomendado como segundo carrier real porque es mas simple que WhatsApp.

Capacidades:

- Mensajes salientes via Bot API.
- Webhook inbound sencillo.
- Inline keyboards para confirmar/rechazar sin abrir la app.

### In-App

Canal interno recomendado para auditoria y fallback.

Capacidades:

- Banner/campana en dashboard.
- Pagina `/notifications`.
- Marcado leido/no leido.

## Scheduler Y Worker

Crear un worker interno similar al existente para import jobs.

Endpoint interno:

```text
POST /api/internal/notifications/process
```

Responsabilidades:

1. Generar ocurrencias recurrentes proximas.
2. Crear `NotificationEvent` para recordatorios pendientes.
3. Procesar deliveries `PENDING` o `RETRYING` cuyo `nextRetryAt <= now`.
4. Aplicar backoff de reintentos.
5. Marcar eventos como `SENT`, `PARTIAL` o `FAILED`.

Idempotencia:

- Usar `dedupeKey`, por ejemplo:
  - `recurring:{recurringId}:{dueDate}:reminder`
  - `recurring:{occurrenceId}:confirmed`

## Confirmacion De Movimientos Recurrentes

Endpoints:

```text
GET /admin/recurring/occurrences/[id]
POST /api/admin/recurring/occurrences/[id]/confirm
POST /api/admin/recurring/occurrences/[id]/reject
POST /api/admin/recurring/occurrences/[id]/skip
```

Reglas:

- Admin-only.
- La ocurrencia debe estar `PENDING` o `NOTIFIED`.
- No ejecutar si expiro.
- Confirmacion idempotente: si ya tiene `transactionId`, devolverlo.
- Crear `Transaction` con `source = "MANUAL"` o nuevo source `RECURRENT` si se agrega al dominio.
- Asociar `transactionId` a la ocurrencia.

## Relacion Con AI Chatbot

Este modulo deja preparado el camino para AI:

- AI puede preparar una accion pendiente.
- NotificationEngine envia el recordatorio/confirmacion por canales configurados.
- Admin confirma desde panel o link.
- Luego se crea el movimiento.

No se debe mezclar AI con el carrier WhatsApp directamente. AI produce eventos/acciones; NotificationEngine decide como avisar.

## Variables De Entorno

```bash
# Feature flags
NOTIFICATIONS_ENABLED=true

# Email
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASSWORD=password
EMAIL_FROM="Bank Resumes <no-reply@example.com>"

# WhatsApp outbound via CallMeBot
CALLMEBOT_APIKEY=1234567890

# Telegram future carrier
TELEGRAM_BOT_TOKEN=

# Public URL for confirm/reject links
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Pasos De Implementacion Recomendados

| Paso | Descripcion | Archivos |
|------|-------------|----------|
| 1 | Agregar modelos Prisma de notificaciones y recurrentes | `web/prisma/schema.prisma` |
| 2 | Crear helper de render de templates con variables whitelist | `web/src/lib/notifications/template.ts` |
| 3 | Crear interfaz `NotificationCarrier` | `web/src/lib/notifications/carriers/types.ts` |
| 4 | Implementar `EmailCarrier` default | `web/src/lib/notifications/carriers/email.ts` |
| 5 | Implementar `NotificationEngine` | `web/src/lib/notifications/engine.ts` |
| 6 | Crear worker interno de procesamiento | `web/src/app/api/internal/notifications/process/route.ts` |
| 7 | Crear CRUD admin de canales/templates/preferencias | `/admin/notifications`, `/api/admin/notifications/*` |
| 8 | Crear CRUD de movimientos recurrentes | `/admin/recurring`, `/api/admin/recurring/*` |
| 9 | Crear confirmacion/rechazo de ocurrencias | `/api/admin/recurring/occurrences/*` |
| 10 | Agregar `WhatsAppCarrier` CallMeBot outbound | `web/src/lib/notifications/carriers/whatsapp-callmebot.ts` |
| 11 | Agregar `TelegramCarrier` opcional | `web/src/lib/notifications/carriers/telegram.ts` |
| 12 | Retomar integracion WhatsApp/AI sobre el modulo | plan posterior |

## Criterios De Aceptacion MVP

- Admin puede configurar al menos un canal email default.
- Admin puede editar template HTML de recordatorio recurrente.
- Admin puede crear un movimiento recurrente que requiere confirmacion.
- Scheduler crea un evento de notificacion antes del vencimiento.
- Email se envia con links de confirmar/rechazar.
- Confirmar crea exactamente un movimiento.
- Confirmar dos veces no duplica movimientos.
- Rechazar no crea movimiento y marca ocurrencia.
- Los envios quedan auditados con estado y errores.
- Si un carrier falla, el delivery queda `FAILED` o `RETRYING` y puede verse en admin.

## Riesgos Y Decisiones Pendientes

- Elegir provider email inicial: SMTP, Resend, SendGrid o Postmark.
- Definir si `Transaction.source` agrega valor `RECURRENT` o se usa `MANUAL`.
- Definir si los movimientos recurrentes pueden ser de usuarios no-admin en el futuro.
- Definir cantidad maxima de reintentos por delivery.
- Definir si los templates son globales o por usuario.
- Definir estrategia para secrets: env vars vs DB cifrada.
- Definir retencion de eventos/deliveries antiguos.

## Retomar WhatsApp Luego

Cuando el modulo de notificaciones este estable:

1. Implementar `WhatsAppCarrier` con CallMeBot para outbound.
2. Usarlo solo para recordatorios con links.
3. Evaluar provider inbound real si se quiere confirmar respondiendo desde WhatsApp.
4. Integrar AI generando `NotificationEvent` o `AiPendingAction`, no enviando mensajes directamente.
