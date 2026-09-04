#!/usr/bin/env bash
#
# Instalación de una instancia de la Matriz de Comisiones.
# Se ejecuta UNA SOLA VEZ, en el servidor, desde el directorio padre:
#
#     ./instalar.sh <carpeta> <puerto> <rama> [base-a-copiar] [vista]
#
# Ejemplo — versión alterna (vista de contenedores) en el 3016, con una copia
# de la base de la instancia que ya está en operación:
#
#     ./instalar.sh comisiones-alterna 3016 vista-contenedores \
#        /home/usuario/comisiones-web/comisiones.sqlite
#
# Argumentos:
#   carpeta        nombre del directorio y del proceso de PM2
#   puerto         debe estar libre
#   rama           la que seguirá esta instancia
#   base-a-copiar  opcional; sin ella arranca con una base vacía
#   vista          'nueva' (por omisión) o 'clasica': qué pantalla es la raíz
#
# Deja el proceso corriendo en PM2 y listo para actualizarse con
# deploy-alterna.sh. NO toca la instancia de la que copia la base: sólo la lee.

set -euo pipefail

REPO="https://github.com/tjcrinuxmon/comisiones.git"

CARPETA="${1:-}"
PUERTO="${2:-}"
RAMA="${3:-}"
BASE_ORIGEN="${4:-}"
VISTA="${5:-nueva}"

uso(){
  cat <<'AYUDA'
Uso: ./instalar.sh <carpeta> <puerto> <rama> [base-a-copiar] [vista]

  vista: 'nueva' (por omisión) o 'clasica'

Ej.: ./instalar.sh comisiones-alterna 3016 vista-contenedores \
        /home/usuario/comisiones-web/comisiones.sqlite
AYUDA
  exit 1
}
[ -n "$CARPETA" ] && [ -n "$PUERTO" ] && [ -n "$RAMA" ] || uso

case "$VISTA" in
  nueva|clasica) ;;
  *) echo "✖ vista debe ser 'nueva' o 'clasica', no '$VISTA'"; exit 1 ;;
esac
case "$PUERTO" in
  ''|*[!0-9]*) echo "✖ El puerto debe ser un número: '$PUERTO'"; exit 1 ;;
esac

for cmd in git node npm pm2 curl; do
  command -v "$cmd" >/dev/null || { echo "✖ $cmd no está instalado"; exit 1; }
done

[ -e "$CARPETA" ] && { echo "✖ '$CARPETA' ya existe. Para actualizar usa deploy-alterna.sh."; exit 1; }

# El puerto debe estar libre: si no, el proceso arranca y muere al instante.
if command -v ss >/dev/null && ss -ltn "( sport = :$PUERTO )" 2>/dev/null | grep -q ":$PUERTO"; then
  echo "✖ El puerto $PUERTO ya está en uso. Elige otro."; exit 1
fi
if pm2 describe "$CARPETA" >/dev/null 2>&1; then
  echo "✖ Ya existe un proceso de PM2 llamado '$CARPETA'."; exit 1
fi

# Si algo falla a media instalación, se limpia lo dejado a medias: así un
# segundo intento no choca con "la carpeta ya existe".
#
# Se atrapa EXIT, no ERR: las validaciones terminan con 'exit 1' explícito y
# ERR no se dispara con eso, así que la limpieza no llegaba a correr.
LIMPIAR="no"
RAIZ="$(pwd)"
al_salir(){
  local codigo=$?
  trap - EXIT
  if [ "$codigo" -ne 0 ] && [ "$LIMPIAR" = "si" ]; then
    echo
    echo "✖ La instalación falló. Deshaciendo lo que alcanzó a crearse..."
    pm2 delete "$CARPETA" >/dev/null 2>&1 || true
    cd "$RAIZ" && rm -rf "$CARPETA"
    echo "   Listo. Puedes corregir y volver a intentar."
  fi
  exit $codigo
}
trap al_salir EXIT INT TERM

echo "==> Clonando $REPO (rama $RAMA)..."
LIMPIAR="si"
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
  # La ruta viaja por el entorno, no interpolada en el código: así no la rompe
  # una comilla o una barra invertida en el nombre.
  ORIGEN="$BASE_ORIGEN" node -e "
    const src = require('better-sqlite3')(process.env.ORIGEN, { readonly: true });
    src.backup('./comisiones.sqlite')
      .then(() => { console.log('    · copia consistente lista'); process.exit(0); })
      .catch(e => { console.error('    ✖ ' + e.message); process.exit(1); });
  "
else
  echo "==> Sin base de origen: arrancará con una base vacía."
fi

# ---- Configuración -----------------------------------------------------------
CLAVE="$(node -e "console.log(require('crypto').randomBytes(9).toString('base64url'))")"
{
  echo "PORT=$PUERTO"
  echo "ADMIN_PASS=$CLAVE"
  echo "# Nombre del proceso de PM2 de esta instancia."
  echo "APP_NAME=$CARPETA"
  echo "# Pantalla que responde en la raíz."
  [ "$VISTA" = "clasica" ] && echo "#VISTA=nueva" || echo "VISTA=nueva"
  echo "# Detrás de nginx, descomenta la línea siguiente para que el puerto deje"
  echo "# de ser alcanzable por IP y todo el tráfico entre cifrado por el proxy:"
  echo "#HOST=127.0.0.1"
} > .env
chmod 600 .env

echo "==> Arrancando en PM2 como '$CARPETA'..."
pm2 start server.js --name "$CARPETA" --cwd "$(pwd)"
pm2 save

# ---- Comprobar que quedó viva ------------------------------------------------
echo "==> Comprobando que responde..."
sleep 2
CODIGO="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PUERTO/" || true)"
if [ "$CODIGO" != "200" ]; then
  echo "✖ La instancia no respondió (HTTP ${CODIGO:-sin respuesta})."
  echo "   Revisa:  pm2 logs $CARPETA --lines 40"
  exit 1
fi

LIMPIAR="no"             # a partir de aquí ya no hay que deshacer nada

cat <<FIN

✔ Instalada y respondiendo en $(pwd)

    Proceso PM2 : $CARPETA
    Puerto      : $PUERTO
    Rama        : $RAMA
    Entrada     : $( [ "$VISTA" = "clasica" ] && echo "la pantalla de siempre" || echo "la vista de contenedores" )
    Clave admin : $CLAVE

  Guarda esa clave ahora: queda en .env (sólo legible por su dueño) y no vuelve
  a mostrarse. Si esta sesión se está grabando, considera cambiarla:
      cd $(pwd) && nano .env && pm2 restart $CARPETA --update-env

  Para actualizarla de aquí en adelante:
      cd $(pwd) && ./deploy-alterna.sh

FIN
