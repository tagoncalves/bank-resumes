# Cloudflare Deployment Plan

## 1. Application Overview

| Component | Stack | Cloudflare Compatibility |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 18 | Parcial con `@cloudflare/next-on-pages` |
| API Routes | Next.js Route Handlers | La mayoría requiere Node.js runtime |
| Database | Prisma + SQLite | **Incompatible** — migrar a PostgreSQL/Neon |
| PDF Parsing | `pdf-parse`, `pdfjs-dist`, `canvas` | **Incompatible** — dependencias nativas |
| OCR | `tesseract.js` + `canvas` | **Incompatible** |
| File Storage | `fs` local (`uploads/`) | **Incompatible** — migrar a R2 |
| Auth | JWT (`jose`) | Compatible |
| AI | DeepSeek API (HTTP) | Compatible (solo fetch) |
| Background Jobs | Internal API + CRON | Compatible con Workers CRON |
| Charts | Recharts | Compatible (cliente) |
| Python Parser | FastAPI + pdfplumber | No corre en Cloudflare (servicio separado) |

---

## 2. Critical Blockers

### 2.1 Native Node.js Dependencies

```
pdf-parse      → fs, Buffer (Node.js)
canvas         → C++ native addon (NO en Workers/Pages)
tesseract.js   → worker_threads, child_process
pdfjs-dist     → font loading vía fs (server-side)
```

**Impact:** Los 3 paths de carga de PDF (NATIVE upload, AI import, payslips upload) usan `extractPdfText()` que depende de `pdf-parse`. El OCR usa `canvas` + `tesseract.js`. Ninguno funciona en Cloudflare Workers.

### 2.2 Filesystem Storage

Todas las operaciones con `statement-pdf.ts` usan `fs` local:
- `saveStatementPdf()`
- `readStatementPdf()`
- `saveImportJobPdf()`
- `savePayslipPdf()`
- etc.

**Impact:** No hay disco persistente en Cloudflare Workers/Pages.

### 2.3 SQLite / Prisma

Prisma con SQLite requiere acceso a archivos local. D1 es la alternativa nativa de Cloudflare, pero Prisma no la soporta oficialmente (solo experimental con `@prisma/adapter-d1`).

---

## 3. Database Options

| Servicio | Free Tier | Prisma Support | Latencia desde CF |
|---|---|---|---|
| **Neon (PostgreSQL)** | 0.5GB, 100h compute/mes | ✅ Total | Baja (misma región) |
| **Supabase (PostgreSQL)** | 0.5GB, 50k rows | ✅ Total | Baja |
| **Turso (libsql)** | 9GB, 1B requests/mes | ✅ Parcial (desde 5.4.0) | Baja |
| **Cloudflare D1** | 5GB, 5M reads/día | ❌ Experimental | Nativa (0ms) |

**Recomendación:** Neon. Prisma tiene soporte completo, es el más usado con Next.js + CF, y su free tier alcanza.

### Cambios necesarios para Neon:

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Prisma + Edge:

Prisma NO corre en edge runtime (no soporta HTTP queries nativamente).
Hay que usar `@prisma/extension-accelerate` (plan gratis: 1M queries/mes) o
usar Neon's HTTP endpoint directamente.

**Opción A:** Usar `prisma` en Node.js runtime (restringe a rutas Node.js, no edge).
**Opción B:** Usar `@prisma/extension-accelerate` + proxy de Prisma (otro service).
**Opción C:** Reemplazar Prisma por Drizzle ORM (mejor soporte edge).

---

## 4. File Storage Strategy

Reemplazar `fs` local con **Cloudflare R2** (S3-compatible, free tier: 10GB, 10M writes, 1M reads).

**Migración (`statement-pdf.ts`):**

```
fs.writeFileSync(ruta, buffer)  →  await r2.put(key, buffer, { httpMetadata })
fs.readFileSync(ruta)            →  await r2.get(key).then(r => r.arrayBuffer())
```

