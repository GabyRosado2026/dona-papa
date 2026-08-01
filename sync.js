/* ============================================================
   Doña Papa — sincronización de órdenes e inventario

   Todo vive en la nube, así que persiste aunque cierres las apps,
   cambies de teléfono o se te apague el celular a media noche.

     Sync.iniciar({ onOrdenes, onInventario, onEstado })

     Sync.crearOrden({numero, items, total})
     Sync.marcar(id, "listo" | "entregado")
     Sync.borrarViejas()

     Sync.inventario()                  -> {papa, salchicha, ...}
     Sync.sumarInventario({papa:20})    -> la cocina carga
     Sync.consumirInventario({papa:.33})-> la caja descuenta
     Sync.alcanzaPara(receta)           -> cuántas porciones salen

   El inventario se modifica con transacciones: si la caja y la
   cocina tocan al mismo tiempo, no se pisan.
   ============================================================ */
(function(){
"use strict";

const CFG    = (window.DONAPAPA_CONFIG || {});
const PUESTO = CFG.puesto || "casa";
const RAIZ   = "puestos/" + PUESTO;

/* Los insumos que se controlan, compartidos por las dos apps.
   "ref" es la cantidad de referencia para pintar la barra llena. */
window.INSUMOS = [
  { id:"papa",      nombre:"Papa",      unidad:"libras",   corto:"lb", ref:20 },
  { id:"salchicha", nombre:"Salchicha", unidad:"unidades", corto:"u",  ref:40 },
  { id:"pan",       nombre:"Pan",       unidad:"unidades", corto:"u",  ref:12 },
  { id:"cola",      nombre:"Gaseosas",  unidad:"unidades", corto:"u",  ref:24 },
  { id:"tarrina",   nombre:"Tarrinas",  unidad:"unidades", corto:"u",  ref:50 }
];

const LLAVE_ORD = "donapapa_ordenes_" + PUESTO;
const LLAVE_INV = "donapapa_inv_" + PUESTO;
const CANAL     = "donapapa_" + PUESTO;

let ordenes    = {};
let inventario = {};
let alOrdenes  = () => {};
let alInv      = () => {};
let alEstado   = () => {};
let driver     = null;

/* ---------- utilidades ---------- */
function nuevoId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function num(n){ return Math.round(n*1000)/1000; }
function lista(){ return Object.values(ordenes).sort((a,b) => a.creada - b.creada); }
function invVacio(){
  const o = {};
  window.INSUMOS.forEach(i => o[i.id] = 0);
  return o;
}
function normalizar(inv){
  const o = invVacio();
  if(inv) window.INSUMOS.forEach(i => { if(typeof inv[i.id] === "number") o[i.id] = inv[i.id]; });
  return o;
}
function avisarOrdenes(){ alOrdenes(lista()); }
function avisarInv(){ alInv(Object.assign({}, inventario)); }

/* Aplica un cambio (positivo o negativo) sin bajar de cero */
function aplicar(base, delta){
  const r = normalizar(base);
  for(const [k,v] of Object.entries(delta || {})){
    if(k in r) r[k] = num(Math.max(0, r[k] + v));
  }
  return r;
}

/* ============================================================
   Driver LOCAL — mismo dispositivo, varias pestañas
   ============================================================ */
const Local = {
  canal: null,

  iniciar(){
    this.leer();
    try{
      this.canal = new BroadcastChannel(CANAL);
      this.canal.onmessage = () => { this.leer(); avisarOrdenes(); avisarInv(); };
    }catch(e){}
    window.addEventListener("storage", e => {
      if(e.key === LLAVE_ORD || e.key === LLAVE_INV){
        this.leer(); avisarOrdenes(); avisarInv();
      }
    });
    alEstado({ modo:"local", conectado:true });
    avisarOrdenes(); avisarInv();
  },

  leer(){
    try{ ordenes = JSON.parse(localStorage.getItem(LLAVE_ORD)) || {}; }catch(e){ ordenes = {}; }
    try{ inventario = normalizar(JSON.parse(localStorage.getItem(LLAVE_INV))); }catch(e){ inventario = invVacio(); }
  },

  escribir(){
    try{
      localStorage.setItem(LLAVE_ORD, JSON.stringify(ordenes));
      localStorage.setItem(LLAVE_INV, JSON.stringify(inventario));
    }catch(e){}
    try{ if(this.canal) this.canal.postMessage("cambio"); }catch(e){}
  },

  guardarOrden(o){ ordenes[o.id] = o; this.escribir(); avisarOrdenes(); },
  quitarOrden(id){ delete ordenes[id]; this.escribir(); avisarOrdenes(); },

  cambiarInv(delta){
    this.leer();                       // por si otra pestaña acaba de tocarlo
    inventario = aplicar(inventario, delta);
    this.escribir();
    avisarInv();
  }
};

/* ============================================================
   Driver NUBE — Firebase Realtime Database
   ============================================================ */
const Nube = {
  db:null, fb:null,

  async iniciar(){
    alEstado({ modo:"nube", conectado:false, texto:"Conectando…" });

    const [{ initializeApp }, rtdb] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js")
    ]);
    this.fb = rtdb;
    this.db = rtdb.getDatabase(initializeApp(CFG.firebase));

    rtdb.onValue(rtdb.ref(this.db, ".info/connected"), s => {
      alEstado({ modo:"nube", conectado: s.val() === true });
    });

    rtdb.onValue(rtdb.ref(this.db, RAIZ + "/ordenes"), s => {
      ordenes = s.val() || {};
      avisarOrdenes();
    });

    rtdb.onValue(rtdb.ref(this.db, RAIZ + "/inventario"), s => {
      inventario = normalizar(s.val());
      avisarInv();
    });
  },

  guardarOrden(o){
    ordenes[o.id] = o;            // pintado inmediato, sin esperar a la nube
    avisarOrdenes();
    this.fb.set(this.fb.ref(this.db, RAIZ + "/ordenes/" + o.id), o).catch(()=>{});
  },

  quitarOrden(id){
    delete ordenes[id];
    avisarOrdenes();
    this.fb.remove(this.fb.ref(this.db, RAIZ + "/ordenes/" + id)).catch(()=>{});
  },

  /* Transacción: la caja descuenta y la cocina carga sin pisarse */
  cambiarInv(delta){
    this.fb.runTransaction(
      this.fb.ref(this.db, RAIZ + "/inventario"),
      actual => aplicar(actual, delta)
    ).catch(()=>{
      // sin conexión: al menos que la pantalla refleje el cambio
      inventario = aplicar(inventario, delta);
      avisarInv();
    });
  }
};

