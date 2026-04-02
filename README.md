# BankResume

Gestor de resúmenes de tarjetas de crédito argentinas. Importá PDFs de **BBVA** y **Banco Galicia**, visualizá tus gastos y analizá comisiones e impuestos desde un dashboard moderno.

## Funcionalidades

- **Importación de PDFs** — drag & drop, detección automática del banco
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
└── parser/     # FastAPI · pdfplumber · Python 3.11
```

El frontend llama al servicio Python para parsear los PDFs y luego almacena los datos en la base de datos vía Prisma.

## Requisitos

- **Node.js** 18+
- **Python** 3.10+ (para el parser)

## Instalación y ejecución local

### 1. Clonar el repositorio

```bash
git clone https://github.com/tagoncalves/bank-resumes.git
cd bank-resumes
```

### 2. Configurar y levantar el parser Python

```bash
cd parser

# Crear entorno virtual e instalar dependencias (solo la primera vez)
setup.bat          # Windows
# o manualmente:
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Levantar el servicio (puerto 8001)
start.bat
# o: uvicorn main:app --port 8001 --reload
```

### 3. Configurar y levantar la web

```bash
cd web
npm install

# Crear la base de datos y cargar categorías (solo la primera vez)
set DATABASE_URL=file:./prisma/dev.db
npx prisma db push
npx prisma db seed

# Levantar el servidor de desarrollo (puerto 3000)
set DATABASE_URL=file:./prisma/dev.db
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) en el navegador.

> **Scripts de conveniencia:** `start-web.bat` y `start-parser.bat` en la raíz del proyecto automatizan los pasos anteriores.

## Variables de entorno

### `web/.env.local`

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | URL de la base de datos | `file:./prisma/dev.db` (local) · `postgresql://...` (producción) |
| `PARSER_SERVICE_URL` | URL del servicio Python | `http://localhost:8001` (local) · URL de Railway (producción) |

## Deploy en producción

La app usa dos servicios separados:

### Web → Vercel

1. Cambiá el provider en `web/prisma/schema.prisma` de `sqlite` a `postgresql`
2. Importá el repo en [vercel.com](https://vercel.com) con **Root Directory: `web`**
3. Configurá las variables de entorno:
   - `DATABASE_URL` → connection string de [Neon](https://neon.tech) (PostgreSQL gratuito)
   - `PARSER_SERVICE_URL` → URL pública del parser en Railway
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
| Parser PDF | FastAPI + pdfplumber (Python) |
| Íconos | Lucide React |

## Bancos soportados

| Banco | Estado |
|---|---|
| BBVA Argentina (Visa Gold) | ✅ Soportado |
| Banco Galicia (Visa) | ✅ Soportado (multi-tarjeta) |

Para agregar soporte a otro banco, extendé `BaseStatementParser` en `parser/parsers/`.
