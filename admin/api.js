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
    const raw = `${body?.error_code || ''} ${body?.error || ''} ${body?.error_description || body?.msg || body?.message || ''}`.toLowerCase();
    if (raw.includes('invalid login') || raw.includes('invalid_credentials') || raw.includes('invalid_grant')) return 'Correo o contraseña incorrectos.';
    if (raw.includes('email not confirmed')) return 'Falta confirmar este correo en Supabase.';
    if (raw.includes('rate limit') || status === 429) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
    if (status === 401 || status === 403) return 'Tu sesión terminó. Vuelve a entrar.';
    if (status >= 500) return 'Supabase no respondió. Intenta de nuevo en un momento.';
    return body?.error_description || body?.msg || body?.message || `Error ${status}`;
  }

  async function request(url, { method = 'GET', body, headers = {}, auth = true } = {}) {
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
        body: body !== undefined ? JSON.stringify(body) : undefined,
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
    try {
      return await request(`${URL_}/rest/v1/${path}`, opts);
    } catch (err) {
      if (err.status !== 401) throw err;
      await refresh();
      return request(`${URL_}/rest/v1/${path}`, opts);
    }
  }

  window.BagAdminApi = {
    ApiError,
    get session() { return session; },
    onSession: (fn) => listeners.add(fn),
    signIn,
    signOut,
    refresh,
    isAdmin: () => authed('rpc/is_admin', { method: 'POST', body: {} }),
    listProducts: () => authed(
      'products?select=id,ref,name,brand,price,status,' +
      'product_colors(id,name,hex,stock,position),product_images(sm,position)' +
      '&order=position.asc,ref.asc&product_colors.order=position.asc' +
      '&product_images.order=position.asc&product_images.limit=1'
    ),
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
