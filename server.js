/* Servidor de la Matriz de Comisiones (Express + SQLite), mismo método que
   diligencias/tareas: se despliega con PM2 detrás de nginx.

   Acceso: cada consejería ELIGE su nombre y ESTABLECE su contraseña la primera
   vez (primer acceso); después la usa para entrar. La contraseña se guarda
   cifrada (bcrypt). Al entrar se emite un token (X-Token) con el que el servidor
   verifica la identidad: un consejero SÓLO puede editar su propia fila. El
   administrador (clave en .env) maneja todo y puede restablecer contraseñas. */
require('dotenv').config();
process.env.TZ = 'America/Mexico_City';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const {
  get, set, bump,
  getClave, setClave, delClave, listClaves,
  getSesion, setSesion, delSesionesDe
} = require('./database');

const app  = express();
const PORT = process.env.PORT || 3006;
const ADMIN_PASS = process.env.ADMIN_PASS || 'cambia-esta-clave';

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const esAdmin    = req => (req.header('X-Admin') || '') === ADMIN_PASS;
const nuevoToken = () => crypto.randomBytes(24).toString('hex');

/* ---- Ventana de disponibilidad para consejeros ----
   Config en la tabla `estado` (llave 'config'): { cierra, habilitado }.
   - habilitado=false  -> cerrado al instante (interruptor maestro).
   - cierra (texto datetime-local, p.ej. "2026-08-02T23:59") -> cerrado pasada esa
     hora. Se interpreta en la zona del server (America/Mexico_City, línea 10).
   - Sin config -> abierto (no altera el comportamiento previo).
   El admin nunca queda sujeto a la ventana. */
const DEFAULT_CONFIG = { cierra: null, habilitado: true };
const getConfig = () => Object.assign({}, DEFAULT_CONFIG, get('config') || {});
function ventanaConsejeros(){
  const c = getConfig();
  const ahora = Date.now();
  let abierta = true, motivo = '';
  if(!c.habilitado){ abierta = false; motivo = 'deshabilitado'; }
  else if(c.cierra){
    const t = Date.parse(c.cierra);
    if(!isNaN(t) && ahora > t){ abierta = false; motivo = 'cerrado'; }
  }
  return { abierta, motivo, cierra: c.cierra || null, habilitado: !!c.habilitado, ahora };
}

/* ---- Estado compartido (carga inicial y sondeo) ---- */
app.get('/api/estado', (req, res) => {
  let intereses = get('intereses') || {};
  if(!esAdmin(req)){
    /* Un consejero SÓLO recibe sus propios intereses (no ve los de los demás). */
    const soy = getSesion(req.header('X-Token') || '');
    const propio = {};
    if(soy) Object.keys(intereses).forEach(k => { if(k.split('|')[0] === soy) propio[k] = intereses[k]; });
    intereses = propio;
  }
  res.json({
    version:     get('version') || 0,
    marcas:      get('marcas') || {},
    intereses:   intereses,
    prelacion:   get('prelacion') || {},
    verificadas: get('verificadas') || {},
    config:      ventanaConsejeros()
  });
});
app.get('/api/version', (req, res) => res.json({ version: get('version') || 0 }));

/* ---- Ventana de disponibilidad: consulta pública y edición del admin ---- */
app.get('/api/config', (req, res) => res.json(ventanaConsejeros()));
app.post('/api/config', (req, res) => {
  if(!esAdmin(req)) return res.status(403).json({ error: 'Sólo administrador.' });
  const { cierra, habilitado } = req.body || {};
  const cfg = getConfig();
  if(cierra !== undefined){
    if(cierra === null || cierra === '') cfg.cierra = null;
    else if(isNaN(Date.parse(cierra)))   return res.status(400).json({ error: 'Fecha de cierre inválida.' });
    else cfg.cierra = String(cierra);
  }
  if(habilitado !== undefined) cfg.habilitado = !!habilitado;
  set('config', { cierra: cfg.cierra, habilitado: cfg.habilitado });
  bump();
  res.json(Object.assign({ ok: true }, ventanaConsejeros()));
});

/* ---- Acceso de consejeros (primer acceso / login / sesión) ---- */
app.post('/api/consejero/estado', (req, res) => {
  const { consejero } = req.body || {};
  res.json({ tienePassword: !!getClave(consejero) });
});
app.post('/api/consejero/registrar', (req, res) => {
  const { consejero, clave } = req.body || {};
  if(!consejero || !clave || String(clave).length < 8)
    return res.status(400).json({ error: 'Contraseña inválida (mínimo 8 caracteres).' });
  if(getClave(consejero))
    return res.status(409).json({ error: 'Ya tiene contraseña; inicie sesión.' });
  setClave(consejero, bcrypt.hashSync(String(clave), 10));
  const token = nuevoToken(); setSesion(token, consejero);
  res.json({ ok: true, token: token });
});
app.post('/api/consejero/login', (req, res) => {
  const { consejero, clave } = req.body || {};
  const h = getClave(consejero);
  if(!h) return res.status(404).json({ error: 'Aún no tiene contraseña; créela.' });
  if(!bcrypt.compareSync(String(clave || ''), h))
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  const token = nuevoToken(); setSesion(token, consejero);
  res.json({ ok: true, token: token });
});
app.post('/api/consejero/sesion', (req, res) => {
  const { token } = req.body || {};
  const c = token ? getSesion(token) : null;
  res.json({ ok: !!c, consejero: c || null });
});

/* ---- Administrador: listar quién ya tiene contraseña y restablecer ---- */
app.get('/api/consejeros', (req, res) => {
  if(!esAdmin(req)) return res.status(403).json({ error: 'Sólo administrador.' });
  res.json(listClaves());
});
app.post('/api/consejero/reset', (req, res) => {
  if(!esAdmin(req)) return res.status(403).json({ error: 'Sólo administrador.' });
  const { consejero } = req.body || {};
  if(!consejero) return res.status(400).json({ error: 'Falta consejería.' });
  delClave(consejero); delSesionesDe(consejero);
  res.json({ ok: true });
});

/* ---- Un consejero captura su fila (identidad por token) o el admin ---- */
app.post('/api/interes', (req, res) => {
  const { consejero, comision, presidencia, quitar } = req.body || {};
  if(!consejero || !comision) return res.status(400).json({ error: 'Faltan datos.' });
  if(!esAdmin(req)){
    const soy = getSesion(req.header('X-Token') || '');
    if(!soy)             return res.status(401).json({ error: 'Sesión no válida; vuelva a entrar.' });
    if(soy !== consejero) return res.status(403).json({ error: 'Sólo puede editar su propia fila.' });
    if(!ventanaConsejeros().abierta)
      return res.status(403).json({ cerrado: true, error: 'La captura está cerrada. Para cambios, contacta a la Secretaría Ejecutiva.' });
  }
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

/* ---- Administrador escribe el estado de integración (y opcional intereses) ---- */
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
app.post('/api/admin/login', (req, res) => {
  res.json({ ok: (req.body && req.body.clave) === ADMIN_PASS });
});

app.get('*', (req, res) => {
  if(!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.listen(PORT, () => console.log(`✅ Matriz de Comisiones en http://localhost:${PORT}`));
