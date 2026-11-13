/* Supabase simulado para probar el panel (solo desarrollo; dev/ está en .vercelignore).
   Se carga en dev/admin.html antes de admin/api.js e intercepta fetch hacia Supabase.
   ?state=ok (default) | denied | savefail | offline | empty | slow
   Contraseña "incorrecta" simula credenciales malas; cualquier otra entra. */
(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get('state') || 'ok';
  const BASE = window.BAGSTORE_CONFIG.supabaseUrl;
  const real = window.BAGSTORE.products;
  let n = 0;
  const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

  const products = mode === 'empty' ? [] : real.map((p, i) => ({
    id: uid(), ref: p.ref, name: p.name, brand: p.brand, price: p.price, status: 'active', position: i,
    product_colors: [{ id: uid(), name: null, hex: null, stock: p.stock, position: 0 }],
    product_images: p.images.slice(0, 1).map((im) => ({ sm: im.sm, position: 0 })),
  }));
  if (mode !== 'empty') {
    products.splice(1, 0,
      { id: uid(), ref: '41', name: 'Crossbody Steve Madden Bvital con Monedero Desmontable Edición Rosa Palo', brand: 'Steve Madden', price: 1899.5, status: 'active', position: 1,
        product_colors: [
          { id: uid(), name: 'Negro', hex: '#1f1426', stock: 3, position: 0 },
          { id: uid(), name: 'Rosa palo', hex: '#f4dde5', stock: 1, position: 1 },
          { id: uid(), name: 'Cognac con herrajes dorados y correa intercambiable', hex: null, stock: 0, position: 2 },
        ],
        product_images: real[3].images.slice(0, 1).map((im) => ({ sm: im.sm, position: 0 })) },
      { id: uid(), ref: '42', name: 'Mini', brand: null, price: null, status: 'archived', position: 2,
        product_colors: [{ id: uid(), name: null, hex: null, stock: null, position: 0 }], product_images: [] },
      { id: uid(), ref: '43', name: 'Guess HWPG787906-Noelle-Satchel-Logo-Peony-Multi', brand: 'Guess', price: 12450, status: 'active', position: 3,
        product_colors: [{ id: uid(), name: null, hex: null, stock: 998, position: 0 }],
        product_images: [{ sm: 'assets/img/products/no-existe-sm.webp', position: 0 }] },
      { id: uid(), ref: '44', name: 'Pieza sin colores', brand: 'Bebe', price: 500, status: 'active', position: 4,
        product_colors: [], product_images: [] },
    );
  }
  const colors = new Map(products.flatMap((p) => p.product_colors.map((c) => [c.id, c])));

  const realFetch = window.fetch.bind(window);
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const json = (status, body) => new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  window.__mockLog = [];
  window.fetch = async (input, init = {}) => {
    const url = String(input);
    if (!url.startsWith(BASE)) return realFetch(input, init);
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;
    window.__mockLog.push(`${method} ${url.slice(BASE.length)}${body ? ' ' + JSON.stringify(body) : ''}`);
    await delay(mode === 'slow' ? 1500 : 250);
    if (mode === 'offline') throw new TypeError('Failed to fetch');

    if (url.includes('/auth/v1/token?grant_type=password')) {
      if (body.password === 'incorrecta') return json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return json(200, { access_token: 'mock-access', refresh_token: 'mock-refresh', expires_in: 3600, user: { email: body.email } });
    }
    if (url.includes('/auth/v1/token?grant_type=refresh_token')) return json(200, { access_token: 'mock-access-2', refresh_token: 'mock-refresh-2', expires_in: 3600 });
    if (url.includes('/auth/v1/logout')) return json(204);
    if (url.includes('/rest/v1/rpc/is_admin')) return json(200, mode !== 'denied');
    if (url.includes('/rest/v1/products?')) return json(200, structuredClone(products));
    if (url.includes('/rest/v1/product_colors?') && method === 'PATCH') {
      if (mode === 'savefail') return json(500, { message: 'boom' });
      const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)[1]);
      const c = colors.get(id);
      if (!c) return json(200, []);
      c.stock = body.stock;
      return json(200, [{ id: c.id, stock: c.stock }]);
    }
    return json(404, { message: `mock: ruta no simulada ${url}` });
  };
})();