/* ============================================================
   Interfaz pública
   ============================================================ */
window.Sync = {
  async iniciar(op){
    alOrdenes = op.onOrdenes    || alOrdenes;
    alInv     = op.onInventario || alInv;
    alEstado  = op.onEstado     || alEstado;
    inventario = invVacio();

    if(CFG.firebase && CFG.firebase.databaseURL){
      driver = Nube;
      try{
        await Nube.iniciar();
      }catch(e){
        console.warn("Nube no disponible, modo local:", e);
        driver = Local;
        Local.iniciar();
        alEstado({ modo:"local", conectado:true, texto:"Nube falló — modo local" });
      }
    } else {
      driver = Local;
      Local.iniciar();
    }
  },

  /* ---------- órdenes ---------- */
  crearOrden({ numero, items, total }){
    const o = { id:nuevoId(), numero, items, total,
                estado:"pendiente", creada:Date.now(), lista:null };
    driver.guardarOrden(o);
    return o;
  },

  marcar(id, estado){
    const o = ordenes[id];
    if(!o) return;
    o.estado = estado;
    if(estado === "listo") o.lista = Date.now();
    driver.guardarOrden(o);
  },

  borrarViejas(){
    const limite = Date.now() - 4*60*60*1000;
    lista().forEach(o => {
      if(o.estado === "entregado" && o.creada < limite) driver.quitarOrden(o.id);
    });
  },

  ordenes: lista,

  /* ---------- inventario ---------- */
  inventario(){ return Object.assign({}, inventario); },

  sumarInventario(cantidades){ driver.cambiarInv(cantidades); },

  consumirInventario(receta){
    const d = {};
    for(const [k,v] of Object.entries(receta)) d[k] = -v;
    driver.cambiarInv(d);
  },

  devolverInventario(receta){ driver.cambiarInv(receta); },

  vaciarInventario(){
    const d = {};
    window.INSUMOS.forEach(i => d[i.id] = -1e9);
    driver.cambiarInv(d);
  },

  hayInventario(){ return Object.values(inventario).some(v => v > 0); },

  /* Cuántas porciones salen con lo que hay (receta = {insumo:cantidad}) */
  alcanzaPara(receta, yaComprometido){
    let min = Infinity;
    for(const [ins, cant] of Object.entries(receta)){
      const hay = (inventario[ins] || 0) - ((yaComprometido && yaComprometido[ins]) || 0);
      min = Math.min(min, Math.floor(hay / cant));
    }
    return min === Infinity ? 999 : min;
  }
};

})();
