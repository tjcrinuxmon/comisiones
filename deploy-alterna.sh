#!/usr/bin/env bash
#
# Actualización de una instancia ALTERNA de la Matriz de Comisiones.
# Se ejecuta EN EL SERVIDOR, dentro del directorio de esa instancia:
#
#     ./deploy-alterna.sh
#
# Trae los cambios de la rama que la instancia sigue, reinstala dependencias
# sólo si cambiaron y reinicia su proceso de PM2. NO toca la base de datos
# (comisiones.sqlite) ni el .env.
#
# Es DISTINTO de deploy.sh a propósito: aquél está fijo en el proceso
# "comisiones" y la rama master —la instancia de producción— y no debe cambiar.
# Éste toma ambos de la instalación misma, así que la misma copia del guion
# sirve para cualquier instancia alterna sin editarlo:
#
#   · proceso : APP_NAME del .env, o el nombre de la carpeta
#   · rama    : la que tenga activa el repo
#
# Si algo sale mal, se detiene y lo dice: nunca deja la instancia a medias sin
# avisar.

set -euo pipefail

cd "$(dirname "$0")"

command -v git >/dev/null || { echo "✖ git no está instalado"; exit 1; }
command -v pm2 >/dev/null || { echo "✖ pm2 no está instalado"; exit 1; }
command -v curl >/dev/null || { echo "✖ curl no está instalado"; exit 1; }

# --- De qué instancia se trata ------------------------------------------------
[ -f .env ] && { set -a; . ./.env; set +a; }
APP_NAME="${APP_NAME:-$(basename "$(pwd)")}"
if [ -z "${PORT:-}" ]; then
  echo "✖ No se pudo leer PORT del .env de esta instancia."
  echo "   Sin él, la comprobación final apuntaría al puerto de la instancia"
  echo "   en operación y daría por bueno un despliegue que quizá ni arrancó."
  exit 1
fi
PUERTO="$PORT"
# --show-current existe desde git 2.22; en servidores viejos se usa el respaldo.
BRANCH="$(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD)"
[ -n "$BRANCH" ] || { echo "✖ El repo no está en una rama, sino en un commit suelto."; exit 1; }

echo "==> Instancia: $APP_NAME · rama: $BRANCH · puerto: $PUERTO"

if [ "$APP_NAME" = "comisiones" ]; then
  echo "✖ Ésta es la instancia de producción. Para actualizarla usa ./deploy.sh"
  exit 1
fi

pm2 describe "$APP_NAME" >/dev/null 2>&1 || {
  echo "✖ No existe el proceso de PM2 '$APP_NAME'."
  echo "   Si es una instalación nueva, usa instalar.sh."
  exit 1
}

# --- Proteger los datos de esta instancia -------------------------------------
echo "==> Protegiendo datos..."
for f in comisiones.sqlite .env; do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    git update-index --skip-worktree "$f" 2>/dev/null || true
    echo "    · protegido: $f"
  fi
done

# Editar a mano un archivo versionado rompe el merge --ff-only y deja la
# instancia sin poder actualizarse nunca más. Se detiene aquí, con el motivo.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "✖ Hay cambios locales en archivos versionados:"
  git status --short | grep -v '^??' || true
  echo "   Reviértelos (git checkout -- <archivo>) antes de actualizar."
  echo "   La configuración va en el .env, no editando el código en el servidor."
  exit 1
fi

# --- Traer los cambios --------------------------------------------------------
echo "==> Descargando cambios de origin/$BRANCH..."
git fetch origin "$BRANCH"
BEFORE="$(git rev-parse HEAD)"

if ! git merge --ff-only "origin/$BRANCH"; then
  echo "✖ No se pudo avanzar sin mezclar: esta instancia tiene commits propios."
  echo "   Revísalo antes de forzar nada:"
  echo "       git log --oneline HEAD ^origin/$BRANCH"
  exit 1
fi
AFTER="$(git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "==> Sin cambios nuevos (ya estaba en ${AFTER:0:7})."
else
  echo "==> Código actualizado: ${BEFORE:0:7} -> ${AFTER:0:7}"
  git log --oneline "$BEFORE".."$AFTER" | sed 's/^/    · /'
fi

# --- Dependencias, sólo si cambiaron ------------------------------------------
if [ "$BEFORE" != "$AFTER" ] && \
   git diff --name-only "$BEFORE" "$AFTER" | grep -qE 'package(-lock)?\.json'; then
  echo "==> Cambiaron dependencias, instalando..."
  npm ci --omit=dev || npm install --omit=dev
else
  echo "==> Sin cambios en dependencias, se omite npm install."
fi

# --- Reiniciar y comprobar que quedó viva -------------------------------------
echo "==> Reiniciando PM2 ($APP_NAME)..."
pm2 restart "$APP_NAME" --update-env

sleep 2
CODIGO="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PUERTO/" || true)"
if [ "$CODIGO" = "200" ]; then
  echo "✔ Listo · $APP_NAME responde en el $PUERTO (${AFTER:0:7})"
else
  echo "⚠ Se desplegó, pero la instancia no respondió (HTTP ${CODIGO:-sin respuesta})."
  echo "   Revisa:  pm2 logs $APP_NAME --lines 40"
  exit 1
fi
