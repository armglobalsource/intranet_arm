# Ecosistema ARM

Stack: **Next.js 14** (frontend) · **NestJS** (API) · **PostgreSQL y Storage en Supabase** · **Vercel**

Un solo proyecto Vercel, `intranet_arm` (raíz `frontend`), sirve la web y la API en
`/api/v1` desde el mismo dominio: https://ecosistema.armglobal.org. Detalles de la
arquitectura y del despliegue en [docs/vercel-supabase.md](docs/vercel-supabase.md).

---

## Desarrollo local

### Requisitos

| Herramienta | Versión mínima | Verificar con |
|-------------|---------------|---------------|
| Node.js | 20 LTS | `node -v` |
| npm | 10+ | `npm -v` |
| Acceso al proyecto Supabase `ecosistema_arm` | — | pedir a un administrador |

### 1. Backend (NestJS)

```bash
cd backend
cp supabase.env.example .env.supabase
```

Completa `backend/.env.supabase`:

- `DATABASE_URL`: cadena de conexión de Supabase (Connect). Usa el rol de la
  aplicación, nunca `postgres`.
- `JWT_SECRET`: secreto aleatorio de al menos 32 caracteres.
- Para guardar archivos en disco local en vez de Supabase Storage, usa
  `STORAGE=local` y deja vacías las variables `SUPABASE_*`.
- `BACKEND_URL=http://localhost:3001` y `FRONTEND_URL=http://localhost:3000`.

```bash
npm install
npm run db:check    # prueba de solo lectura de la conexión
npm run start:dev   # API en http://localhost:3001 (Swagger en /api/docs)
```

`.env.supabase` está en `.gitignore`. Nunca lo subas al repositorio.

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev         # http://localhost:3000
```

En desarrollo el frontend llama a `http://localhost:3001/api/v1`. Para otra URL,
crea `frontend/.env.local` con `NEXT_PUBLIC_API_URL=...`.

### 3. Pruebas

```bash
cd backend && npm test                       # unitarias
cd backend && npm run test:postgres:domains  # integración contra la base (con rollback)
cd frontend && npm test
```

---

## Estructura

```
intranet_arm/
├── backend/                 # API NestJS (PostgreSQL vía pg, Storage vía Supabase)
│   ├── src/
│   │   ├── app-factory.ts   # Configuración de Nest (la usan main.ts y Vercel)
│   │   ├── auth/ users/ roles/ fichas/ orgchart/ ...   # Un módulo por dominio
│   │   └── common/
│   │       ├── database/    # Pool PostgreSQL y esquema requerido
│   │       └── storage/     # Supabase Storage (o disco local en desarrollo)
│   └── scripts/             # Pruebas de integración y herramientas de base de datos
├── frontend/                # Next.js 14 App Router
│   └── src/
│       ├── app/             # Páginas
│       ├── pages/api/v1/    # Punto de entrada de la API en Vercel
│       ├── components/ hooks/ lib/ types/
├── docs/                    # Arquitectura, migración y estado
└── .vercelignore            # Solo sube frontend y backend, sin secretos
```

---

## Despliegue

Cada push a `main` despliega Production en Vercel. Para desplegar desde tu equipo,
desde la raíz del repositorio (vinculada a `intranet_arm`):

```bash
vercel deploy --prod
```

Las variables de entorno viven en Vercel (`intranet_arm`, Production y Preview):
`DATABASE_URL` (Transaction pooler, rol de la aplicación), `JWT_SECRET`,
`STORAGE=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_BUCKET_PUBLIC`,
`SUPABASE_BUCKET_DOCUMENTS` y `FRONTEND_URL`. No definir `NEXT_PUBLIC_API_URL`.
