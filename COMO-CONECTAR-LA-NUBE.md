# Doña Papa — las dos pantallas

## Cómo funciona el reparto de tareas

| | Caja (tu teléfono) | Cocina (teléfono de adentro) |
|---|---|---|
| Cobrar | ✅ | — |
| Mandar la orden | ✅ automático | — |
| Marcar "ya está" | — | ✅ |
| **Cargar el inventario** | — | ✅ **solo aquí** |
| Ver lo que queda | ✅ solo mirar | ✅ |
| Cierre de caja e historial | ✅ | — |

**El inventario lo carga la cocina** porque es quien pela la papa y abre los
paquetes. La caja solo lo consume: cada venta descuenta sola según la receta
de cada porción, y las dos pantallas ven el mismo número al instante.

Todo vive en Firebase, así que **no se pierde** aunque cierres las apps, se
apague un teléfono o cambies de celular.

---

## Ya está configurado

Firebase quedó conectado (proyecto `dona-papa-425a0`). El archivo `config.js`
ya tiene las claves. **No hay que tocar nada más.**

Si alguna vez quieres volver al modo local (las dos pantallas solo en el mismo
dispositivo, sin internet), cambia en `config.js`:

```js
firebase: null,
```

---

## Publicar en GitHub Pages

1. Entra a **https://github.com** y crea un repositorio nuevo. Ponle `dona-papa`
   y déjalo **público** (Pages gratis solo funciona en repos públicos)
2. En la página del repo vacío, clic en **uploading an existing file**
3. Arrastra **todos los archivos de la carpeta `app`** (no la carpeta, los archivos
   sueltos: `index.html`, `cocina.html`, `sync.js`, `config.js`, los `.json`,
   los `.png`, `sw.js`)
4. Clic en **Commit changes**
5. Ve a **Settings** (arriba) → **Pages** (menú izquierdo)
6. En *Source* elige **Deploy from a branch**; en *Branch* elige **main** y carpeta
   **/ (root)**. Clic en **Save**
7. Espera 1 o 2 minutos y recarga. Arriba te muestra la dirección:

```
https://TU-USUARIO.github.io/dona-papa/
```

### Las dos direcciones

| Pantalla | Dirección |
|---|---|
| Caja | `https://TU-USUARIO.github.io/dona-papa/` |
| Cocina | `https://TU-USUARIO.github.io/dona-papa/cocina.html` |

En cada teléfono: menú del navegador **⋮ → Agregar a pantalla de inicio**.
Quedan con ícono propio, a pantalla completa y funcionando sin señal.

> **Para actualizar más adelante:** sube los archivos nuevos al repositorio y
> sube el número en la primera línea de `sw.js` (`donapapa-v1` → `donapapa-v2`).
> Si no lo cambias, los teléfonos siguen mostrando la versión vieja que tienen
> guardada.

---

## El flujo de una noche

**Antes de abrir**, en la cocina: pestaña de abajo, escribir lo que se trajo
(libras de papa, salchichas, panes, gaseosas, tarrinas) y tocar
**Cargar al inventario**. Se suma a lo que ya quedaba.

**Durante la venta:**

1. Cobras un pedido → sale al instante en la cocina con su número
2. La cocina prepara y toca **YA ESTÁ**
3. A ti te suena, te vibra y aparece un globito rojo en la pestaña **Cocina**
4. Entregas y tocas **Entregada**

Las gaseosas no se mandan a cocina — no hay nada que cocinar, pero sí se
descuentan del inventario.

Si una orden pasa de 8 minutos, la cocina la marca en rojo sola.

**Al cerrar:** pestaña **Cierre** en la caja. Cuentas el efectivo, la app te dice
si cuadra, y guardas la jornada en el historial.

---

## Cosas que conviene saber

**Si se cae el internet:** sigues cobrando normal. Las ventas, el cierre y el
historial se guardan siempre en tu teléfono. Lo que se pausa es el aviso a la
cocina y el descuento de inventario, y se pone al día cuando vuelve la señal.

**Si el inventario se descuadra** (serviste sin registrar, se dañó algo): en la
cocina, botón **Corregir: poner el inventario en cero**, y vuelves a cargar lo
que realmente hay. Pide dos toques para que no pase por accidente.

**El plan gratis alcanza de sobra.** Firebase da 100 conexiones simultáneas y
1 GB. Tú usas 2 conexiones y unos kilobytes por noche. No pide tarjeta.

**Las reglas dejan la base abierta.** Para lo que guarda —"orden #12: dos
personales"— no es problema: no hay datos personales ni dinero. Si algún día
quieres cerrarla, se puede agregar autenticación anónima.

**Para dos puestos:** cambia `puesto: "casa"` por otro nombre en el par de
teléfonos del segundo puesto. Las órdenes y el inventario no se mezclan.
