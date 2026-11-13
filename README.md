# BAG STORE SF · Catálogo virtual

Prototipo del catálogo en línea de **BAG STORE SF** (San Felipe, Gto.), migrado desde la tienda Kyte.
Incluye los 40 productos reales con sus títulos, precios y fotos.

Es un sitio estático: HTML, CSS y JavaScript, sin dependencias ni paso de compilación.

## Cómo verlo

Opción rápida: abre `index.html` con doble clic.

Opción recomendada (servidor local; así funcionan los enlaces directos y el botón Compartir):

```bash
python3 -m http.server 4173
```

Luego abre <http://localhost:4173>. Para probarlo en tu celular, conéctalo a la misma red Wi‑Fi
y abre `http://IP-DE-TU-MAC:4173`.

## Estructura

```
index.html                 Página principal
assets/css/styles.css      Estilos (tokens de color, animaciones, ajustes móviles)
assets/js/app.js           Filtros, búsqueda, favoritos, ficha de producto
assets/data/catalog.js     Datos de la tienda y de los 40 productos
assets/img/products/       Fotos en WebP (versión grande y -sm para la cuadrícula)
assets/img/brand/          Logo e ícono
```

## Editar el catálogo

Todo vive en `assets/data/catalog.js`:

- **Producto**: `name`, `brand`, `category`, `price` (MXN), `stock` e `images`.
- **Categorías**: `crossbody`, `hombro`, `carteras`, `munequeras`, `pequenos` y `fragancias`.
- **Contacto**: llena `store.whatsapp` (por ejemplo, `"524451234567"`) o `store.instagram`
  (por ejemplo, `"bagstoresf"`). El botón de cada producto cambia solo a
  "Pedir por WhatsApp" o "Escribir por Instagram". Si ambos están vacíos, muestra
  "Apartar en tienda" con la ubicación.

## Funciones

- Hero editorial con abanico de piezas destacadas y franja de marcas en movimiento.
- Filtros por categoría y marca, búsqueda sin importar acentos, orden por precio.
- Favoritos guardados en el navegador.
- Ficha de producto: hoja inferior en móvil (se cierra arrastrando) y modal en escritorio.
  Incluye galería deslizable.
- Enlace directo a cada pieza (`#producto-23`) y botón para compartir.
- Ajustes nativos para móvil: sin destello al tocar, sin zoom en la búsqueda, áreas seguras del notch
  y estados hover solo con mouse.
- Respeta la opción "Reducir movimiento" del sistema.

## Origen de los datos

Los datos se extrajeron el 13/11/2026 de la tienda Kyte. Se hicieron estas correcciones de texto:
"Steve Medden" → "Steve Madden", "Tajetero" → "Tarjetero", "Shoulder bag" → "Shoulder Bag",
y se quitaron espacios sobrantes. La marca y la categoría se dedujeron del nombre de cada producto.