Crear `src/lib/storage.ts` con wrapper:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});
```

**Buckets necesarios:**
- `bank-resumes-statements` → PDFs de resúmenes
- `bank-resumes-import-jobs` → PDFs de import jobs
- `bank-resumes-payslips` → PDFs e imágenes de recibos

---

## 5. PDF Parsing — Solución

El mayor problema. Opciones viables:

### 5.1 Reemplazar con parser Python (FastAPI)

El servicio en `parser/` ya existe y es compatible. Desplegarlo en:

- **Railway** (free tier: $5/mes gratis, 500h)
- **Fly.io** (free tier: 3 VMs always-on)
- **Render** (free tier: 750h/mes, duerme inactivo)

El web app llama a `PARSER_SERVICE_URL` vía HTTP (sin dependencias nativas).

### 5.2 Browser-side parsing con pdf.js

Usar pdf.js en el cliente (ya hay `public/pdf.worker.min.mjs`):
- Subir el PDF desde el browser
- Parsear en el cliente con pdf.js
- Enviar JSON parseado al servidor

Esto eliminaría `pdf-parse` y `canvas` del servidor por completo.
El OCR se puede hacer en el cliente también con `tesseract.js` en worker.

**Ventaja:** Mata todas las dependencias nativas del servidor de un golpe.

### 5.3 Cloudflare Workers con pdf.js

Usar pdf.js (pure JS) dentro de un Worker (sin `canvas`, sin `pdf-parse`).
Limitaciones: límite de 30ms CPU (gratis) o 30s (paid). PDFs de resúmenes
(3-10 páginas) pueden exceder el tiempo gratis.

### Recomendación

**Corto plazo:** Browser-side parsing con pdf.js (elimina nativas del server).
**Largo plazo:** Desplegar el parser Python en Railway/Fly para procesamiento server-side.

---

## 6. Background Jobs (Scheduled / Triggered)

### 6.1 Workers CRON Triggers

**Actualmente hay 2 jobs internos:**
- `POST /api/internal/import-jobs/process` → procesa cola de imports AI
- `POST /api/internal/notifications/process` → envía notificaciones pendientes

**Cloudflare Workers CRON (gratis: 100k requests/día):**

```toml
# wrangler.toml
name = "bank-resumes-worker"
main = "src/worker.ts"

[triggers]
crons = ["*/5 * * * *"]  # cada 5 minutos
```

```typescript
// src/worker.ts
export default {
  async scheduled(event, env, ctx) {
    const secret = env.WORKER_SHARED_SECRET;
    await fetch("https://miapp.pages.dev/api/internal/import-jobs/process", {
      headers: { "x-worker-secret": secret },
      method: "POST",
    });
    await fetch("https://miapp.pages.dev/api/internal/notifications/process", {
      headers: { "x-worker-secret": secret },
    });
  },
};
```

**Importante:** Si el procesamiento necesita PDF parsing nativo (>30ms CPU),
no puede correr en Workers gratis. Opciones:
- Usar **Workers Paid** (30s CPU por request)
- Que el trigger solo encola y un proceso externo (Python) hace el trabajo pesado
- Que el browser-side parsing ya entregue datos parseados, y el job solo persista

### 6.2 Queue (opcional)

Workers Queues (gratis: 1M operaciones/mes) para encolar tareas pesadas
y procesarlas secuencialmente sin timeout.

---

## 7. CI/CD Pipeline

### 7.1 GitHub Actions + Cloudflare Pages

```yaml
name: Deploy to Cloudflare
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: 📦 Install dependencies
        working-directory: web
        run: npm ci

      - name: 🗄️ Generate Prisma Client
        working-directory: web
        run: npx prisma generate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: 🚀 Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          workingDirectory: web
          command: pages deploy .next --project-name=bank-resumes
```

### 7.2 Environment Variables (secrets)

```
JWT_SECRET=<random-256bit-hex>
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb
DEEPSEEK_API_KEY=sk-...
PARSER_SERVICE_URL=https://parser-production.up.railway.app
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ACCOUNT_ID=...
WORKER_SHARED_SECRET=<random>
```

---

## 8. `@cloudflare/next-on-pages` Compatibility

### Lo que funciona:
- Páginas estáticas
- Server Components (sin node:fs)
- API routes que usen solo fetch + DB (no PDF/canvas/ocr)
- `next/headers`, `next/cookies`
- ISR (si se necesita)

### Lo que NO funciona:
- `serverExternalPackages: ["pdf-parse"]` → no hay `node_modules` en edge
- `canvas` → native addon
- `fs` operations
- `tesseract.js` → workers no disponibles

### Configuración necesaria en `next.config.mjs`:

```mjs
import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Eliminar serverExternalPackages — no aplica en edge
  // ...
};
export default nextConfig;
```

### Wrangler config:

```toml
# wrangler.toml
name = "bank-resumes"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"  # o ".next/server"

[build]
command = "npm run build"

[build.environment]
NODE_VERSION = "20"

