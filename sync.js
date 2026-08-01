/* ============================================================
   Doña Papa — sincronización

   Todo vive en la nube y persiste: órdenes, inventario, ventas
   del día e historial de jornadas.

   Estructura en Firebase:
     puestos/<puesto>/ordenes            órdenes en curso
     puestos/<puesto>/inventario         lo que hay
     puestos/<puesto>/jornada/ventas     ventas de hoy
     puestos/<puesto>/jornada/numero     contador de órdenes
     puestos/<puesto>/historial          jornadas cerradas

   Ojo: aquí NO se guardan costos ni utilidades. La caja no los
   conoce; el perfil de dueña los calcula con su propia tabla.
   ============================================================ */
(function(){
"use strict";

const CFG    = (window.DONAPAPA_CONFIG || {});
const PUESTO = CFG.puesto || "casa";
const RAIZ   = "puestos/" + PUESTO;

window.INSUMOS = [
  { id:"papa",      nombre:"Papa",      unidad:"libras",   corto:"lb", ref:20 },
  { id:"salchicha", nombre:"Salchicha", unidad:"unidades", corto:"u",  ref:40 },
  { id:"pan",       nombre:"Pan",       unidad:"unidades", corto:"u",  ref:12 },
  { id:"cola",      nombre:"Gaseosas",  unidad:"unidades", corto:"u",  ref:24 },
  { id:"tarrina",   nombre:"Tarrinas",  unidad:"unidades", corto:"u",  ref:50 }
];

const K = {
  ord: "donapapa_ordenes_"   + PUESTO,
  inv: "donapapa_inv_"       + PUESTO,
  ven: "donapapa_ventas_"    + PUESTO,
  his: "donapapa_historial_" + PUESTO,
  num: "donapapa_numero_"    + PUESTO
};
const CANAL = "donapapa_" + PUESTO;

let ordenes    = {};
let inventario = {};
let ventas     = {};
let historial  = {};
let numero     = 0;

let cbOrdenes = () => {}, cbInv = () => {}, cbVentas = () => {},
    cbHist    = () => {}, cbEstado = () => {};
let driver = null;

/* ---------- utilidades ---------- */
function nuevoId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function redondear(n){ return Math.round(n*1000)/1000; }
function invVacio(){ const o={}; window.INSUMOS.forEach(i => o[i.id]=0); return o; }

function normalizarInv(inv){
  const o = invVacio();
  if(inv) window.INSUMOS.forEach(i => { if(typeof inv[i.id]==="number") o[i.id]=inv[i.id]; });
  return o;
}
function aplicar(base, delta){
  const r = normalizarInv(base);
  for(const [k,v] of Object.entries(delta||{})) if(k in r) r[k] = redondear(Math.max(0, r[k]+v));
  return r;
}

function listaOrdenes(){ return Object.values(ordenes).sort((a,b)=>a.creada-b.creada); }
function listaVentas(){ return Object.values(ventas).sort((a,b)=>a.creada-b.creada); }
function listaHistorial(){ return Object.values(historial).sort((a,b)=>b.cerrada-a.cerrada); }

function avOrd(){ cbOrdenes(listaOrdenes()); }
function avInv(){ cbInv(Object.assign({}, inventario)); }
function avVen(){ cbVentas(listaVentas(), numero); }
function avHis(){ cbHist(listaHistorial()); }

/* ============================================================
   Driver LOCAL
   ============================================================ */
const Local = {
  canal:null,

  iniciar(){
    this.leer();
    try{
      this.canal = new BroadcastChannel(CANAL);
      this.canal.onmessage = () => { this.leer(); avOrd(); avInv(); avVen(); avHis(); };
    }catch(e){}
    window.addEventListener("storage", e => {
      if(Object.values(K).includes(e.key)){ this.leer(); avOrd(); avInv(); avVen(); avHis(); }
    });
    cbEstado({ modo:"local", conectado:true });
    avOrd(); avInv(); avVen(); avHis();
  },

  leer(){
    const j = (k, def) => { try{ return JSON.parse(localStorage.getItem(k)) ?? def; }catch(e){ return def; } };
    ordenes    = j(K.ord, {});
    inventario = normalizarInv(j(K.inv, {}));
    ventas     = j(K.ven, {});
    historial  = j(K.his, {});
    numero     = j(K.num, 0) || 0;
  },

  escribir(){
    try{
      localStorage.setItem(K.ord, JSON.stringify(ordenes));
      localStorage.setItem(K.inv, JSON.stringify(inventario));
      localStorage.setItem(K.ven, JSON.stringify(ventas));
      localStorage.setItem(K.his, JSON.stringify(historial));
      localStorage.setItem(K.num, JSON.stringify(numero));
    }catch(e){}
    try{ if(this.canal) this.canal.postMessage("cambio"); }catch(e){}
  },

  guardarOrden(o){ ordenes[o.id]=o; this.escribir(); avOrd(); },
  quitarOrden(id){ delete ordenes[id]; this.escribir(); avOrd(); },
  cambiarInv(d){ this.leer(); inventario = aplicar(inventario,d); this.escribir(); avInv(); },

  guardarVenta(v){ this.leer(); ventas[v.id]=v; numero = Math.max(numero, v.numero); this.escribir(); avVen(); },
  quitarVenta(id){ this.leer(); delete ventas[id]; this.escribir(); avVen(); },
  siguienteNumero(){ this.leer(); numero++; this.escribir(); return numero; },

  archivar(j){ this.leer(); historial[j.id]=j; ventas={}; numero=0; this.escribir(); avVen(); avHis(); }
};

/* ============================================================
   Driver NUBE — Firebase Realtime Database
   ============================================================ */
const Nube = {
  db:null, fb:null,

  async iniciar(){
    cbEstado({ modo:"nube", conectado:false, texto:"Conectando…" });

    const [{ initializeApp }, rtdb] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js")
    ]);
    this.fb = rtdb;
    this.db = rtdb.getDatabase(initializeApp(CFG.firebase));

    const on = (ruta, fn) => rtdb.onValue(rtdb.ref(this.db, ruta), s => fn(s.val()));

    on(".info/connected", v => cbEstado({ modo:"nube", conectado: v === true }));
    on(RAIZ + "/ordenes",           v => { ordenes    = v || {};              avOrd(); });
    on(RAIZ + "/inventario",        v => { inventario = normalizarInv(v);     avInv(); });
    on(RAIZ + "/jornada/ventas",    v => { ventas     = v || {};              avVen(); });
    on(RAIZ + "/jornada/numero",    v => { numero     = v || 0;               avVen(); });
    on(RAIZ + "/historial",         v => { historial  = v || {};              avHis(); });
  },

  ref(r){ return this.fb.ref(this.db, RAIZ + r); },

  guardarOrden(o){ ordenes[o.id]=o; avOrd(); this.fb.set(this.ref("/ordenes/"+o.id), o).catch(()=>{}); },
  quitarOrden(id){ delete ordenes[id]; avOrd(); this.fb.remove(this.ref("/ordenes/"+id)).catch(()=>{}); },

  cambiarInv(d){
    this.fb.runTransaction(this.ref("/inventario"), actual => aplicar(actual, d))
      .catch(() => { inventario = aplicar(inventario, d); avInv(); });
  },

  guardarVenta(v){ ventas[v.id]=v; avVen(); this.fb.set(this.ref("/jornada/ventas/"+v.id), v).catch(()=>{}); },
  quitarVenta(id){ delete ventas[id]; avVen(); this.fb.remove(this.ref("/jornada/ventas/"+id)).catch(()=>{}); },

  siguienteNumero(){
    numero = numero + 1;                 // provisional, la nube confirma
    this.fb.runTransaction(this.ref("/jornada/numero"), n => (n || 0) + 1).catch(()=>{});
    return numero;
  },

  archivar(j){
    this.fb.set(this.ref("/historial/"+j.id), j).catch(()=>{});
    this.fb.remove(this.ref("/jornada")).catch(()=>{});
    ventas = {}; numero = 0; avVen();
  }
};

