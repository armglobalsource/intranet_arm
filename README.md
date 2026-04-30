# Intranet Corporativa — MVP

Stack: **NestJS** (backend) · **Next.js 14** (frontend) · **PostgreSQL 15** · **MinIO** · **Docker Compose**

---

## Inicio rápido (desarrollo local)

### 1. Requisitos previos
- Node.js 20 LTS
- Docker Desktop
- VS Code (recomendado)

### 2. Levantar infraestructura (DB + MinIO)

```bash
docker compose -f docker-compose.dev.yml up -d
```

Servicios disponibles:
- PostgreSQL → `localhost:5432`
- MinIO API  → `localhost:9000`
- MinIO UI   → http://localhost:9001  (user: `minio_access_key` / pass: `minio_secret_key`)

### 3. Backend

```bash
cd backend
cp .env.example .env        # ajusta las variables si es necesario
npm install
npx prisma migrate dev      # aplica migraciones y genera el cliente Prisma
npm run start:dev           # servidor en http://localhost:3001
```

Swagger disponible en: http://localhost:3001/api/docs

### 4. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # servidor en http://localhost:3000
```

---

## Credenciales iniciales

| Campo    | Valor                |
|----------|----------------------|
| Email    | admin@empresa.com    |
| Password | Admin1234!           |

> **Cambia la contraseña en el primer inicio de sesión.**

---

## Estructura del proyecto

```
intranet/
├── backend/                  # NestJS API
│   ├── prisma/
│   │   └── schema.prisma     # Modelo de datos
│   └── src/
│       ├── auth/             # JWT, refresh tokens, revocación
│       ├── users/            # Perfiles y directorio
│       ├── content/          # CMS básico
│       ├── documents/        # Gestión documental
│       ├── orgchart/         # Organigrama
│       ├── notifications/    # Notificaciones in-app y email
│       ├── search/           # Búsqueda global full-text
│       ├── jobs/             # Cola asíncrona (pg-boss)
│       ├── health/           # Health check endpoint
│       └── common/           # Prisma, Storage, decorators, guards
├── frontend/                 # Next.js 14 App Router
│   └── src/
│       ├── app/              # Páginas (App Router)
│       ├── components/       # Layout, UI compartidos
│       └── lib/              # API client, Zustand store
├── nginx/                    # Reverse proxy + TLS
├── schema.sql                # Schema SQL completo con seed
├── docker-compose.yml        # Stack completo (producción)
├── docker-compose.dev.yml    # Solo infra (desarrollo local)
└── .env.example              # Variables de entorno requeridas
```

---

## Despliegue en producción

```bash
cp .env.example .env
# Edita .env con valores reales (especialmente JWT_SECRET, passwords, SMTP)
# Coloca los certificados TLS en nginx/certs/fullchain.pem y privkey.pem

docker compose up -d --build
```

---

## Scripts útiles

```bash
# Ver logs del backend
docker compose logs -f backend

# Abrir Prisma Studio (explorador de BD)
cd backend && npx prisma studio

# Ejecutar migraciones en producción
cd backend && npx prisma migrate deploy

# Conectar a PostgreSQL directamente
docker exec -it intranet_postgres psql -U intranet_user -d intranet_db
```