[[d1_databases]]
binding = "DB"
database_name = "bank-resumes"
database_id = "<id>"
```

---

## 9. Deployment Architecture (Recomendada)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Cloudflare Pages (@cloudflare/next-on-pages)                       │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Páginas estáticas │  │ SSR Pages        │  │ API Routes       │  │
│  │ /dashboard        │  │ /projections     │  │ /api/transactions│  │
│  │ /login            │  │ /statements/[id] │  │ /api/categories  │  │
│  │ /upload           │  │ /payslips/[id]   │  │ /api/dashboard/* │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │                          │                │
         ▼                          ▼                ▼
  ┌──────────┐             ┌──────────────┐  ┌──────────────┐
  │ Neon     │             │ Cloudflare R2 │  │ DeepSeek API │
  │PostgreSQL│             │ (PDFs/imgs)   │  │ (AI parse)   │
  └──────────┘             └──────────────┘  └──────────────┘
         ▲                                        │
         │                                        ▼
  ┌──────────┐                            ┌──────────────┐
  │ Prisma   │                            │ Python Parser│
  │Accelerate│                            │ (Railway/Fly)│
  └──────────┘                            └──────────────┘

  Worker CRON (cada 5 min)
  ┌──────────────────────┐
  │ → /api/internal/*    │
  └──────────────────────┘
```

---

## 10. Migration Steps

### Fase 1 — Base de datos y storage (1-2 días)
1. Crear base de datos Neon (free tier)
2. Migrar schema: `datasource db { provider = "postgresql" }`
3. Ejecutar `prisma db push` contra Neon
4. Migrar datos de SQLite a PostgreSQL (`prisma migrate diff` + export/import)
5. Configurar Cloudflare R2 (3 buckets)
6. Reemplazar `fs` calls con R2 client (`src/lib/storage.ts`)

### Fase 2 — Cliente-side parsing (2-3 días)
1. Extraer `parseStatementBuffer()` usando pdf.js en el browser
2. El cliente sube PDF → parsea en browser → envía JSON al servidor
3. El servidor solo persiste (no necesita `pdf-parse` ni `canvas`)
4. Migrar OCR a browser-side tesseract.js (o eliminarlo temporalmente)

### Fase 3 — Cloudflare Pages (1-2 días)
1. Instalar `@cloudflare/next-on-pages`
2. Configurar `wrangler.toml`
3. Crear Workers CRON para background jobs
4. Configurar GitHub Actions deploy
5. Ajustar API routes para Node.js runtime donde sea necesario

### Fase 4 — Parser Python (opcional, 1 día)
1. Desplegar `parser/` en Railway/Fly.io
2. Configurar `PARSER_SERVICE_URL`
3. Actualizar upload path para usar servicio externo como fallback

---

## 11. Costo Mensual (Free Tier)

| Servicio | Free Tier Limits | Uso Estimado | ¿Alcanza? |
|---|---|---|---|
| Cloudflare Pages | Builds ilimitados, ancho de banda ilimitado | Bajo | ✅ |
| Workers (CRON) | 100k req/día | ~8,640 (cada 5 min) | ✅ |
| R2 | 10GB storage, 10M writes, 1M reads | < 1GB, < 10k writes | ✅ |
| Neon | 0.5GB, 100h compute/mes | Bajo (solo consultas) | ✅ ~25h/mes estimado |
| DeepSeek API | Pago por uso (muy barato) | ~50 requests/mes | ✅ < $1/mes |
| Railway (parser) | $5/mes gratis (500h) | 720h/mes (24/7) | ❌ Necesita tier pago |

**Total free:** $0/mes si el parser se corre en browser.
**Con parser Python:** ~$5-7/mes (Railway Hobby o Fly.io).

---

## 12. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Prisma + Edge no es 100% estable | Database queries lentas o rotas | Usar Node.js runtime en APIs; Prisma Accelerate como proxy |
| @cloudflare/next-on-pages no soporta Next 16 | No se puede deployar | Probar con Next 15; si no funciona, separar frontend (estático) y API (Workers independientes) |
| OCR/tesseract.js no migra | Sin OCR para PDFs escaneados | Usar Python parser externo que sí hace OCR; o pedir al usuario que suba resúmenes con texto seleccionable |
| Límite de CPU en Workers (30ms gratis) | Gateways de PDF pesados fallan | Browser-side parsing (el tiempo corre en el cliente); Workers solo para persistencia |
| Neon free tier duerme después de inactividad | Primera query del día lenta (~5s) | Usar cron pinging cada 15 min; o considerar Supabase (sin sleep gratis) |

---

## 13. Alternativa Simplificada (Recomendada)

Si el objetivo es hosting gratuito de inmediato, separar responsabilidades:

```
Frontend:     Cloudflare Pages (estático + React SPA)
API:          Node.js en Railway / Fly.io (libre de dependencias nativas)
DB:           Neon (PostgreSQL)
Storage:      R2
PDF Parsing:  Browser-side con pdf.js
```

El frontend (React/Next.js) se construye estáticamente y se sirve desde CF Pages.
Los API routes corren en un servidor Node.js tradicional en Railway.
Esto evita toda la complejidad de `@cloudflare/next-on-pages` y sus limitaciones.

**Si se quiere Next.js completo (SSR + API):** Usar Railway o Fly.io para todo,
saltando Cloudflare para el servidor. Cloudflare solo para dominio + CDN + R2.
