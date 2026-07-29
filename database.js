/* Base de datos SQLite (mismo método que diligencias/tareas). El estado
   compartido de la matriz se guarda como pares clave→JSON en la tabla 'estado':
     marcas, intereses, prelacion, verificadas  → objetos de la app
     version                                     → contador para el sondeo
   No guardamos el catálogo (comisiones/consejerías): ese vive en el frontend. */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'comisiones.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS estado (
    clave       TEXT PRIMARY KEY,
    valor       TEXT NOT NULL,
    actualizado TEXT
  )
`);

const selStmt = db.prepare('SELECT valor FROM estado WHERE clave = ?');
const upStmt  = db.prepare(`
  INSERT INTO estado (clave, valor, actualizado)
  VALUES (?, ?, datetime('now','localtime'))
  ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado = excluded.actualizado
`);

function get(clave){
  const r = selStmt.get(clave);
  return r ? JSON.parse(r.valor) : null;
}
function set(clave, valor){
  upStmt.run(clave, JSON.stringify(valor));
}
/* Sube el contador de versión: el frontend detecta cambios por sondeo. */
function bump(){
  set('version', (get('version') || 0) + 1);
}

/* Valores por omisión la primera vez. */
['marcas', 'intereses', 'prelacion', 'verificadas'].forEach(k => {
  if(get(k) === null) set(k, {});
});
if(get('version') === null) set('version', 0);

module.exports = { db, get, set, bump };
