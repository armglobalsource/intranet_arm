# Intranet ARM

Stack: **NestJS** (backend) · **Next.js 14** (frontend) · **Firestore** · **Google Cloud Storage** · **Firebase Hosting + Cloud Run**

Migración a Supabase en preparación: ver [alcance, herramientas y criterios de validación](docs/migracion-supabase.md). La aplicación todavía utiliza Firestore.

Conexión PostgreSQL preparada: copiar `backend/supabase.env.example` a `backend/.env.supabase`, completar `DATABASE_URL` y ejecutar `npm run db:check` desde `backend`. Este chequeo es de solo lectura y no cambia la base usada por los servicios actuales.

---

## Desarrollo local — Guía de configuración

### Requisitos previos

| Herramienta | Versión mínima | Verificar con |
|-------------|---------------|---------------|
| Node.js | 20 LTS | `node -v` |
| npm | 10+ | `npm -v` |
| Acceso al proyecto Firebase | — | (ver sección abajo) |

> No se necesita Docker para desarrollo local. El backend se conecta directamente a Firestore en la nube (ambiente `dev`).

---

### 1. Acceso al proyecto Firebase de desarrollo

El backend usa **Firebase Admin SDK** con una Service Account para autenticarse contra Firestore y Cloud Storage. Necesitas obtener el archivo de credenciales del proyecto `intranet-arm-dev-70a30`.

#### 1.1 Solicitar acceso al proyecto Firebase

Pide a un administrador del equipo que te agregue al proyecto Firebase con rol **Editor** o **Viewer**:

- Proyecto: `intranet-arm-dev-70a30`
- Consola: [console.firebase.google.com](https://console.firebase.google.com)

#### 1.2 Generar la Service Account key

Una vez que tengas acceso al proyecto Firebase:

1. Ve a **Firebase Console** → Proyecto `intranet-arm-dev` → Engranaje (⚙️) → **Configuración del proyecto**
2. Pestaña **Cuentas de servicio**
3. Selecciona **Node.js** y haz clic en **Generar nueva clave privada**
4. Descarga el archivo JSON y renómbralo a `service-account.json`
5. Coloca ese archivo en `backend/service-account.json`

> **Importante:** `service-account.json` está en `.gitignore`. Nunca lo subas al repositorio.

---

### 2. Clonar el repositorio

```bash
git clone <url-del-repo>
cd intranet_arm
```

---

### 3. Configurar el backend (NestJS)

```bash
cd backend
```

#### 3.1 Crear el archivo de entorno

Crea el archivo `backend/.env` con el siguiente contenido:

```env
NODE_ENV=development
PORT=3001

# Firebase / Firestore
FIREBASE_PROJECT_ID=intranet-arm-dev-70a30
FIREBASE_KEY_FILE=./service-account.json

# JWT — cambia estos valores por algo seguro (mínimo 32 caracteres)
JWT_SECRET=cambia_esto_por_un_secreto_seguro_de_al_menos_32_chars
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=28800

# Storage — usa "gcs" para Google Cloud Storage o "local" para disco local
STORAGE=gcs
GCS_PROJECT_ID=intranet-arm-dev-70a30
GCS_BUCKET_DOCUMENTS=intranet-arm-dev-70a30.firebasestorage.app
GCS_BUCKET_AVATARS=intranet-arm-dev-70a30.firebasestorage.app
GCS_KEY_FILE=./service-account.json

# URLs
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Email — puedes dejarlo con valores falsos si no vas a probar emails
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=no-reply@empresa.com
SMTP_PASS=placeholder
EMAIL_FROM="Intranet ARM <no-reply@empresa.com>"

# Rate limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
AUTH_THROTTLE_LIMIT=5
```

#### 3.2 Instalar dependencias e iniciar

```bash
npm install
npm run start:dev   # servidor en http://localhost:3001
```

Swagger disponible en: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

---

### 4. Configurar el frontend (Next.js)

```bash
cd frontend
npm install
npm run dev         # servidor en http://localhost:3000
```

El frontend apunta automáticamente a `http://localhost:3001/api/v1` cuando `NODE_ENV=development`. No requiere archivo `.env` para funcionar en local.

Si necesitas apuntar a una URL diferente, crea `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

### 5. Verificar que todo funciona

Con ambos servidores corriendo:

1. Abre [http://localhost:3000](http://localhost:3000)
2. Inicia sesión con las credenciales de un usuario existente en Firestore (dev)
3. El backend debe conectarse a Firestore sin errores — revisa la consola del backend al iniciar

Si el backend muestra un error de credenciales Firebase, verifica que `backend/service-account.json` existe y que `FIREBASE_KEY_FILE=./service-account.json` está correctamente en tu `.env`.

---

## Estructura del proyecto

```
intranet_arm/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── auth/               # JWT, refresh tokens, estrategias Passport
│   │   ├── users/              # Perfiles y directorio
│   │   ├── content/            # CMS básico
│   │   ├── documents/          # Gestión documental
│   │   ├── orgchart/           # Organigrama
│   │   ├── notifications/      # Notificaciones in-app y email
│   │   ├── search/             # Búsqueda global
│   │   ├── roles/              # Control de acceso por roles
│   │   ├── campus/             # Gestión de campus
│   │   ├── job-titles/         # Títulos de puesto
│   │   ├── health/             # Health check endpoint
│   │   └── common/
│   │       ├── firebase/       # FirebaseService (Firestore)
│   │       └── storage/        # Google Cloud Storage
│   ├── service-account.json    # (local, no commitear — ver paso 1.2)
│   └── .env                    # (local, no commitear — ver paso 3.1)
├── frontend/                   # Next.js 14 App Router
│   └── src/
│       ├── app/                # Páginas (App Router)
│       ├── components/         # Componentes UI reutilizables
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # API client (axios), Zustand store
│       └── types/              # TypeScript types
├── firebase.json               # Firebase Hosting config (2 sitios: dev y prod)
├── .firebaserc                 # Proyecto Firebase por defecto
└── cloudbuild.yaml             # CI/CD — Google Cloud Build
```

---

## Ambientes

| Ambiente | URL | Proyecto Firebase | Backend |
|----------|-----|-------------------|---------|
| Desarrollo | [intranet-arm-dev.web.app](https://intranet-arm-dev.web.app) | `intranet-arm-dev-70a30` | Cloud Run `intranet-backend-dev` |
| Producción | [intranet-arm.web.app](https://intranet-arm.web.app) | `intranet-arm` | Cloud Run `intranet-backend` |

---

## Despliegue

El despliegue se realiza automáticamente vía **Google Cloud Build** al hacer push a las ramas configuradas. Ver `cloudbuild.yaml` para la configuración del pipeline.

Para desplegar manualmente:

```bash
# Frontend
cd frontend && npm run build
firebase deploy --only hosting:intranet-arm

# Backend — se despliega como imagen Docker en Cloud Run
# (ver cloudbuild.yaml para el proceso completo)
```
