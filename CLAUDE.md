# BAG STORE SF — contexto para Claude

Catálogo virtual de una boutique de bolsas en San Felipe, Gto. (Steve Madden, Guess, Tommy Hilfiger, Bebe).
Migrado desde una tienda Kyte. El dueño del proyecto escribe en español: responde y escribe commits en español.

## Stack y despliegue

- Sitio estático: `index.html` + CSS + JS vanilla. **Sin dependencias, sin build, sin framework.** No agregues
  npm, bundlers ni librerías sin preguntar. Única excepción aprobada: `assets/vendor/qrcode-generator-1.4.4.js`
  (MIT, Kazuhiko Arase), copiada tal cual y cargada solo al mostrar un QR.
- Producción: Vercel, conectado a GitHub. Cada push a `main` despliega solo en https://bagstoresf.vercel.app.
  Verifica el despliegue con `gh api repos/IEVN1001-22001664/BagStoreSF/commits/<sha>/status`.
- Servidor local: `python3 -m http.server 4173` y abre http://localhost:4173. Para probar en celular, usa la IP
  de la Mac en la misma red Wi‑Fi.

## Estructura

| Archivo | Qué contiene |
| --- | --- |
| `assets/js/config.js` | URL de Supabase y clave publicable (la usan el catálogo y el panel) |
| `admin/` | Panel en `/admin/` (rutas `#piezas`, `#pieza/<uuid>`, `#nueva`, `#pedidos`, `#pedido/<uuid>`, `#tienda`): `orders.js` (lista de pedidos, detalle y cobro), `api.js` (REST, Storage y sesión, sin SDK), `admin.js` (lista con − n + y guardado automático, datos de la tienda y categorías), `editor.js` (editar/crear/eliminar pieza), `images.js` (redimensiona fotos en el navegador), `admin.css`, PWA: `manifest.webmanifest`, `sw.js`, `icons/` |
| `assets/js/data.js` | Carga el catálogo: Supabase (`rpc/catalog`) → copia en localStorage → `catalog.js`. Expone `window.BAGSTORE_READY` |
| `assets/data/catalog.js` | **Respaldo** (ya no es la fuente de verdad): `window.BAGSTORE = { store, products }` con los 40 productos de la migración |
| `assets/js/app.js` | Filtros, búsqueda, favoritos (localStorage), ficha de producto con selector de color, paginación de 24, enlaces `#producto-NN` |
| `assets/js/cart.js` | Carrito (localStorage), crea el pedido con `rpc/create_order`, pantalla del pedido con QR, "Mis pedidos", ruta `#pedido/<uuid>` |
| `assets/css/styles.css` | Tokens en `:root`, componentes y la regla de menos movimiento al final |
| `assets/img/products/` | `NN-slug-K.webp` (máx. 1000px) y `NN-slug-K-sm.webp` (460px) para la cuadrícula |
| `dev/` | Solo desarrollo, excluido de Vercel: break-ui (`break-ui.html`), el panel con Supabase simulado (`admin.html`) y el catálogo con carrito simulado (`catalogo.html`) |
| `supabase/` | Migración a Supabase (en curso): esquema, RLS, bucket de fotos y `seed.sql` generado desde `catalog.js`. Ver `supabase/README.md`. Excluido de Vercel |

### Migración a Supabase (en curso)

Plan acordado: Supabase (Postgres + Storage + Auth con correo y contraseña) usado con `fetch` directo, sin SDK ni build.
Proyecto: `https://xspwkmkqeyzbuirjpytp.supabase.co` (la clave publicable está en `data.js`; la `service_role` nunca va al repo).
Fases: 1) esquema y seed ✅ · 2) el catálogo lee `rpc/catalog` con `catalog.js` de respaldo ✅ · 3) `/admin` de
disponibilidad ✅ · 4) edición completa y fotos ✅ (requiere `003_guardar_pieza.sql`) · 5) PWA ✅ (falta la prueba en teléfono real).
Cada pieza tiene colores (`product_colors`) con su propio stock; el stock de la pieza es la suma (o `null`).
El editor guarda con `rpc/save_product` (todo o nada); los ids de pieza, color y foto se generan en el navegador para subir
las fotos antes de guardar. Categorías (pestaña Tienda): el `id` se genera del nombre y no cambia al renombrar;
se guardan con un upsert (`on_conflict=id`) y solo se pueden borrar si ninguna pieza las usa (la llave foránea lo impide).
Los datos ahora se editan en Supabase. No regeneres ni vuelvas a correr `seed.sql`: borra todos los productos y los recarga desde `catalog.js`.
break-ui no consulta la red (`data.js` detecta `window.__BREAKUI_KEY`) y sigue usando `dev/fixtures.js`.

