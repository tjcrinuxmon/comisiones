#!/usr/bin/env bash
#
# Instalación de una instancia de la Matriz de Comisiones.
# Se ejecuta UNA SOLA VEZ, en el servidor, desde el directorio padre:
#
#     ./instalar.sh <carpeta> <puerto> <rama> [ruta-de-la-base-a-copiar]
#
# Ejemplo — versión alterna (vista de contenedores) en el 3016, con una copia
# de la base de la instancia de producción:
#
#     ./instalar.sh comisiones-alterna 3016 vista-contenedores \
#        /home/usuario/comisiones-web/comisiones.sqlite
#
# Deja el proceso corriendo en PM2 y listo para actualizarse con deploy.sh.
# NO toca la instancia de la que copia la base: sólo la lee.

set -euo pipefail

REPO="https://github.com/tjcrinuxmon/comisiones.git"

CARPETA="${1:-}"
PUERTO="${2:-}"
RAMA="${3:-}"
BASE_ORIGEN="${4:-}"

uso(){
  echo "Uso: ./instalar.sh <carpeta> <puerto> <rama> [base-a-copiar]"
  echo "Ej.: ./instalar.sh comisiones-alterna 3016 vista-contenedores \\"
  echo "        /home/usuario/comisiones-web/comisiones.sqlite"
  exit 1
}
[ -n "$CARPETA" ] && [ -n "$PUERTO" ] && [ -n "$RAMA" ] || uso

command -v git  >/dev/null || { echo "✖ git no está instalado";  exit 1; }
command -v node >/dev/null || { echo "✖ node no está instalado"; exit 1; }
command -v npm  >/dev/null || { echo "✖ npm no está instalado";  exit 1; }
command -v pm2  >/dev/null || { echo "✖ pm2 no está instalado";  exit 1; }

[ -e "$CARPETA" ] && { echo "✖ '$CARPETA' ya existe. Para actualizar usa deploy.sh."; exit 1; }

# El puerto debe estar libre: si no, el proceso arranca y muere al instante.
if command -v ss >/dev/null && ss -ltn "( sport = :$PUERTO )" | grep -q ":$PUERTO"; then
  echo "✖ El puerto $PUERTO ya está en uso. Elige otro."; exit 1
fi
if pm2 describe "$CARPETA" >/dev/null 2>&1; then
  echo "✖ Ya existe un proceso de PM2 llamado '$CARPETA'."; exit 1
fi

echo "==> Clonando $REPO (rama $RAMA)..."
git clone --branch "$RAMA" "$REPO" "$CARPETA"
cd "$CARPETA"

echo "==> Instalando dependencias..."
npm ci --omit=dev || npm install --omit=dev

# ---- Base de datos -----------------------------------------------------------
# Se copia con el respaldo en línea de SQLite, NUNCA con cp: la base está en
# modo WAL y las escrituras recientes viven en un archivo aparte, así que una
# copia a nivel de archivo sale incompleta o inconsistente.
if [ -n "$BASE_ORIGEN" ]; then
  [ -f "$BASE_ORIGEN" ] || { echo "✖ No existe la base a copiar: $BASE_ORIGEN"; exit 1; }
  echo "==> Copiando la base desde $BASE_ORIGEN ..."
  node -e "
    const src = require('better-sqlite3')('$BASE_ORIGEN', { readonly: true });
    src.backup('./comisiones.sqlite')
      .then(() => { console.log('    · copia consistente lista'); process.exit(0); })
      .catch(e => { console.error('    ✖ ' + e.message); process.exit(1); });
  "
else
  echo "==> Sin base de origen: arrancará con una base vacía."
fi

# ---- Configuración -----------------------------------------------------------
CLAVE="$(node -e "console.log(require('crypto').randomBytes(9).toString('base64url'))")"
cat > .env <<CFG
PORT=$PUERTO
ADMIN_PASS=$CLAVE
# Detrás de nginx, descomenta la línea siguiente para que el puerto deje de ser
# alcanzable por IP y todo el tráfico entre cifrado por el proxy:
#HOST=127.0.0.1
CFG
chmod 600 .env

echo "==> Arrancando en PM2 como '$CARPETA'..."
pm2 start server.js --name "$CARPETA" --cwd "$(pwd)"
pm2 save

cat <<FIN

✔ Instalada en $(pwd)

    Proceso PM2 : $CARPETA
    Puerto      : $PUERTO
    Rama        : $RAMA
    Clave admin : $CLAVE

  Guarda esa clave: está en .env y no vuelve a mostrarse.

  Comprueba que responde:
      curl -s -o /dev/null -w '%{http_code}\\n' http://localhost:$PUERTO/nueva

  Para actualizarla de aquí en adelante:
      cd $(pwd) && ./deploy.sh

FIN
