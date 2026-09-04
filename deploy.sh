#!/usr/bin/env bash
#
# Despliegue de "comisiones-web" en producción (mismo método que diligencias).
# Se ejecuta EN EL SERVIDOR, dentro del directorio del repo:
#     ./deploy.sh
#
# Actualiza el código desde origin/master, reinstala dependencias solo si
# cambiaron, y reinicia el proceso de PM2. NO toca la base de datos de
# producción (comisiones.sqlite) ni el archivo .env.

set -euo pipefail

APP_NAME="comisiones"
BRANCH="master"

cd "$(dirname "$0")"

# Este guion tiene FIJOS el proceso "comisiones" y la rama master, así que
# corrido desde otra carpeta reiniciaría la instancia en operación e intentaría
# traerle master a una instancia que sigue otra rama. Como las instancias
# alternas clonan el repo completo, ambos guiones quedan uno junto al otro y el
# error es fácil de cometer; de ahí la comprobación.
if [ "$(basename "$(pwd)")" != "comisiones-web" ]; then
  echo "✖ Éste es el despliegue de la instancia en operación (proceso"
  echo "  '$APP_NAME', rama $BRANCH), y estás en $(pwd)."
  echo "  Para una instancia alterna usa:  ./deploy-alterna.sh"
  exit 1
fi

command -v git >/dev/null || { echo "✖ git no está instalado"; exit 1; }
command -v pm2 >/dev/null || { echo "✖ pm2 no está instalado"; exit 1; }

echo "==> Protegiendo datos de producción..."
for f in comisiones.sqlite .env; do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    git update-index --skip-worktree "$f" 2>/dev/null || true
    echo "    · protegido: $f"
  fi
done

echo "==> Descargando cambios de origin/$BRANCH..."
git fetch origin "$BRANCH"
BEFORE="$(git rev-parse HEAD)"
git merge --ff-only "origin/$BRANCH"
AFTER="$(git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "==> Sin cambios nuevos (ya estaba en ${AFTER:0:7})."
else
  echo "==> Código actualizado: ${BEFORE:0:7} -> ${AFTER:0:7}"
fi

if [ "$BEFORE" != "$AFTER" ] && \
   git diff --name-only "$BEFORE" "$AFTER" | grep -qE 'package(-lock)?\.json'; then
  echo "==> Cambiaron dependencias, instalando..."
  npm ci --omit=dev || npm install --omit=dev
else
  echo "==> Sin cambios en dependencias, se omite npm install."
fi

echo "==> Reiniciando PM2 ($APP_NAME)..."
pm2 restart "$APP_NAME" --update-env

echo "✔ Despliegue completado."