/* ============================================================
   Interfaz pública
   ============================================================ */
window.Sync = {
  async iniciar(op){
    cbOrdenes = op.onOrdenes    || cbOrdenes;
    cbInv     = op.onInventario || cbInv;
    cbVentas  = op.onVentas     || cbVentas;
    cbHist    = op.onHistorial  || cbHist;
    cbEstado  = op.onEstado     || cbEstado;
    inventario = invVacio();

    if(CFG.firebase && CFG.firebase.databaseURL){
      driver = Nube;
      try{ await Nube.iniciar(); }
      catch(e){
        console.warn("Nube no disponible, modo local:", e);
        driver = Local; Local.iniciar();
        cbEstado({ modo:"local", conectado:true, texto:"Nube falló — modo local" });
      }
    } else {
      driver = Local; Local.iniciar();
    }
  },

  /* ---------- órdenes de cocina ---------- */
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
    listaOrdenes().forEach(o => {
      if(o.estado === "entregado" && o.creada < limite) driver.quitarOrden(o.id);
    });
  },
  ordenes: listaOrdenes,

  /* ---------- inventario ---------- */
  inventario(){ return Object.assign({}, inventario); },
  sumarInventario(c){ driver.cambiarInv(c); },
  consumirInventario(r){ const d={}; for(const [k,v] of Object.entries(r)) d[k]=-v; driver.cambiarInv(d); },
  devolverInventario(r){ driver.cambiarInv(r); },
  vaciarInventario(){ const d={}; window.INSUMOS.forEach(i=>d[i.id]=-1e9); driver.cambiarInv(d); },
  hayInventario(){ return Object.values(inventario).some(v => v > 0); },
  alcanzaPara(receta, comprometido){
    let min = Infinity;
    for(const [ins, cant] of Object.entries(receta)){
      const hay = (inventario[ins]||0) - ((comprometido && comprometido[ins])||0);
      min = Math.min(min, Math.floor(hay/cant));
    }
    return min === Infinity ? 999 : min;
  },

  /* ---------- ventas del día ---------- */
  siguienteNumero(){ return driver.siguienteNumero(); },

  registrarVenta({ numero, items, total, hora }){
    const v = { id:nuevoId(), numero, items, total, hora, creada:Date.now() };
    driver.guardarVenta(v);
    return v;
  },

  quitarUltimaVenta(){
    const l = listaVentas();
    if(!l.length) return null;
    const v = l[l.length-1];
    driver.quitarVenta(v.id);
    return v;
  },

  ventas: listaVentas,

  /* ---------- cierre ---------- */
  archivarJornada({ etiqueta, fecha, caja }){
    const l = listaVentas();
    if(!l.length) return null;
    const total = redondear(l.reduce((s,v)=>s+v.total, 0));
    const porProd = {};
    l.forEach(v => v.items.forEach(({id,q}) => porProd[id] = (porProd[id]||0)+q));

    const j = {
      id: nuevoId(),
      fecha, etiqueta,
      cerrada: Date.now(),
      total,
      clientes: l.length,
      ticket: redondear(total / l.length),
      porProd,
      caja: (caja === null || caja === undefined) ? null : redondear(caja),
      diferencia: (caja === null || caja === undefined) ? null : redondear(caja - total),
      ventas: l.map(v => ({ numero:v.numero, hora:v.hora, total:v.total, items:v.items }))
    };
    driver.archivar(j);
    return j;
  },

  historial: listaHistorial
};

})();
