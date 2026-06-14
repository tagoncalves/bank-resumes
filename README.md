# BankResume

Gestor de resúmenes de tarjetas de crédito argentinas. Importá PDFs de **BBVA** y **Banco Galicia**, visualizá tus gastos y analizá comisiones e impuestos desde un dashboard moderno.

También soporta un flujo de fallback con AI para bancos no mapeados, usando DeepSeek si está configurado.

## Funcionalidades

- **Importación de PDFs** — drag & drop, detección automática del banco
- **Fallback AI para bancos no mapeados** — análisis asistido con DeepSeek, creación del banco y validación básica de consistencia
- **Dashboard** — saldo total, tendencia mensual, gastos por categoría, top comercios, breakdown de comisiones e impuestos argentinos (sello, IVA, IIBB)
- **Resúmenes** — detalle contable completo con tasas (TNA/TEM/TEA) y estado de cuenta
- **Movimientos** — tabla buscable y filtrable de todas las transacciones
- **Categorización automática** — Alimentación, Supermercado, Combustible, Entretenimiento, Tecnología, Salud, Ropa/Moda, Delivery, Viajes, Transporte, Suscripciones
- **Multi-tarjeta** — soporte para cuentas con dos tarjetas físicas (Galicia)
- **Multi-moneda** — ARS + USD en paralelo

## Arquitectura

```
bank-resumes/
├── web/        # Next.js 14 · TypeScript · Tailwind · Prisma · SQLite/PostgreSQL
├── parser/     # FastAPI · pdfplumber · Python 3.11
└── scripts/    # Orquestación raíz con Node.js
```

Flujo real actual:

1. La subida entra por `web/src/app/api/statements/upload/route.ts`.
2. La app intenta parsear localmente en `web/src/lib/pdf-parser` para bancos soportados.
3. Si el banco no está mapeado y DeepSeek está configurado, corre un análisis AI sobre el texto del PDF.
4. A partir de esa salida, crea el banco, la tarjeta, el resumen y los movimientos.
5. Guarda el método de importación y el resultado de consistencia en la base.

El servicio Python `parser/` sigue existiendo como sidecar del proyecto y se levanta con los comandos raíz para mantener el stack completo disponible, pero hoy el camino activo de importación vive principalmente en `web/`.

## Requisitos

- **Node.js** 18+
- **Python** 3.10+ (para el parser)
- **npm**

## Comandos raíz

Todos los comandos se ejecutan desde la raíz del repo:

```bash
npm run doctor
npm run setup
npm run dev
```

Scripts principales:

| Comando | Qué hace |
|---|---|
| `npm run doctor` | valida Node, npm, Python, puertos y prerequisitos locales |
| `npm run setup` | prepara parser + web + base local |
| `npm run setup:parser` | crea `.venv` e instala dependencias Python |
| `npm run setup:web` | instala dependencias web, `db:push` y `db:seed` |
| `npm run reset:db` | reinicia la SQLite local y vuelve a seedear |
| `npm run dev` | levanta parser con recarga y web en desarrollo |
| `npm run prod` | build de web + parser + web en modo producción |
| `npm run dev:worker` | levanta el worker que consume la cola AI |

También quedaron scripts `dev:sh` y `prod:sh` para entornos con `sh`, pero el camino principal y recomendado es el orquestador Node de la raíz.

## Instalación y ejecución local

### 1. Clonar el repositorio

```bash
git clone https://github.com/tagoncalves/bank-resumes.git
cd bank-resumes
```

### 2. Diagnóstico inicial

```bash
npm run doctor
```

Si `doctor` marca que falta Python, instalalo antes de seguir.

### 3. Setup completo

```bash
npm run setup
```

### 4. Levantar el proyecto completo

```bash
npm run dev
```

Esto levanta:

- parser Python en `http://localhost:8001`
- web Next.js en `http://localhost:3000`
- worker AI que consume `ImportJob` en background

