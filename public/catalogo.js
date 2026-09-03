/* =====================================================================
   CATÁLOGO COMPARTIDO DE LA MATRIZ DE COMISIONES
   ---------------------------------------------------------------------
   Se extrajo de public/index.html el 02/09/2026 para que más de una
   pantalla use LOS MISMOS datos y el MISMO sello, en vez de duplicarlos.
   Lo cargan la matriz clásica (index.html) y la vista nueva.

   Es un script clásico, no un módulo: sus const/let viven en el ámbito
   global léxico, así que la página que lo carga después los ve.

   Si cambia el catálogo hay que recalcular las huellas: ver el bloque
   VERSIÓN Y HUELLA más abajo.
   ===================================================================== */
/* =====================================================================
   CATÁLOGO — es lo único que hay que tocar si cambia la integración.
   En cada comisión: min = mínimo de integrantes, max = máximo.
   Si min y max son iguales, la comisión es de número fijo.

   Campos adicionales:
     grupo      : 'permanente' | 'temporal' | 'otro'  (agrupa la matriz)
     bloqueada  : true  → integración fija que no puede editarse (Punto 9)
     comparacion: 'aplica' (por defecto) | 'no-comparable' (Punto 8) |
                  'excepcion' (Punto 9). Controla si se verifican la
                  rotación de la presidencia y la renovación mínima
                  contra la composición anterior (INE/CG241/2026).
     refrendoPresidencia: true → esta comisión SÍ puede refrendar a quien
                  preside: su presidencia cambió en el acuerdo de abril, no
                  lleva el año, y por eso la rotación anual todavía no le
                  corresponde. Excepción independiente de 'comparacion':
                  apaga SÓLO la rotación; la renovación mínima y las demás
                  reglas se siguen verificando con normalidad.
     autoPresi  : id de la comisión cuya presidencia preside también a
                  este órgano de forma automática (Comité Editorial).
     noComputa  : true → (hoy ninguna comisión lo usa; Seguimiento PEL lo tuvo
                  del 24/08 al 03/09/2026 y volvió a contar por decisión del
                  área) la comisión se muestra y conserva su integración, pero
                  NO se suma a ningún total: ni a la columna «Total comisiones»
                  de cada consejería, ni al pie de la tabla, ni a los subtotales
                  y gran total del reporte. Se usa para las comisiones en
                  decisión (continúan o se extinguen), cuyas designaciones no
                  deben inflar el conteo mientras se resuelve.
   El límite por consejería (MAX_POR_CONSEJERIA) cuenta TODAS las comisiones
   permanentes, sin excepciones: Verificación de Integridad estaba exenta
   (noCuentaLimite) y dejó de estarlo el 25/08/2026. El límite advierte, no
   impide: hasta 4 sin marca (Art. 42.2 LGIPE), 5 en ámbar —el límite que
   admite la matriz— y 6 o más en rojo.
   ===================================================================== */
const MAX_POR_CONSEJERIA = 5;

const GRUPOS = {
  permanente: 'Comisiones permanentes',
  temporal:   'Comisiones temporales',
  otro:       'Otros órganos'
};

/* La Consejera Presidenta no integra comisiones permanentes, por lo que
   no aparece en la matriz. */
const CONSEJERIAS = [
  { id:'castillo', nombre:'Arturo Castillo Loza',         cargo:'Consejero Electoral',  sexo:'H', corto:'Arturo Castillo' },
  { id:'chavez',   nombre:'Arturo Manuel Chávez López',   cargo:'Consejero Electoral',  sexo:'H', corto:'Arturo Chávez' },
  { id:'cruzg',    nombre:'Blanca Yassahara Cruz García', cargo:'Consejera Electoral',  sexo:'M', corto:'Blanca Cruz' },
  { id:'delacruz', nombre:'Norma Irene de la Cruz Magaña',cargo:'Consejera Electoral',  sexo:'M', corto:'Norma de la Cruz' },
  { id:'espadas',  nombre:'Uuc-kib Espadas Ancona',       cargo:'Consejero Electoral',  sexo:'H', corto:'Uuc-kib Espadas' },
  { id:'faz',      nombre:'José Martín Fernando Faz Mora',cargo:'Consejero Electoral',  sexo:'H', corto:'Martín Faz' },
  { id:'gomez',    nombre:'Frida Denisse Gómez Puga',     cargo:'Consejera Electoral',  sexo:'M', corto:'Frida Gómez' },
  { id:'humphrey', nombre:'Carla Astrid Humphrey Jordán', cargo:'Consejera Electoral',  sexo:'M', corto:'Carla Humphrey' },
  { id:'lopezv',   nombre:'Rita Bell López Vences',       cargo:'Consejera Electoral',  sexo:'M', corto:'Rita Bell López' },
  { id:'montano',  nombre:'Jorge Montaño Ventura',        cargo:'Consejero Electoral',  sexo:'H', corto:'Jorge Montaño' }
];

