/* Servidor de la Matriz de Comisiones (Express + SQLite), mismo método que
   diligencias/tareas: se despliega en el servidor con PM2 detrás de nginx.

   Modelo "blando": los consejeros eligen su nombre (sin login) y sólo pueden
   editar SU propia fila de intereses; el administrador (clave en .env) maneja
   todo. La identidad viaja en cabeceras:
     X-Consejero: <id de consejería>     (quién dice ser)
     X-Admin:     <clave de administrador>
   El servidor verifica que un consejero sólo toque su propia fila; el resto de
   las validaciones (reglas de integración) se hacen en el frontend. */
require('dotenv').config();
process.env.TZ = 'America/Mexico_City';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { get, set, bump } = require('./database');

const app  = express();
const PORT = process.env.PORT || 3006;
const ADMIN_PASS = process.env.ADMIN_PASS || 'cambia-esta-clave';

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const esAdmin = req => (req.header('X-Admin') || '') === ADMIN_PASS;

/* Estado completo (para carga inicial y sondeo). */
app.get('/api/estado', (req, res) => {
  res.json({
    version:     get('version') || 0,
    marcas:      get('marcas') || {},
    intereses:   get('intereses') || {},
    prelacion:   get('prelacion') || {},
    verificadas: get('verificadas') || {}
  });
});

/* Sólo la versión (sondeo ligero: el frontend pide el estado completo únicamente
   cuando la versión cambió). */
app.get('/api/version', (req, res) => res.json({ version: get('version') || 0 }));

/* Un consejero marca/quita su interés (o su propuesta de presidencia) en una
   comisión. Sólo puede tocar su propia fila (salvo el administrador). */
app.post('/api/interes', (req, res) => {
  const quien = req.header('X-Consejero') || '';
  const { consejero, comision, presidencia, quitar } = req.body || {};
  if(!consejero || !comision) return res.status(400).json({ error: 'Faltan datos.' });
  if(!esAdmin(req) && quien !== consejero)
    return res.status(403).json({ error: 'Sólo puede editar su propia fila.' });

  const intereses = get('intereses') || {};
  const key = consejero + '|' + comision;
  if(quitar){
    delete intereses[key];
  }else{
    const reg = intereses[key] || {};
    if(presidencia === true) reg.p = true;
    else if(presidencia === false) delete reg.p;
    intereses[key] = reg;
  }
  set('intereses', intereses);
  bump();
  res.json({ ok: true, version: get('version') });
});

/* El administrador escribe el estado del lado de integración (y opcionalmente
   los intereses en bloque, p. ej. al sembrar/limpiar/volcar). */
app.post('/api/admin', (req, res) => {
  if(!esAdmin(req)) return res.status(403).json({ error: 'Sólo administrador.' });
  const { marcas, verificadas, prelacion, intereses } = req.body || {};
  if(marcas      !== undefined) set('marcas', marcas);
  if(verificadas !== undefined) set('verificadas', verificadas);
  if(prelacion   !== undefined) set('prelacion', prelacion);
  if(intereses   !== undefined) set('intereses', intereses);
  bump();
  res.json({ ok: true, version: get('version') });
});

/* Comprobación de la clave de administrador (para la pantalla de acceso). */
app.post('/api/admin/login', (req, res) => {
  res.json({ ok: (req.body && req.body.clave) === ADMIN_PASS });
});

/* SPA: cualquier ruta que no sea /api sirve el index. */
app.get('*', (req, res) => {
  if(!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Matriz de Comisiones en http://localhost:${PORT}`);
});
