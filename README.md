# Matriz de Comisiones — captura compartida (multiusuario)

App web para que **cada consejería capture en vivo** sus intereses de integración
de comisiones y un **administrador** maneje toda la integración.

- **Stack:** Node.js + Express + SQLite (`better-sqlite3`) + PM2, detrás de **nginx**.
- **Sin base externa:** el estado compartido vive en un archivo `comisiones.sqlite`
  que se crea solo. No requiere MySQL/Postgres ni servicios adicionales.
- **En vivo:** el navegador sondea `/api/version` cada ~3 s y recarga si cambió.

## Acceso
- **Consejero:** elige su nombre y **establece su propia contraseña** la primera
  vez (bcrypt, mínimo 8, **sin correos**); después inicia sesión. La identidad va
  por token: **sólo ve y edita su propia fila**.
- **Administrador:** entra con la clave `ADMIN_PASS` (definida en `.env`), ve y
  gestiona todo, y puede **restablecer** contraseñas de consejeros.

---

# Despliegue desde cero (servidor nuevo) con dominio y HTTPS

Guía para **Infraestructura**. Asume **Ubuntu/Debian** con acceso `root`/sudo.
Sustituye `comisiones.tudominio.mx` por el dominio real y `usuario` por la ruta
donde alojarán la app.

**Recursos mínimos:** 1 vCPU y 1 GB RAM (app ligera con SQLite).

### 1. DNS
Crear un registro **A** (o CNAME) que apunte `comisiones.tudominio.mx` a la **IP
pública** del servidor. Debe resolver antes de emitir el certificado del paso 6.

### 2. Paquetes base + Node.js 20 LTS
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git build-essential python3

# Node.js 20 LTS (requerido por better-sqlite3 ^12)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v            # verificar (node debe ser v20+)

# PM2 (gestor de procesos)
sudo npm install -g pm2
```

### 3. Bajar el código del repositorio
```bash
cd /home/usuario
git clone https://github.com/tjcrinuxmon/comisiones.git comisiones-web
cd comisiones-web
npm install                  # DEBE correr en el servidor (better-sqlite3 es nativo)
```

### 4. Configuración (`.env`)
```bash
cp .env.example .env
nano .env
```
```
PORT=3006
ADMIN_PASS=clave-fuerte-del-administrador
```
> El `.env` **no** está en git: hay que crearlo en cada servidor. El puerto 3006
> queda **solo interno** (nginx hace el proxy); no se abre al exterior.

### 5. Arrancar con PM2 (persistente)
```bash
pm2 start server.js --name comisiones
pm2 save
pm2 startup                  # ejecutar la línea que imprima (arranque tras reboot)

pm2 list
curl -sI http://localhost:3006/api/estado | head -1   # esperado: HTTP/1.1 200 OK
```

### 6. nginx (reverse proxy) + HTTPS (Let's Encrypt)
```bash
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/comisiones >/dev/null <<'EOF'
server {
    listen 80;
    server_name comisiones.tudominio.mx;

    location / {
        proxy_pass http://127.0.0.1:3006/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/comisiones /etc/nginx/sites-enabled/comisiones
sudo nginx -t && sudo systemctl reload nginx

# Certificado HTTPS (configura nginx y renovación automática)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d comisiones.tudominio.mx
```
Certbot agrega el bloque `listen 443 ssl`, redirige 80→443 y programa la
renovación. Al terminar, la app queda en **`https://comisiones.tudominio.mx`**.

### 7. Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80 y 443
sudo ufw enable
# El puerto 3006 NO se abre: sólo lo usa nginx internamente.
```

### 8. Primer uso
Entrar a `https://comisiones.tudominio.mx` como **administrador** (con
`ADMIN_PASS`): esto **siembra** la integración vigente y las comisiones fijas.
Luego repartir la URL a los consejeros para que creen su contraseña.

---

## Actualizaciones
```bash
cd /home/usuario/comisiones-web
git pull            # o: ./deploy.sh  (hace npm ci si cambió package.json y reinicia)
pm2 restart comisiones
```
Ejecutar `npm install` sólo cuando cambien dependencias (`deploy.sh` lo detecta
solo). El `.env` y `comisiones.sqlite` no se sobrescriben.

## Respaldos
La base es un solo archivo. Respaldar periódicamente:
```bash
cp /home/usuario/comisiones-web/comisiones.sqlite ~/respaldo-comisiones-$(date +%F).sqlite
```

## Notas
- **Datos:** todo el estado capturado vive en `comisiones.sqlite` (creado solo,
  ignorado por git). El catálogo (comisiones/consejerías/integración vigente)
  vive en el frontend `public/index.html`.
- **Seguridad:** `ADMIN_PASS` y las contraseñas de consejeros (bcrypt) protegen el
  acceso; con HTTPS el tráfico va cifrado. Es un sistema interno.
- **Otros SO:** en RHEL/Alma usar `dnf` y el instalador `rpm` de NodeSource.