const COMISIONES = [
  /* --- Permanentes (LGIPE art. 42.2 — diez comisiones) --- */
  { id:'organizacion',  nombre:'Organización Electoral',                    min:3, max:5, grupo:'permanente' },
  { id:'fiscalizacion', nombre:'Fiscalización',                             min:5, max:5, grupo:'permanente',
                        refrendoPresidencia:true },
  { id:'capacitacion',  nombre:'Capacitación Electoral y Educación Cívica', min:3, max:5, grupo:'permanente' },
  { id:'prerrogativas', nombre:'Prerrogativas y Partidos Políticos / Radio y TV', min:3, max:5, grupo:'permanente' },
  { id:'registro',      nombre:'Registro Federal de Electores',             min:3, max:5, grupo:'permanente' },
  { id:'igualdad',      nombre:'Igualdad de Género y no Discriminación',    min:3, max:5, grupo:'permanente' },
  { id:'quejas',        nombre:'Quejas y Denuncias',                        min:3, max:3, grupo:'permanente', prelacion:true },
  { id:'ople',          nombre:'Vinculación con OPLE',                      min:4, max:4, grupo:'permanente' },
  { id:'servicio',      nombre:'Servicio Profesional Electoral Nacional',   min:3, max:5, grupo:'permanente',
                        refrendoPresidencia:true },
  { id:'verificacion',  nombre:'Verificación de Integridad en Candidaturas',min:3, max:3, grupo:'permanente',
                        comparacion:'no-comparable', bloqueada:true, nota:'INTEGRADA 30/07/2026 · ya no elegible' },
  /* --- Temporales (presididas siempre por una consejería; 3 a 5) --- */
  { id:'capyorg',       nombre:'Capacitación y Organización Electoral',     min:3, max:5, grupo:'temporal',
                        comparacion:'no-comparable' },
  { id:'transparencia', nombre:'Transparencia, Acceso a la Información y Protección de Datos Personales', min:3, max:5, grupo:'temporal' },
  { id:'seguimiento',   nombre:'Seguimiento de los Procesos Electorales Locales 2025-2026', min:3, max:5, grupo:'temporal',
                        bloqueada:true, comparacion:'excepcion' },
  { id:'voto',          nombre:'Voto de las y los Mexicanos Residentes en el Extranjero', min:3, max:5, grupo:'temporal' },
  { id:'presupuesto',   nombre:'Presupuesto 2027',                          min:3, max:5, grupo:'temporal',
                        bloqueada:true, comparacion:'excepcion' },
  /* --- Otros órganos --- */
  { id:'editorial',     nombre:'Comité Editorial',                          min:2, max:2, grupo:'otro',
                        comparacion:'no-comparable', autoPresi:'capacitacion' }
];

/* ---------------------------------------------------------------------
   Predicados puros del catálogo: dependen SÓLO de la comisión, no del
   estado de la matriz, así que viven aquí y los comparten todas las
   pantallas (y cargarHistorial, más abajo, que los necesita).
   --------------------------------------------------------------------- */
const esPermanente     = k => k.grupo === 'permanente';
const esModificable    = k => !k.bloqueada;                    // las bloqueadas no se editan ni se verifican
/* Comisiones en decisión (noComputa): se muestran y conservan su
   integración, pero no suman en ningún total. Hoy no la usa ninguna. */
const computa          = k => !k.noComputa;
/* Ya no hay excepciones al límite: TODA permanente cuenta, incluida
   Verificación de Integridad (antes exenta con noCuentaLimite). */
const cuentaLimite     = k => esPermanente(k) && computa(k);
/* Controla si se verifican las dos rotaciones contra el historial. */
const comparacionAplica = k => (k.comparacion || 'aplica') === 'aplica';

/* =====================================================================
   VERSIÓN Y HUELLA DEL CATÁLOGO
   La huella se recalcula al abrir la aplicación y se compara contra los
   valores de abajo, que corresponden al archivo original. Si alguien
   edita el catálogo, el sello del encabezado lo delata.
   ===================================================================== */
const VERSION       = '1.7';
const VERSION_FECHA = '29/07/2026';

