/* BAG STORE SF — Cliente mínimo de Supabase para el panel (fetch directo, sin SDK).
   Sesión: correo + contraseña. El refresh token se guarda en este dispositivo para no
   pedir la contraseña cada vez; "Salir" lo borra. */
(() => {
  'use strict';

  const { supabaseUrl: URL_, supabaseKey: KEY } = window.BAGSTORE_CONFIG;
  const SESSION_KEY = 'bagstore:admin-session';

  let session = readSession();
  const listeners = new Set();

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
  }
  function saveSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* modo privado: la sesión dura lo que dure la pestaña */ }
    listeners.forEach((fn) => fn(s));
  }

  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }

  // Mensajes de Supabase → español claro
  function humanize(status, body) {
    const raw = `${body?.error_code || body?.code || ''} ${body?.error || ''} ${body?.error_description || body?.msg || body?.message || ''} ${body?.details || ''}`.toLowerCase();
    if (raw.includes('invalid login') || raw.includes('invalid_credentials') || raw.includes('invalid_grant')) return 'Correo o contraseña incorrectos.';
    if (raw.includes('email not confirmed')) return 'Falta confirmar este correo en Supabase.';
    const msg = body?.message || '';
    if (/^(No alcanza|El pedido|Ese pedido|No tienes permiso)/.test(msg)) return msg;
    if (raw.includes('could not find the function') || raw.includes('pgrst202')) return 'Falta actualizar la base de datos. Avisa a quien administra el sitio.';
    if (raw.includes('duplicate key') && raw.includes('product_colors')) return 'Hay dos colores con el mismo nombre.';
    if (raw.includes('categories') && (raw.includes('still referenced') || raw.includes('update or delete on table'))) return 'Esa categoría todavía tiene piezas. Muévelas a otra antes de borrarla.';
    if (raw.includes('foreign key') && raw.includes('categor')) return 'Esa categoría ya no existe. Elige otra.';
    if (raw.includes('categories_id_check')) return 'El nombre de la categoría no es válido.';
    if (raw.includes('payload too large') || status === 413) return 'La foto es demasiado pesada.';
    if (raw.includes('rate limit') || status === 429) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
    if (status === 401 || status === 403) return 'Tu sesión terminó. Vuelve a entrar.';
    if (status >= 500) return 'Supabase no respondió. Intenta de nuevo en un momento.';
    return body?.error_description || body?.msg || body?.message || `Error ${status}`;
  }

  // body: objeto → JSON; raw: Blob/archivo tal cual (subida de fotos)
  async function request(url, { method = 'GET', body, raw, headers = {}, auth = true } = {}) {
    let res;
    try {
      res = await fetch(url, {
        method,
        cache: 'no-store',
        headers: {
          apikey: KEY,
          ...(auth && session ? { Authorization: `Bearer ${session.access_token}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError('Sin conexión. Revisa el internet y vuelve a intentar.', 0);
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new ApiError(humanize(res.status, data), res.status);
    return data;
  }

  function fromTokenResponse(d) {
    return {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
      email: d.user?.email || session?.email || '',
    };
  }

  async function signIn(email, password) {
    const d = await request(`${URL_}/auth/v1/token?grant_type=password`, {
      method: 'POST', auth: false, body: { email: email.trim().toLowerCase(), password },
    });
    saveSession(fromTokenResponse(d));
    return session;
  }

  let refreshing = null;
  function refresh() {
    if (!session?.refresh_token) return Promise.reject(new ApiError('Sin sesión', 401));
    // Una sola renovación a la vez: varias peticiones pueden pedirla al mismo tiempo
    refreshing ??= request(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', auth: false, body: { refresh_token: session.refresh_token },
    })
      .then((d) => { saveSession(fromTokenResponse(d)); return session; })
      .catch((err) => {
        // Refresh token vencido o revocado: la sesión ya no sirve
        if (err.status && err.status < 500) { saveSession(null); throw new ApiError('Tu sesión terminó. Vuelve a entrar.', 401); }
        throw err;
      })
      .finally(() => { refreshing = null; });
    return refreshing;
  }

  async function signOut() {
    const s = session;
    saveSession(null);
    if (s) request(`${URL_}/auth/v1/logout`, { method: 'POST', headers: { Authorization: `Bearer ${s.access_token}` }, auth: false }).catch(() => {});
  }

  // Petición autenticada: renueva el token si está por vencer y reintenta una vez ante 401
  async function authed(path, opts = {}) {
    if (!session) throw new ApiError('Tu sesión terminó. Vuelve a entrar.', 401);
    if (session.expires_at - 60 < Date.now() / 1000) await refresh();
    const url = path.startsWith('/') ? `${URL_}${path}` : `${URL_}/rest/v1/${path}`;
    try {
      return await request(url, opts);
    } catch (err) {
      if (err.status !== 401) throw err;
      await refresh();
      return request(url, opts);
    }
  }

  const BUCKET = 'products';
  const PUBLIC_PREFIX = `${URL_}/storage/v1/object/public/${BUCKET}/`;
  const PRODUCT_SELECT =
    'id,ref,name,brand,price,status,category_id,description,' +
    'product_colors(id,name,hex,stock,position),product_images(id,src,sm,width,height,color_id,position)';
  const PRODUCT_ORDER = '&product_colors.order=position.asc&product_images.order=position.asc';

  window.BagAdminApi = {
    ApiError,
    get session() { return session; },
    onSession: (fn) => listeners.add(fn),
    signIn,
    signOut,
    refresh,
    isAdmin: () => authed('rpc/is_admin', { method: 'POST', body: {} }),
    listProducts: () => authed(`products?select=${PRODUCT_SELECT}&order=position.asc,ref.asc${PRODUCT_ORDER}`),
    async getProduct(id) {
      const rows = await authed(`products?select=${PRODUCT_SELECT}&id=eq.${encodeURIComponent(id)}${PRODUCT_ORDER}`);
      if (!rows?.length) throw new ApiError('Esa pieza ya no existe.', 404);
      return rows[0];
    },
    listCategories: () => authed('categories?select=id,label,position&order=position.asc,id.asc'),
    // Borra las quitadas y luego guarda nombres y orden de todas en una sola petición (upsert)
    async saveCategories(list, removedIds = []) {
      if (removedIds.length) {
        await authed(`categories?id=in.(${removedIds.map(encodeURIComponent).join(',')})`, { method: 'DELETE' });
      }
      if (!list.length) return [];
      return authed('categories?on_conflict=id&select=id,label,position', {
        method: 'POST',
        body: list.map((c, i) => ({ id: c.id, label: c.label, position: i })),
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      });
    },
    saveProduct: (p) => authed('rpc/save_product', { method: 'POST', body: { p } }),
    deleteProduct: (pid) => authed('rpc/delete_product', { method: 'POST', body: { pid } }),
    listOrders: () => authed('rpc/list_orders', { method: 'POST', body: { lim: 200 } }),
    getOrder: (oid) => authed('rpc/get_order', { method: 'POST', body: { oid } }),
    completeOrder: (oid, final) => authed('rpc/complete_order', { method: 'POST', body: { oid, final } }),
    cancelOrder: (oid) => authed('rpc/cancel_order', { method: 'POST', body: { oid } }),
    async getStore() {
      const rows = await authed('store_settings?select=name,tagline,address,maps_url,whatsapp,instagram');
      return rows?.[0] || null;
    },
    async updateStore(fields) {
      const rows = await authed('store_settings?id=eq.true&select=name,tagline,address,maps_url,whatsapp,instagram', {
        method: 'PATCH', body: fields, headers: { Prefer: 'return=representation' },
      });
      if (!Array.isArray(rows) || !rows.length) throw new ApiError('No tienes permiso para cambiar los datos de la tienda.', 403);
      return rows[0];
    },
    // Sube un archivo al bucket y devuelve su URL pública
    async upload(path, blob) {
      await authed(`/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST', raw: blob,
        headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': 'max-age=31536000' },
      });
      return PUBLIC_PREFIX + path;
    },
    // Borra fotos de Storage a partir de sus URLs (ignora las rutas antiguas de assets/)
    async removeFiles(urls) {
      const prefixes = [...new Set(urls)].filter((u) => typeof u === 'string' && u.startsWith(PUBLIC_PREFIX)).map((u) => u.slice(PUBLIC_PREFIX.length));
      if (!prefixes.length) return;
      await authed(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: { prefixes } });
    },
    // Devuelve la fila guardada; si RLS no la deja tocar, Supabase responde [] → error claro
    async setStock(colorId, stock) {
      const rows = await authed(`product_colors?id=eq.${encodeURIComponent(colorId)}&select=id,stock`, {
        method: 'PATCH', body: { stock }, headers: { Prefer: 'return=representation' },
      });
      if (!Array.isArray(rows) || !rows.length) throw new ApiError('No tienes permiso para cambiar esta pieza.', 403);
      return rows[0];
    },
  };
})();