Producto: `{ ref: "23", name, brand | null, category, price (MXN, puede traer centavos), stock | null, images: [{ src, sm, w, h }] }`.
Categorías: `crossbody`, `hombro`, `carteras`, `munequeras`, `pequenos`, `fragancias`. Una categoría nueva aparece sola como filtro.

Reglas de datos que la UI ya maneja; no las rompas:
- `stock: 0` se muestra como agotada (al final, atenuada, botón "Avísame si vuelve"). `stock: 1` = "Pieza única".
- Precio `null` o `0` = "Consultar precio". Nunca muestres `$0`.
- `images: []` o una foto rota usan el logo como respaldo.
- El contacto sale de `store.whatsapp` (primero) o `store.instagram`. Si ambos están vacíos, el botón lleva a Maps.
- Con `store.instagram` lleno aparece el ícono de Instagram en el encabezado y un botón en "Visítanos" (`[data-instagram]`).

### Carrito y pedidos (migración `004_pedidos.sql`)

Flujo: la clienta agrega piezas (eligiendo color) → "Apartar por WhatsApp" crea el pedido (`create_order`, pública,
valida disponibilidad y toma los precios de la base) → recibe un código `BS-XXXX` y un QR → manda el pedido por WhatsApp
→ en tienda la dueña escanea el QR (abre `/admin/#pedido/<uuid>`) o busca el código en Pedidos → "Pagado y entregado"
(`complete_order`) baja el inventario de cada color en una sola transacción; si algo no alcanza, no cambia nada.
Decisiones: el pedido **no aparta** piezas; precio del momento del pedido; vence a los 7 días (se calcula al leer, aún se
puede cobrar); solo nombre opcional; máximo 10 piezas; freno de 30 pedidos por minuto. Listo para un bot de WhatsApp:
código con formato fijo y fecha de cada estado (`created_at`, `paid_at`, `cancelled_at`).
El carrito solo aparece si hay WhatsApp y los datos traen `colors` (Supabase); con `catalog.js` de respaldo se oculta.
En iPhone el QR abre Safari, no la app instalada: la dueña debe iniciar sesión también en Safari, o buscar el código.

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

- **Carrito:** `http://localhost:4173/dev/catalogo.html?state=ok` usa `index.html` real con Supabase simulado
  (`dev/catalog-mock.js`): la #21 tiene tres colores (uno agotado) y la #23 no tiene precio. Estados: `ok | fail | stockout | offline`.
- **Panel:** `http://localhost:4173/dev/admin.html?state=ok` usa `admin/index.html` real con Supabase simulado
  (`dev/admin-mock.js`). Estados: `ok | denied | savefail | offline | empty | slow`. Contraseña `incorrecta` simula
  error de acceso; cualquier otra entra. No uses la cuenta real de la dueña para probar.

- **PWA del panel:** `admin/sw.js` (alcance `/admin/`) va a la red primero y usa su caché solo sin conexión, así
  cada despliegue se ve de inmediato. Solo guarda los archivos de `SHELL`; si agregas o renombras un archivo del panel,
  súmalo ahí y sube `VERSION`. Nunca intercepta Supabase. En el simulador de `dev/` no se registra.
  En iPhone la app instalada tiene su propio almacenamiento: la dueña inicia sesión una vez dentro de la app.

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
- El banner de Kyte es de baja resolución (458×284) y no se usa.
- Falta probar en un teléfono real: arrastrar para cerrar la ficha, notch, teclado, instalar el panel, cámara y fotos HEIC.