const HUELLAS_ORIGINALES = {
  tope:        '300CA0D02DAFAC62',   // 25/08/2026: el límite pasó de 4 a 5 (antes 310CA263B39B76CD)
  consejerias: '748C6D2AB1698C74',
  comisiones:  '622B51DBF962ADA5',
  vigente:     '1512ECDD113B5BC3',
  historial:   '830645BE6DAECBD8'
};

/* Huella del historial que se cargó de datos/historial-comisiones.json.
   Se calcula al leerlo (cargarHistorial) porque el archivo es externo. */
let HUELLA_HISTORIAL = null;

/* Huella FNV-1a de 64 bits en dos mitades. No es criptográfica: sirve
   para detectar alteraciones, no para impedirlas. */
function huella(texto){
  let a = 0x811c9dc5, b = 0x01000193;
  for(let i = 0; i < texto.length; i++){
    const c = texto.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x85ebca6b) >>> 0;
  }
  return (a.toString(16).padStart(8,'0') + b.toString(16).padStart(8,'0')).toUpperCase();
}

function huellasActuales(){
  return {
    tope: huella(String(MAX_POR_CONSEJERIA)),
    consejerias: huella(CONSEJERIAS.map(c => c.id + '~' + c.nombre + '~' + c.cargo + '~' + c.sexo).join('|')),
    comisiones: huella(COMISIONES.map(k =>
      k.id + '~' + k.nombre + '~' + k.min + '~' + k.max + '~' + (k.nota || '')).join('|')),
    vigente: huella(Object.keys(INTEGRACION_VIGENTE).map(id => id + '~' +
      INTEGRACION_VIGENTE[id].map(a =>
        a.comision + ':' + a.fecha + (a.presidencia ? ':P' : '')).join(',')).join('|')),
    /* Archivo externo: la huella se calcula al cargarlo. Si aún no se ha
       leído queda en null y el sello lo reporta como modificado, que es lo
       prudente: sin historial no hay comparación válida. */
    historial: HUELLA_HISTORIAL
  };
}

const SECCIONES = {
  tope:        'Límite de comisiones por consejería',
  consejerias: 'Listado de consejerías',
  comisiones:  'Comisiones, mínimos y máximos',
  vigente:     'Integración vigente y fechas de designación',
  historial:   'Historial de integraciones 2020-2026'
};

function revisarIntegridad(){
  const actuales = huellasActuales();
  const alteradas = Object.keys(SECCIONES).filter(s => actuales[s] !== HUELLAS_ORIGINALES[s]);
  return { actuales: actuales, alteradas: alteradas };
}

/* =====================================================================
   INTEGRACIÓN VIGENTE — se carga la primera vez que se abre la aplicación.
   A partir de ahí manda lo que se marque en pantalla.

   Cada asignación indica la comisión, la fecha de inicio en formato
   aaaa-mm-dd y, cuando corresponde, si la consejería preside la comisión.
   Las fechas provienen de la racha continua de integración verificada
   contra los acuerdos INE/CG172/2020, INE/CG1494/2021, INE/CG257/2023,
   INE/CG532/2023 e INE/CG241/2026 (no todas arrancan en la misma fecha).
   La antigüedad frente al límite legal de 3 años se calcula en tiempo
   real (ver mesesDesde) y se resalta en ámbar u rojo bajo cada celda.
   ===================================================================== */

/* Permanentes: miembros y presidencias conforme a INE/CG241/2026 (las fechas
   reflejan la racha continua de cada consejería; se afinan aparte para la
   antigüedad). Temporales y Comité Editorial: integración aprobada en los
   puntos PRIMERO y SEGUNDO del Acuerdo INE/CG241/2026 (27/04/2026).
   La presidencia del Comité Editorial no se marca aquí: la hereda de quien
   presida Capacitación Electoral (Espadas), ver autoPresi. */
