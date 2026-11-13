/* BAG STORE SF — Carga del catálogo (vanilla JS, sin dependencias)
   Orden: Supabase → última copia buena guardada en este navegador → assets/data/catalog.js.
   Expone window.BAGSTORE_READY: una promesa con { store, categories?, products, source }. */
(() => {
  'use strict';

  const { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY } = window.BAGSTORE_CONFIG || {};
  const CACHE_KEY = 'bagstore:catalog:v1';
  const TIMEOUT_MS = 5000;

  const bundled = window.BAGSTORE; // catalog.js (o los datos de break-ui en desarrollo)
  const valid = (d) => !!d && typeof d === 'object' && !!d.store && Array.isArray(d.products);

  function readCache() {
    try {
      const d = JSON.parse(localStorage.getItem(CACHE_KEY));
      return valid(d) ? d : null;
    } catch { return null; }
  }
  function writeCache(d) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* modo privado o sin espacio */ }
  }

  // break-ui prueba datos locales: no se consulta la red
  if (window.__BREAKUI_KEY || !SUPABASE_URL) {
    window.BAGSTORE_READY = Promise.resolve({ ...bundled, source: 'local' });
    return;
  }

  const remote = fetch(`${SUPABASE_URL}/rest/v1/rpc/catalog`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: '{}',
    cache: 'no-store',
  })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((d) => {
      if (!valid(d)) throw new Error('respuesta inesperada');
      writeCache(d); // aunque llegue tarde, queda lista para la próxima visita
      return d;
    });

  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('tiempo agotado')), TIMEOUT_MS));

  window.BAGSTORE_READY = Promise.race([remote, timeout])
    .then((d) => ({ ...d, source: 'supabase' }))
    .catch((err) => {
      const cached = readCache();
      console.warn(`[catálogo] Supabase no respondió (${err.message}); se usa ${cached ? 'la copia guardada' : 'catalog.js'}.`);
      return cached ? { ...cached, source: 'cache' } : { ...bundled, source: 'bundled' };
    });
})();