Abrí [http://localhost:3000](http://localhost:3000) en el navegador.

## Ejecución parcial

Si necesitás correr solo una parte:

```bash
npm run dev:web
npm run dev:parser
```

## Variables de entorno

Las variables pueden definirse en la sesión, en `web/.env.local` o en el entorno del deploy.

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | URL de la base de datos | `file:./prisma/dev.db` (local) · `postgresql://...` (producción) |
| `PARSER_SERVICE_URL` | URL del servicio Python | `http://localhost:8001` (local) · URL de Railway (producción) |
| `JWT_SECRET` | secreto JWT para autenticación | `super-secret-local` |
| `DEEPSEEK_API_KEY` | API key para fallback AI | `sk-...` |
| `DEEPSEEK_BASE_URL` | endpoint OpenAI-compatible del proveedor | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | identificador de modelo DeepSeek | el ID del modelo DeepSeek V4 o equivalente gratuito de tu proveedor |

### Fallback AI para bancos no soportados

Si `DEEPSEEK_API_KEY` está configurado:

1. se extrae el texto del PDF
2. si el banco no está soportado, se crea un job de importación AI y la UI entra en modo `analizando/procesando`
3. DeepSeek propone el mapeo estructurado
4. se crea el banco si no existe
5. se persisten tarjeta, resumen y movimientos
6. se ejecutan controles básicos de consistencia
7. el resumen queda marcado como:
   - `COMPLETED` si la consistencia es razonable
   - `REVIEW_REQUIRED` si hay desvíos que conviene revisar

Si DeepSeek no está configurado, un banco no soportado devuelve un error claro indicando que falta la integración AI.

### Cola AI persistida

El procesamiento AI ahora corre mediante una cola persistida en `ImportJob`:

1. `upload` crea un job `QUEUED`
2. el worker consume la cola y pasa a `ANALYZING`
3. al terminar deja el job en `COMPLETED`, `REVIEW_REQUIRED` o `FAILED`
4. la UI hace polling del estado del job
5. admin puede aprobar, rechazar o reprocesar

## Deploy en producción

La app usa dos servicios separados:

### Web → Vercel

1. Cambiá el provider en `web/prisma/schema.prisma` de `sqlite` a `postgresql`
2. Importá el repo en [vercel.com](https://vercel.com) con **Root Directory: `web`**
3. Configurá las variables de entorno:
   - `DATABASE_URL` → connection string de [Neon](https://neon.tech) (PostgreSQL gratuito)
   - `PARSER_SERVICE_URL` → URL pública del parser en Railway
   - `JWT_SECRET` → secreto fuerte
   - `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` si querés habilitar fallback AI en producción
4. Ejecutá una vez para inicializar la DB:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma db push
   DATABASE_URL="postgresql://..." npx prisma db seed
   ```

### Parser → Railway

1. Importá el repo en [railway.app](https://railway.app) con **Root Directory: `parser`**
2. Railway detecta el `Dockerfile` automáticamente
3. Generá un dominio público desde **Settings → Networking**

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework web | Next.js 14 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS |
| Componentes | shadcn/ui (manual) |
| Gráficos | Recharts |
| ORM | Prisma 5 |
| Base de datos | SQLite (local) · PostgreSQL (producción) |
| Parser nativo | TypeScript + pdf-parse |
| Parser sidecar | FastAPI + pdfplumber (Python) |
| Fallback AI | DeepSeek (OpenAI-compatible API) |
| Íconos | Lucide React |

## Bancos soportados

| Banco | Estado |
|---|---|
| BBVA Argentina (Visa Gold) | ✅ Soportado |
| Banco Galicia (Visa) | ✅ Soportado (multi-tarjeta) |
| Otros bancos | ⚠️ Vía fallback AI si DeepSeek está configurado |

Para soporte nativo de nuevos bancos, extendé el parser de `web/src/lib/pdf-parser/` y, si querés mantener paridad, también `parser/parsers/`.