const INTEGRACION_VIGENTE = {
  castillo: [
    { comision:'prerrogativas', fecha:'2023-09-08' },
    { comision:'registro',      fecha:'2023-09-08' },
    { comision:'igualdad',      fecha:'2023-09-08' },
    { comision:'quejas',        fecha:'2023-09-08', presidencia:true },
    { comision:'transparencia', fecha:'2026-04-27', presidencia:true }
  ],
  chavez: [
    { comision:'organizacion',  fecha:'2026-04-27' },
    { comision:'fiscalizacion', fecha:'2026-04-27' },
    { comision:'capacitacion',  fecha:'2026-04-27' },
    { comision:'prerrogativas', fecha:'2026-04-27' },
    { comision:'presupuesto',   fecha:'2026-04-27' },
    { comision:'verificacion',  fecha:'2026-07-30', presidencia:true }
  ],
  cruzg: [
    { comision:'organizacion',  fecha:'2026-04-27' },
    { comision:'registro',      fecha:'2026-04-27' },
    { comision:'ople',          fecha:'2026-04-27' },
    { comision:'seguimiento',   fecha:'2026-04-27' },
    { comision:'transparencia', fecha:'2026-04-27' }
  ],
  delacruz: [
    { comision:'capacitacion',  fecha:'2023-09-08' },
    { comision:'prerrogativas', fecha:'2023-09-08', presidencia:true },
    { comision:'registro',      fecha:'2023-09-08' },
    { comision:'ople',          fecha:'2020-07-30' },
    { comision:'seguimiento',   fecha:'2026-04-27' },
    { comision:'voto',          fecha:'2026-04-27' },
    { comision:'transparencia', fecha:'2026-04-27' },
    { comision:'presupuesto',   fecha:'2026-04-27' },
    { comision:'editorial',     fecha:'2026-04-27' },
    { comision:'verificacion',  fecha:'2026-07-30' }
  ],
  espadas: [
    { comision:'fiscalizacion', fecha:'2020-07-30', presidencia:true },
    { comision:'capacitacion',  fecha:'2023-09-08', presidencia:true },
    { comision:'prerrogativas', fecha:'2020-07-30' },
    { comision:'servicio',      fecha:'2023-09-08' },
    { comision:'voto',          fecha:'2026-04-27' },
    { comision:'presupuesto',   fecha:'2026-04-27' },
    { comision:'editorial',     fecha:'2026-04-27' },
    { comision:'verificacion',  fecha:'2026-07-30' }
  ],
  faz: [
    { comision:'organizacion',  fecha:'2023-09-08', presidencia:true },
    { comision:'ople',          fecha:'2020-07-30' },
    { comision:'servicio',      fecha:'2023-09-08', presidencia:true },
    { comision:'transparencia', fecha:'2026-04-27' }
  ],
  gomez: [
    { comision:'fiscalizacion', fecha:'2026-04-27' },
    { comision:'capacitacion',  fecha:'2026-04-27' },
    { comision:'igualdad',      fecha:'2026-04-27' },
    { comision:'quejas',        fecha:'2026-04-27' },
    { comision:'voto',          fecha:'2026-04-27' }
  ],
  humphrey: [
    { comision:'fiscalizacion', fecha:'2020-07-30' },
    { comision:'capacitacion',  fecha:'2023-09-08' },
    { comision:'prerrogativas', fecha:'2023-09-08' },
    { comision:'registro',      fecha:'2020-07-30', presidencia:true },
    { comision:'seguimiento',   fecha:'2026-04-27', presidencia:true },
    { comision:'voto',          fecha:'2026-04-27' }
  ],
  lopezv: [
    { comision:'igualdad',      fecha:'2023-09-08', presidencia:true },
    { comision:'quejas',        fecha:'2023-09-08' },
    { comision:'servicio',      fecha:'2023-09-08' },
    { comision:'seguimiento',   fecha:'2026-04-27' },
    { comision:'transparencia', fecha:'2026-04-27' },
    { comision:'presupuesto',   fecha:'2026-04-27' }
  ],
  montano: [
    { comision:'fiscalizacion', fecha:'2023-09-08' },
    { comision:'registro',      fecha:'2023-09-08' },
    { comision:'igualdad',      fecha:'2023-09-08' },
    { comision:'ople',          fecha:'2023-09-08', presidencia:true },
    { comision:'seguimiento',   fecha:'2026-04-27' },
    { comision:'voto',          fecha:'2026-04-27', presidencia:true },
    { comision:'presupuesto',   fecha:'2026-04-27', presidencia:true }
  ]
};

