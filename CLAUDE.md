# BAG STORE SF — contexto para Claude

Catálogo virtual de una boutique de bolsas en San Felipe, Gto. (Steve Madden, Guess, Tommy Hilfiger, Bebe).
Migrado desde una tienda Kyte. El dueño del proyecto escribe en español: responde y escribe commits en español.

## Stack y despliegue

- Sitio estático: `index.html` + CSS + JS vanilla. **Sin dependencias, sin build, sin framework.** No agregues
  npm, bundlers ni librerías sin preguntar.
- Producción: Vercel, conectado a GitHub. Cada push a `main` despliega solo en https://bagstoresf.vercel.app.
  Verifica el despliegue con `gh api repos/IEVN1001-22001664/BagStoreSF/commits/<sha>/status`.
- Servidor local: `python3 -m http.server 4173` y abre http://localhost:4173. Para probar en celular, usa la IP
  de la Mac en la misma red Wi‑Fi.

## Estructura

| Archivo | Qué contiene |
| --- | --- |
| `assets/data/catalog.js` | **Fuente de verdad.** `window.BAGSTORE = { store, products }`. Contacto, dirección y los 40 productos |
| `assets/js/app.js` | Filtros, búsqueda, favoritos (localStorage), ficha de producto, paginación de 24, enlaces `#producto-NN` |
| `assets/css/styles.css` | Tokens en `:root`, componentes y la regla de menos movimiento al final |
| `assets/img/products/` | `NN-slug-K.webp` (máx. 1000px) y `NN-slug-K-sm.webp` (460px) para la cuadrícula |
| `dev/` | Selector break-ui (solo desarrollo, excluido de Vercel con `.vercelignore`) |

Producto: `{ ref: "23", name, brand | null, category, price (MXN, puede traer centavos), stock | null, images: [{ src, sm, w, h }] }`.
Categorías: `crossbody`, `hombro`, `carteras`, `munequeras`, `pequenos`, `fragancias`. Una categoría nueva aparece sola como filtro.

Reglas de datos que la UI ya maneja; no las rompas:
- `stock: 0` se muestra como agotada (al final, atenuada, botón "Avísame si vuelve"). `stock: 1` = "Pieza única".
- Precio `null` o `0` = "Consultar precio". Nunca muestres `$0`.
- `images: []` o una foto rota usan el logo como respaldo.
- El contacto sale de `store.whatsapp` (primero) o `store.instagram`. Si ambos están vacíos, el botón lleva a Maps.

## Diseño

Boutique editorial. La paleta sale del logo: ciruela `--plum #4b2370` / `--plum-deep #2a1240`, lavanda de marca
`--lavender #aa83d0`, rosa empolvado `--blush`, fondo crema `--cream #fbf8f4`. Tipografías: Fraunces (títulos)
y Manrope (texto), cargadas desde Google Fonts. Usa siempre los tokens de `:root`; no metas colores sueltos.

Skills que el usuario pidió usar en el frontend: **emil-design-eng** y **mobile-native**. En la práctica:
- Anima solo `transform` y `opacity`. Usa las curvas `--ease-out`, `--ease-in-out` y `--ease-drawer`, nunca `ease-in`.
  La interfaz se anima en menos de 300ms.
- Todo lo presionable tiene `:active` con `scale(0.97)`. Los `:hover` van dentro de `@media (hover: hover) and (pointer: fine)`.
- Los inputs llevan `font-size: 16px` y nada de `user-scalable=no`. Usa `env(safe-area-inset-*)` en barras fijas,
  `dvh`/`svh` en vez de `vh`, y `overscroll-behavior: contain` en zonas con scroll.
- Respeta `prefers-reduced-motion` (bloque al final de `styles.css`).
- Las acciones de teclado (Escape) no se animan.

## Pruebas

- **break-ui:** `http://localhost:4173/dev/break-ui.html?data=worst` con los estados `demo | worst | empty | one | huge | nophoto`.
  Carga el `index.html` real y solo cambia los datos (`dev/fixtures.js`). Antes de cerrar un cambio de UI, revisa
  todos los estados a 320px y 1440px y confirma que no haya errores en la consola ni scroll horizontal.
- Playwright y Chromium sirven para capturas. Los ajustes de mobile-native (hover pegado, notch, teclado, zoom)
  solo se confirman en un teléfono real.

## Origen de los datos (Kyte)

- Tienda: `httpswwwinstagramcombagstoresfmdxtc.kyte.site` (protegida por Cloudflare: usa un navegador real, no curl).
- API de productos: `kyte-query-public.kyte.site/api/product/jK9Ig7FOs3VeTM?isCatalog=true&limit=100…`.
  Solo responde dentro del navegador de la tienda; intercepta la petición con Playwright y cambia `limit=24` a `limit=100`.
- Las fotos originales se descargan de `firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/<uid>%2F<archivo>?alt=media`.
  El CDN `images-cdn.kyte.site` sirve las mismas rutas.
- Correcciones aplicadas al importar: "Steve Medden" → "Steve Madden", "Tajetero" → "Tarjetero",
  "Shoulder bag" → "Shoulder Bag" y recorte de espacios. La marca y la categoría se deducen del nombre.

## Pendientes conocidos

- Hay nombres repetidos (11 "Cartera Muñequera Steve Madden"); hoy solo los distingue `ref`. Lo ideal es agregar el color.
- El Instagram de Kyte estaba mal capturado; `store.instagram` está vacío hasta tener el usuario correcto.
- El banner de Kyte es de baja resolución (458×284) y no se usa.
- Falta probar en un teléfono real (arrastrar para cerrar la ficha, notch, teclado).
