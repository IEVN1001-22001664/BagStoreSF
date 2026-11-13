/* Supabase simulado para probar el panel (solo desarrollo; dev/ está en .vercelignore).
   Se carga en dev/admin.html antes de admin/api.js e intercepta fetch hacia Supabase.
   ?state=ok (default) | denied | savefail | offline | empty | slow
   Contraseña "incorrecta" simula credenciales malas; cualquier otra entra.
   window.__mockLog guarda cada petición; window.__mockDb el estado simulado. */
(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get('state') || 'ok';
  const BASE = window.BAGSTORE_CONFIG.supabaseUrl;
  const real = window.BAGSTORE.products;
  let n = 0;
  const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const img = (im, i, color = null) => ({ id: uid(), src: im.src, sm: im.sm, width: im.w, height: im.h, color_id: color, position: i });

  const db = {
    store: { name: 'BAG STORE SF', tagline: 'Bags · Style · Elegance', address: 'Calle Altamirano #132, San Felipe, Gto.',
      maps_url: 'https://www.google.com/maps/search/?api=1&query=Calle+Altamirano+132', whatsapp: '527299603872', instagram: null },
    categories: [['crossbody', 'Crossbody'], ['hombro', 'Hombro y Tote'], ['carteras', 'Carteras'], ['munequeras', 'Muñequeras'],
      ['pequenos', 'Monederos y tarjeteros'], ['fragancias', 'Fragancias']].map(([id, label]) => ({ id, label })),
    files: new Set(),
    products: [],
  };
  if (mode !== 'empty') {
    db.products = real.map((p, i) => ({
      id: uid(), ref: p.ref, name: p.name, brand: p.brand, price: p.price, status: 'active', position: i,
      category_id: p.category, description: null,
      product_colors: [{ id: uid(), name: null, hex: null, stock: p.stock, position: 0 }],
      product_images: p.images.map((im, k) => img(im, k)),
    }));
    const negro = uid(), rosa = uid();
    db.products.splice(1, 0,
      { id: uid(), ref: '41', name: 'Crossbody Steve Madden Bvital con Monedero Desmontable Edición Rosa Palo', brand: 'Steve Madden', price: 1899.5, status: 'active', position: 1,
        category_id: 'crossbody', description: 'Piel sintética.\nCorrea ajustable.',
        product_colors: [
          { id: negro, name: 'Negro', hex: '#1f1426', stock: 3, position: 0 },
          { id: rosa, name: 'Rosa palo', hex: '#f4dde5', stock: 1, position: 1 },
          { id: uid(), name: 'Cognac con herrajes dorados y correa intercambiable', hex: null, stock: 0, position: 2 },
        ],
        product_images: [img(real[3].images[0], 0, rosa), img(real[22].images[0], 1, negro)] },
      { id: uid(), ref: '42', name: 'Mini', brand: null, price: null, status: 'archived', position: 2, category_id: 'carteras', description: null,
        product_colors: [{ id: uid(), name: null, hex: null, stock: null, position: 0 }], product_images: [] },
      { id: uid(), ref: '43', name: 'Guess HWPG787906-Noelle-Satchel-Logo-Peony-Multi', brand: 'Guess', price: 12450, status: 'active', position: 3,
        category_id: 'mochilas', description: null,
        product_colors: [{ id: uid(), name: null, hex: null, stock: 998, position: 0 }],
        product_images: [{ id: uid(), src: 'assets/img/products/no-existe.webp', sm: 'assets/img/products/no-existe-sm.webp', width: 600, height: 800, color_id: null, position: 0 }] },
      { id: uid(), ref: '44', name: 'Pieza sin colores', brand: 'Bebe', price: 500, status: 'active', position: 4, category_id: 'carteras', description: null,
        product_colors: [], product_images: [] },
    );
  }
  window.__mockDb = db;

  const realFetch = window.fetch.bind(window);
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const json = (status, body) => new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const sorted = (p) => ({ ...structuredClone(p),
    product_colors: [...p.product_colors].sort((a, b) => a.position - b.position),
    product_images: [...p.product_images].sort((a, b) => a.position - b.position) });

  function saveProduct(p) {
    if (!p.colors?.length) return json(400, { message: 'La pieza necesita al menos un color o una disponibilidad.' });
    if (!db.categories.some((c) => c.id === p.category)) return json(409, { message: 'insert or update on table "products" violates foreign key constraint "products_category_id_fkey"' });
    const names = p.colors.map((c) => c.name?.toLowerCase()).filter(Boolean);
    if (new Set(names).size !== names.length) return json(409, { message: 'duplicate key value violates unique constraint "product_colors_name_uniq"' });
    let prod = db.products.find((x) => x.id === p.id);
    const removed = [];
    if (!prod) {
      const ref = String(Math.max(0, ...db.products.map((x) => Number(x.ref))) + 1).padStart(2, '0');
      prod = { id: p.id, ref, position: Math.min(0, ...db.products.map((x) => x.position)) - 1, product_colors: [], product_images: [] };
      db.products.unshift(prod);
    }
    const keep = new Set(p.images.map((i) => i.id));
    prod.product_images.filter((i) => !keep.has(i.id)).forEach((i) => removed.push(i.src, i.sm));
    Object.assign(prod, { name: p.name, brand: p.brand, category_id: p.category, price: p.price, description: p.description, status: p.status || 'active' });
    prod.product_colors = p.colors.map((c, i) => ({ id: c.id, name: c.name, hex: c.hex, stock: c.stock, position: i }));
    prod.product_images = p.images.map((i, k) => ({ id: i.id, src: i.src, sm: i.sm, width: i.w, height: i.h, color_id: i.color, position: k }));
    return json(200, { id: prod.id, ref: prod.ref, removed });
  }

  window.__mockLog = [];
  window.fetch = async (input, init = {}) => {
    const url = String(input);
    if (!url.startsWith(BASE)) return realFetch(input, init);
    const path = url.slice(BASE.length);
    const method = (init.method || 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body ?? null;
    window.__mockLog.push(`${method} ${path}${typeof init.body === 'string' ? ' ' + init.body : body ? ` [${body.type} ${body.size}B]` : ''}`);
    await delay(mode === 'slow' ? 1500 : 200);
    if (mode === 'offline') throw new TypeError('Failed to fetch');

    if (path.startsWith('/auth/v1/token?grant_type=password')) {
      if (body.password === 'incorrecta') return json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return json(200, { access_token: 'mock-access', refresh_token: 'mock-refresh', expires_in: 3600, user: { email: body.email } });
    }
    if (path.startsWith('/auth/v1/token?grant_type=refresh_token')) return json(200, { access_token: 'mock-access-2', refresh_token: 'mock-refresh-2', expires_in: 3600 });
    if (path.startsWith('/auth/v1/logout')) return json(204);
    if (path === '/rest/v1/rpc/is_admin') return json(200, mode !== 'denied');
    if (mode === 'savefail' && method !== 'GET') return json(500, { message: 'boom' });

    if (path.startsWith('/rest/v1/products?') && method === 'GET') {
      const id = path.match(/[?&]id=eq\.([^&]+)/)?.[1];
      const list = [...db.products].sort((a, b) => a.position - b.position || a.ref.localeCompare(b.ref));
      return json(200, (id ? list.filter((p) => p.id === decodeURIComponent(id)) : list).map(sorted));
    }
    if (path.startsWith('/rest/v1/categories?')) return json(200, db.categories);
    if (path.startsWith('/rest/v1/store_settings?')) {
      if (method === 'PATCH') Object.assign(db.store, body);
      return json(200, [structuredClone(db.store)]);
    }
    if (path.startsWith('/rest/v1/product_colors?') && method === 'PATCH') {
      const id = decodeURIComponent(path.match(/id=eq\.([^&]+)/)[1]);
      const c = db.products.flatMap((p) => p.product_colors).find((x) => x.id === id);
      if (!c) return json(200, []);
      c.stock = body.stock;
      return json(200, [{ id: c.id, stock: c.stock }]);
    }
    if (path === '/rest/v1/rpc/save_product') return saveProduct(body.p);
    if (path === '/rest/v1/rpc/delete_product') {
      const i = db.products.findIndex((p) => p.id === body.pid);
      if (i < 0) return json(404, { message: 'Esa pieza ya no existe.' });
      const [p] = db.products.splice(i, 1);
      return json(200, { removed: p.product_images.flatMap((x) => [x.src, x.sm]) });
    }
    if (path.startsWith('/storage/v1/object/products/') && method === 'POST') {
      db.files.add(path.slice('/storage/v1/object/products/'.length));
      return json(200, { Key: path });
    }
    if (path === '/storage/v1/object/products' && method === 'DELETE') {
      body.prefixes.forEach((f) => db.files.delete(f));
      return json(200, body.prefixes.map((name) => ({ name })));
    }
    return json(404, { message: `mock: ruta no simulada ${method} ${path}` });
  };
})();
