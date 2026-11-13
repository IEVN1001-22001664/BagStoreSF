// Genera supabase/seed.sql a partir de assets/data/catalog.js (la fuente actual).
// Uso:  node supabase/generate-seed.mjs
// Es idempotente: vuelve a cargar todo desde cero (borra productos, colores y fotos).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(`${root}assets/data/catalog.js`, 'utf8'), sandbox);
const { store, products } = sandbox.window.BAGSTORE;

// Mismas etiquetas que CATEGORIES en assets/js/app.js
const CATEGORIES = [
  ['crossbody', 'Crossbody'],
  ['hombro', 'Hombro y Tote'],
  ['carteras', 'Carteras'],
  ['munequeras', 'Muñequeras'],
  ['pequenos', 'Monederos y tarjeteros'],
  ['fragancias', 'Fragancias'],
];

const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : 'null');

const unknown = [...new Set(products.map((p) => p.category))].filter((c) => !CATEGORIES.some(([id]) => id === c));
if (unknown.length) throw new Error(`Categorías sin etiqueta: ${unknown.join(', ')}`);

const lines = [];
lines.push(
  '-- GENERADO por supabase/generate-seed.mjs desde assets/data/catalog.js. No editar a mano.',
  '-- Ejecutar después de las migraciones. Vuelve a cargar el catálogo desde cero.',
  'begin;',
  '',
  'delete from public.products;',
  '',
  `insert into public.store_settings (id, name, tagline, address, maps_url, whatsapp, instagram, currency, theme_color)
values (true, ${q(store.name)}, ${q(store.tagline)}, ${q(store.address)}, ${q(store.mapsUrl)}, ${q(store.whatsapp)}, ${q(store.instagram)}, ${q(store.currency || 'MXN')}, ${q(store.themeColor)})
on conflict (id) do update set name = excluded.name, tagline = excluded.tagline, address = excluded.address,
  maps_url = excluded.maps_url, whatsapp = excluded.whatsapp, instagram = excluded.instagram,
  currency = excluded.currency, theme_color = excluded.theme_color;`,
  '',
  'insert into public.categories (id, label, position) values',
  CATEGORIES.map(([id, label], i) => `  (${q(id)}, ${q(label)}, ${i})`).join(',\n'),
  'on conflict (id) do update set label = excluded.label, position = excluded.position;',
  '',
);

products.forEach((p, i) => {
  // Cada pieza nace con un color "sin especificar" que guarda su stock;
  // la dueña podrá nombrarlo o dividirlo en colores desde el panel.
  lines.push(
    `-- #${p.ref} ${p.name}`,
    `with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values (${q(p.ref)}, ${q(p.name)}, ${q(p.brand)}, ${q(p.category)}, ${n(p.price)}, ${i}, ${q(p.sourceId)})
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, ${n(p.stock)}, 0 from p
)`,
    (p.images || []).length
      ? `insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
${p.images.map((im, k) => `  (${q(im.src)}, ${q(im.sm || im.src)}, ${n(im.w)}, ${n(im.h)}, ${k})`).join(',\n')}
) as v(src, sm, w, h, pos);`
      : 'select 1 from p;',
    '',
  );
});

const maxRef = Math.max(...products.map((p) => Number(p.ref)).filter(Number.isFinite));
lines.push(
  `-- Las piezas nuevas siguen la numeración: #${String(maxRef + 1).padStart(2, '0')} en adelante`,
  `select setval('public.product_ref_seq', ${maxRef});`,
  '',
  'commit;',
  '',
);

writeFileSync(`${root}supabase/seed.sql`, lines.join('\n'));
console.log(`seed.sql: ${products.length} productos, ${products.reduce((s, p) => s + (p.images || []).length, 0)} fotos`);
