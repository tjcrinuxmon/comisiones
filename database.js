/* Base de datos SQLite (mismo método que diligencias/tareas).
   - Tabla 'estado': estado compartido de la matriz (marcas, intereses, etc.)
     como pares clave→JSON, más 'version' para el sondeo.
   - Tabla 'claves': contraseña (hash bcrypt) por consejería (primer acceso).
   - Tabla 'sesiones': token→consejería, para no confiar en un encabezado. */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'comisiones.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS estado (
    clave TEXT PRIMARY KEY, valor TEXT NOT NULL, actualizado TEXT
  );
  CREATE TABLE IF NOT EXISTS claves (
    consejero TEXT PRIMARY KEY, hash TEXT NOT NULL, creado TEXT
  );
  CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY, consejero TEXT NOT NULL, creado TEXT
  );
`);

/* ---- estado compartido ---- */
const selEstado = db.prepare('SELECT valor FROM estado WHERE clave = ?');
const upEstado  = db.prepare(`
  INSERT INTO estado (clave, valor, actualizado)
  VALUES (?, ?, datetime('now','localtime'))
  ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado = excluded.actualizado
`);
function get(clave){ const r = selEstado.get(clave); return r ? JSON.parse(r.valor) : null; }
function set(clave, valor){ upEstado.run(clave, JSON.stringify(valor)); }
function bump(){ set('version', (get('version') || 0) + 1); }

['marcas', 'intereses', 'prelacion', 'verificadas'].forEach(k => { if(get(k) === null) set(k, {}); });
if(get('version') === null) set('version', 0);

/* ---- contraseñas (primer acceso) ---- */
const selClave = db.prepare('SELECT hash FROM claves WHERE consejero = ?');
const upClave  = db.prepare(`
  INSERT INTO claves (consejero, hash, creado)
  VALUES (?, ?, datetime('now','localtime'))
  ON CONFLICT(consejero) DO UPDATE SET hash = excluded.hash, creado = excluded.creado
`);
const delClaveStmt = db.prepare('DELETE FROM claves WHERE consejero = ?');
const allClaves    = db.prepare('SELECT consejero FROM claves');
function getClave(c){ const r = selClave.get(c); return r ? r.hash : null; }
function setClave(c, hash){ upClave.run(c, hash); }
function delClave(c){ delClaveStmt.run(c); }
function listClaves(){ const o = {}; allClaves.all().forEach(r => { o[r.consejero] = true; }); return o; }

/* ---- sesiones (token → consejería) ---- */
const selSesion   = db.prepare('SELECT consejero FROM sesiones WHERE token = ?');
const upSesion    = db.prepare(`INSERT OR REPLACE INTO sesiones (token, consejero, creado) VALUES (?, ?, datetime('now','localtime'))`);
const delSesionesDeStmt = db.prepare('DELETE FROM sesiones WHERE consejero = ?');
function getSesion(t){ const r = selSesion.get(t); return r ? r.consejero : null; }
function setSesion(t, c){ upSesion.run(t, c); }
function delSesionesDe(c){ delSesionesDeStmt.run(c); }

module.exports = {
  db, get, set, bump,
  getClave, setClave, delClave, listClaves,
  getSesion, setSesion, delSesionesDe
};
