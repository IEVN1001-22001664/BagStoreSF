/* Supabase simulado para probar el catálogo y el carrito (solo desarrollo; dev/ está en .vercelignore).
   Se carga en dev/catalogo.html después de catalog.js y antes de data.js.
   ?state=ok (default) | fail (create_order falla) | stockout (create_order dice que ya no hay) | offline
   window.__catalogMock = { products, orders, log } */
(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get('state') || 'ok';
  const BASE = window.BAGSTORE_CONFIG.supabaseUrl;
  const real = window.BAGSTORE;
  let n = 0;
  const uid = () => `10000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

  // Igual que catalog() después de la migración 004: cada pieza con sus colores (también el sin nombre)
  const products = real.products.map((p) => ({ ...p, colors: [{ id: uid(), name: null, hex: null, stock: p.stock }] }));
  const p3 = products.find((p) => p.ref === '21');
  if (p3) {
    p3.colors = [
      { id: uid(), name: 'Lila', hex: '#aa83d0', stock: 2 },
      { id: uid(), name: 'Negro', hex: '#1f1426', stock: 0 },
      { id: uid(), name: 'Rosa palo con herrajes dorados', hex: '#f4dde5', stock: null },
    ];
    p3.stock = null;
    p3.images = p3.images.map((im, i) => ({ ...im, color: i === 0 ? p3.colors[0].id : null }));
  }
  const p23 = products.find((p) => p.ref === '23');
  if (p23) p23.price = null; // "Consultar precio"
  const catalog = {
    store: real.store,
    categories: [['crossbody', 'Crossbody'], ['hombro', 'Hombro y Tote'], ['carteras', 'Carteras'], ['munequeras', 'Muñequeras'],
      ['pequenos', 'Monederos y tarjeteros'], ['fragancias', 'Fragancias']].map(([id, label]) => ({ id, label })),
    products,
  };

  const orders = new Map();
  const log = [];
  window.__catalogMock = { products, orders, log };

  const json = (status, body) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const realFetch = window.fetch.bind(window);

  function createOrder({ items, customer_name }) {
    if (mode === 'fail') return json(500, { message: 'boom' });
    if (mode === 'stockout') return json(400, { code: 'P0001', message: 'La pieza #03 ya no tiene esa cantidad disponible (quedan 0).' });
    const lines = [];
    let total = 0, unpriced = false;
    for (const it of items) {
      const p = products.find((x) => x.colors.some((c) => c.id === it.color));
      const c = p?.colors.find((x) => x.id === it.color);
      if (!c) return json(400, { message: 'Una pieza del carrito ya no existe.' });
      if (c.stock !== null && c.stock < it.qty) return json(400, { message: `La pieza #${p.ref} ${c.name ? c.name + ' ' : ''}ya no tiene esa cantidad disponible (quedan ${c.stock}).` });
      lines.push({ id: uid(), ref: p.ref, name: p.name, colorName: c.name, price: p.price || null, qty: it.qty, image: p.images[0]?.sm || null, stockNow: c.stock, colorExists: true });
      if (p.price) total += p.price * it.qty; else unpriced = true;
    }
    const code = 'BS-' + Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
    const now = new Date();
    const o = { id: uid(), code, customerName: customer_name?.trim() || null, status: 'pending', total, hasUnpriced: unpriced,
      createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 7 * 864e5).toISOString(), paidAt: null, cancelledAt: null, items: lines };
    orders.set(o.id, o);
    return json(200, o);
  }

  window.fetch = async (input, init = {}) => {
    const url = String(input);
    if (!url.startsWith(BASE)) return realFetch(input, init);
    const path = url.slice(BASE.length);
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    log.push(`${init.method || 'GET'} ${path} ${init.body || ''}`);
    await new Promise((r) => setTimeout(r, 200));
    if (mode === 'offline') throw new TypeError('Failed to fetch');
    if (path === '/rest/v1/rpc/catalog') return json(200, structuredClone(catalog));
    if (path === '/rest/v1/rpc/create_order') return createOrder(body);
    if (path === '/rest/v1/rpc/get_order') return orders.has(body.oid) ? json(200, orders.get(body.oid)) : json(200, null);
    return json(404, { message: `mock: ruta no simulada ${path}` });
  };
})();
