/* ============================================================
   Doña Papa — configuración de sincronización

   MODO NUBE ACTIVO. La caja y la cocina se sincronizan entre
   teléfonos distintos a través de Firebase.

   Si algún día quieres volver al modo local (las dos pantallas
   solo en el mismo dispositivo), cambia firebase por null.

   Estas claves NO son secretas: van dentro de toda app web que
   use Firebase y cualquiera puede verlas desde el navegador.
   Lo que protege el acceso son las reglas de la base de datos.
   ============================================================ */

window.DONAPAPA_CONFIG = {

  firebase: {
    apiKey: "AIzaSyDNrfrC0a0WwQNPWT7nT-i4UoS_uWXeB04",
    authDomain: "dona-papa-425a0.firebaseapp.com",
    databaseURL: "https://dona-papa-425a0-default-rtdb.firebaseio.com",
    projectId: "dona-papa-425a0",
    storageBucket: "dona-papa-425a0.firebasestorage.app",
    messagingSenderId: "454720558168",
    appId: "1:454720558168:web:56dac7a23208a0a3e1e62d"
  },

  // Si algún día tienes dos puestos, cambia esto en cada par de
  // teléfonos para que no se mezclen las órdenes.
  puesto: "casa"
};