/* =====================================================================
   HISTORIAL DE INTEGRACIONES  ·  2020-2026 (nueve cortes)
   ---------------------------------------------------------------------
   Referencia para las DOS reglas de rotación, que son independientes:

     · PRESIDENCIA — rota cada AÑO. Se compara contra el corte más
       reciente (el último de esta lista).
     · INTEGRACIÓN — rota al menos cada TRES AÑOS, y para cumplir debe
       cambiar al menos una persona. Se compara contra el corte de hace
       tres años (CORTE_INTEGRACION), no contra el más reciente.

   Fuente: radiografía verificada contra el texto primario de cada
   acuerdo. Incluye a las consejerías que YA NO están en el Consejo
   (Zavala, Ravel, Rivera, Ruiz, Favela, Murayama): sin ellas la
   comparación es falsa, porque su salida es justamente lo que cambió
   la composición de varias comisiones.

   Cambios del Consejo General en el periodo:
     · jul-2020  entran De la Cruz, Humphrey, Faz y Espadas.
     · abr-2023  salen Córdova, Favela, Murayama y Ruiz; entran
                 López Vences, Castillo y Montaño.
     · abr-2026  salen Ravel, Rivera y Zavala (concluyen sus nueve
                 años); entran Chávez, Cruz García y Gómez Puga, que se
                 integran a comisiones el 27/04/2026.

   Sólo se listan las nueve permanentes con composición comparable.
   Verificación de Integridad no aparece: se creó en 2026 y por eso está
   marcada como 'no-comparable'. ===================================== */

/* Consejerías que ya no integran el Consejo. Se llenan desde el JSON; sólo
   sirven para leer el historial y no aparecen en la matriz ni cuentan para
   ninguna regla. */
let CONSEJERIAS_HISTORICAS = {};
const nombreHistorico = id => {
  const c = CONSEJERIAS.find(x => x.id === id);
  return c ? c.corto : (CONSEJERIAS_HISTORICAS[id] || id);
};

/* El historial se carga de datos/historial-comisiones.json antes de dibujar
   nada (ver arranque, al final del archivo). Se deja vacío a propósito: si la
   carga falla, la app se detiene con un error visible en vez de seguir con las
   reglas apagadas. */
let HISTORIAL = [];
let CORTE_PRESIDENCIA = null;   // rotación anual de la presidencia: último corte
let CORTE_INTEGRACION = null;   // rotación trienal de la integración: corte de hace 3 años

const RUTA_HISTORIAL = 'datos/historial-comisiones.json';

/* Texto canónico del historial para la huella: mismo orden siempre, para que
   dos lecturas del mismo archivo den idéntico resultado. */
function textoHistorial(cortes, historicas){
  return Object.keys(historicas).sort().map(id => id + '=' + historicas[id]).join(',') + '#' +
    cortes.map(c => c.fecha + '~' + c.acuerdo + '~' +
      Object.keys(c.integracion).sort().map(idK => {
        const e = c.integracion[idK];
        return idK + ':' + (e.p || '') + ':' + [...e.m].sort().join('+');
      }).join(';')).join('|');
}

async function cargarHistorial(){
  const r = await fetch(RUTA_HISTORIAL, { cache:'no-store' });
  if(!r.ok) throw new Error('no se pudo leer ' + RUTA_HISTORIAL + ' (HTTP ' + r.status + ')');
  const j = await r.json();
  if(!j || !Array.isArray(j.cortes) || !j.cortes.length)
    throw new Error(RUTA_HISTORIAL + ' no trae cortes');

  HISTORIAL = j.cortes;
  CONSEJERIAS_HISTORICAS = j.consejeriasHistoricas || {};

  const ref = j.referencias || {};
  CORTE_PRESIDENCIA = HISTORIAL[HISTORIAL.length - 1];
  CORTE_INTEGRACION = HISTORIAL.find(c => c.acuerdo === ref.integracion);
  if(!CORTE_INTEGRACION)
    throw new Error('el corte de referencia para la integración (' + ref.integracion + ') no está en el historial');

  /* Toda comisión comparable debe existir en ambos cortes de referencia; si
     no, sus reglas quedarían apagadas en silencio. */
  const faltan = COMISIONES.filter(k => comparacionAplica(k) && esPermanente(k) &&
    !k.noComputa && !CORTE_PRESIDENCIA.integracion[k.id]).map(k => k.id);
  if(faltan.length)
    throw new Error('el último corte no incluye: ' + faltan.join(', '));

  HUELLA_HISTORIAL = huella(textoHistorial(HISTORIAL, CONSEJERIAS_HISTORICAS));
}

/* Orden de prelación de suplencias por comisión (Art. 44.2.c del Reglamento de
   Quejas y Denuncias). Lista ordenada de consejerías suplentes; ser suplente
   NO cuenta como integrar la comisión ni para el límite de permanentes.
   Se siembra con el orden del Acuerdo INE/CG241/2026 y puede reordenarse. */
const PRELACION_VIGENTE = {
  quejas: ['delacruz','espadas','faz','humphrey','montano','cruzg','chavez']
};
