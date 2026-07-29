# Matriz de Comisiones — captura compartida (multiusuario)

App web (Express + SQLite) para que **varios consejeros capturen en vivo** sus
intereses de integración de comisiones, y un **administrador** maneje toda la
integración. Mismo método que `diligencias`/`tareas`: Node + SQLite + PM2 detrás
de nginx.

- **Modelo blando:** cada consejero elige su nombre (sin login) y sólo edita su
  propia fila; el administrador entra con una clave y desbloquea todo.
- **En vivo:** el frontend sondea el servidor cada ~3 s (`/api/version`) y
  recarga el estado cuando cambió.
- **Estado compartido** en `comisiones.sqlite` (tabla `estado`, JSON por clave).

## Puesta en marcha (local o servidor)

```bash
cd comisiones-web
npm install
cp .env.example .env      # ajusta PORT y ADMIN_PASS (¡cambia la clave!)
npm start                 # o: pm2 start server.js --name comisiones
```

Abre `http://localhost:3006`.

## Publicar por IP pública SIN dominio (nginx)

Ya tienes nginx en 80/443. Agrega un `location` en tu `server` que escucha en la
IP (o crea uno) para exponer la app en una subruta. El frontend usa **rutas
relativas**, así que funciona bajo `/comisiones/`:

```nginx
# dentro del bloque: server { listen 80 default_server; ... }
location /comisiones/ {
    proxy_pass http://127.0.0.1:3006/;   # la barra final quita el prefijo
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Recarga nginx (`sudo nginx -t && sudo systemctl reload nginx`) y entra a
`http://TU_IP_PUBLICA/comisiones/`. Repartes esa URL a los consejeros.

- No necesitas dominio ni certificado; el puerto 3006 queda **solo interno**
  (nginx es el único expuesto).
- Alternativa rápida (sin nginx): abre el puerto 3006 en el firewall y entra a
  `http://TU_IP:3006` — funciona, pero queda en HTTP plano y con el puerto
  expuesto; se recomienda la vía nginx.

## Despliegue continuo (PM2 + git)

```bash
pm2 start server.js --name comisiones      # primera vez
pm2 save
./deploy.sh                                 # siguientes: git pull + restart
```

## Notas

- `ADMIN_PASS` en `.env` es la clave del administrador (barrera de interfaz, no
  seguridad fuerte: es un sistema interno de confianza).
- La base `comisiones.sqlite` y `.env` están protegidas en `deploy.sh` (no se
  sobrescriben al actualizar).
- El catálogo (comisiones/consejerías/integración vigente) vive en el frontend
  (`public/index.html`); la base sólo guarda el estado que se captura.
