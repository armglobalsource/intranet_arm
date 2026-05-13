#!/usr/bin/env bash
# deploy.sh — Despliega Intranet ARM en Firebase / Google Cloud Platform
#
# Uso:
#   ./deploy.sh                     # usa el proyecto por defecto (.firebaserc)
#   GCP_PROJECT=mi-proyecto ./deploy.sh
#
# Requisitos previos:
#   - gcloud CLI instalado y autenticado (gcloud auth login)
#   - firebase CLI instalado (npm i -g firebase-tools) y autenticado (firebase login)
#   - Docker instalado
#   - Artifact Registry creado: us-central1-docker.pkg.dev/$GCP_PROJECT/intranet

set -euo pipefail

GCP_PROJECT="${GCP_PROJECT:-intranet-arm}"
REGION="${REGION:-us-central1}"
REGISTRY="${REGION}-docker.pkg.dev/${GCP_PROJECT}/intranet"
CLOUD_SQL_INSTANCE="${GCP_PROJECT}:${REGION}:intranet-db"

echo "=== Intranet ARM — Deploy a Firebase / GCP ==="
echo "Proyecto: $GCP_PROJECT | Región: $REGION"
echo ""

# ── 1. Configurar Docker para Artifact Registry ───────────────
echo "[1/5] Configurando autenticación Docker con Artifact Registry..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ── 2. Build y push del backend ───────────────────────────────
echo "[2/5] Build y push del backend..."
docker build \
  --platform linux/amd64 \
  -t "${REGISTRY}/backend:latest" \
  ./backend

docker push "${REGISTRY}/backend:latest"

# ── 3. Build y push del frontend ─────────────────────────────
echo "[3/5] Build y push del frontend..."
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL="https://${GCP_PROJECT}.web.app/api/v1" \
  -t "${REGISTRY}/frontend:latest" \
  ./frontend

docker push "${REGISTRY}/frontend:latest"

# ── 4. Deploy a Cloud Run ─────────────────────────────────────
echo "[4/5] Desplegando servicios en Cloud Run..."

# Backend
gcloud run deploy intranet-backend \
  --image "${REGISTRY}/backend:latest" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances "${CLOUD_SQL_INSTANCE}" \
  --set-env-vars "NODE_ENV=production,PORT=3001" \
  --set-secrets "DATABASE_URL=intranet-db-url:latest,DIRECT_URL=intranet-db-url:latest,JWT_SECRET=intranet-jwt-secret:latest,GCS_PROJECT_ID=intranet-gcs-project:latest,GCS_BUCKET_DOCUMENTS=intranet-gcs-bucket-docs:latest,GCS_BUCKET_AVATARS=intranet-gcs-bucket-avatars:latest,FRONTEND_URL=intranet-frontend-url:latest,SMTP_HOST=intranet-smtp-host:latest,SMTP_PORT=intranet-smtp-port:latest,SMTP_USER=intranet-smtp-user:latest,SMTP_PASS=intranet-smtp-pass:latest,EMAIL_FROM=intranet-email-from:latest" \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60 \
  --port 3001 \
  --quiet

# Frontend
gcloud run deploy intranet-frontend \
  --image "${REGISTRY}/frontend:latest" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,PORT=3000" \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60 \
  --port 3000 \
  --quiet

# ── 5. Deploy Firebase Hosting ────────────────────────────────
echo "[5/5] Desplegando Firebase Hosting (rewrites)..."
firebase deploy --only hosting --project "${GCP_PROJECT}"

echo ""
echo "=== Deploy completado ==="
echo "URL: https://${GCP_PROJECT}.web.app"
