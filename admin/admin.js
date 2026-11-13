/* BAG STORE SF — Panel de disponibilidad (vanilla JS, sin dependencias)
   Cada toque en − / + se guarda solo (con una pausa corta para agrupar toques seguidos). */
(() => {
  'use strict';

  const api = window.BagAdminApi;
  const $ = (sel, root = document) => root.querySelector(sel);
  const SITE = new URL('../', location.href); // las fotos migradas usan rutas relativas al sitio
  const SAVE_DELAY = 450;
  const MAX_STOCK = 999;
  const STALE_MS = 2 * 60 * 1000;

  const moneyInt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const moneyDec = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = { format: (n) => (Number.isInteger(n) ? moneyInt : moneyDec).format(n) };
  const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normalize = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, '').toLowerCase();
  const imgURL = (src) => { try { return new URL(src, SITE).href; } catch { return ''; } };

  const stockLabel = (n) => (n === null ? 'Disponible' : n === 0 ? 'Agotada' : n === 1 ? 'Pieza única' : `Quedan ${n.toLocaleString('es-MX')}`);
  const stockTone = (n) => (n === 0 ? 'out' : n === 1 ? 'hot' : 'ok');
  // Igual que el catálogo: si algún color no tiene cantidad, la pieza está disponible
  const productStock = (p) => (!p.colors.length || p.colors.some((c) => c.stock === null) ? null : p.colors.reduce((s, c) => s + c.stock, 0));

  const FILTERS = [
    { id: 'all', label: 'Todas', test: () => true },
    { id: 'available', label: 'Disponibles', test: (p) => productStock(p) !== 0 },
    { id: 'last', label: 'Última pieza', test: (p) => productStock(p) === 1 },
    { id: 'out', label: 'Agotadas', test: (p) => productStock(p) === 0 },
  ];

  const views = {
    login: $('[data-view="login"]'),
    denied: $('[data-view="denied"]'),
    panel: $('[data-view="panel"]'),
  };
  const els = {
    login: $('[data-login]'),
    loginError: $('[data-login-error]'),
    loginSubmit: $('[data-login-submit]'),
    deniedEmail: $('[data-denied-email]'),
    list: $('[data-list]'),
    listStatus: $('[data-list-status]'),
    empty: $('[data-list-empty]'),
    search: $('[data-search]'),
    filters: $('[data-filters]'),
    toast: $('[data-toast]'),
  };

  const state = { products: [], filter: 'all', query: '', loadedAt: 0, loading: false };
  const colorIndex = new Map(); // colorId → { product, color }
  const saves = new Map();      // colorId → { timer, inFlight, saved }

  function show(name) {
    for (const [k, el] of Object.entries(views)) el.hidden = k !== name;
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2800);
  }

  /* ---------- Acceso ---------- */
  els.login.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = els.login.email.value.trim();
    const password = els.login.password.value;
    els.loginError.textContent = '';
    if (!email || !password) {
      els.loginError.textContent = 'Escribe tu correo y tu contraseña.';
      (email ? els.login.password : els.login.email).focus();
      return;
    }
    els.loginSubmit.disabled = true;
    els.loginSubmit.textContent = 'Entrando…';
    try {
      await api.signIn(email, password);
      els.login.password.value = '';
      await enter();
    } catch (err) {
      els.loginError.textContent = err.message;
    } finally {
      els.loginSubmit.disabled = false;
      els.loginSubmit.textContent = 'Entrar';
    }
  });

  $('[data-reveal]').addEventListener('click', (e) => {
    const input = els.login.password;
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    e.currentTarget.textContent = reveal ? 'Ocultar' : 'Ver';
    e.currentTarget.setAttribute('aria-pressed', reveal);
  });

  document.querySelectorAll('[data-signout]').forEach((b) => b.addEventListener('click', () => {
    if (hasUnsaved() && !confirm('Hay cambios guardándose. ¿Salir de todos modos?')) return;
    api.signOut();
  }));

  api.onSession((s) => {
    if (!s) {
      saves.forEach((s) => clearTimeout(s.timer));
      saves.clear();
      state.products = [];
      els.list.innerHTML = '';
      show('login');
    }
  });

  async function enter() {
    if (!api.session) return show('login');
    try {
      const ok = await api.isAdmin();
      if (!ok) {
        els.deniedEmail.textContent = api.session.email || 'Esta cuenta';
        return show('denied');
      }
    } catch (err) {
      if (!api.session || err.status === 401 || err.status === 403) return api.signOut();
      // Sin conexión: se muestra el panel con el aviso y el botón de actualizar
    }
    show('panel');
    await load();
  }

  /* ---------- Datos ---------- */
  async function load({ quiet = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    if (!quiet) setStatus(state.products.length ? 'Actualizando…' : 'Cargando piezas…');
    els.list.setAttribute('aria-busy', 'true');
    try {
      const rows = await api.listProducts();
      state.products = rows.map((p) => ({
        id: p.id, ref: p.ref, name: p.name, brand: p.brand, price: p.price === null ? null : Number(p.price),
        archived: p.status === 'archived',
        thumb: p.product_images?.[0]?.sm || null,
        colors: (p.product_colors || []).map((c) => ({ id: c.id, name: c.name, hex: c.hex, stock: c.stock })),
      }));
      // Si había cambios sin guardar, se conservan sobre lo que llegó
      colorIndex.clear();
      for (const p of state.products) for (const c of p.colors) {
        const pending = saves.get(c.id);
        if (pending && pending.local !== undefined && pending.local !== c.stock) c.stock = pending.local;
        colorIndex.set(c.id, { product: p, color: c });
      }
      state.loadedAt = Date.now();
      setStatus('');
      render();
    } catch (err) {
      if (err.status === 401) return;
      setStatus(err.message, true);
      if (state.products.length) toast(err.message);
    } finally {
      state.loading = false;
      els.list.removeAttribute('aria-busy');
    }
  }

  function setStatus(msg, isError = false) {
    els.listStatus.textContent = msg;
    els.listStatus.classList.toggle('is-error', isError);
    els.listStatus.hidden = !msg;
  }

  /* ---------- Render ---------- */
  function visible() {
    const q = normalize(state.query.trim());
    const f = FILTERS.find((x) => x.id === state.filter) || FILTERS[0];
    return state.products.filter((p) =>
      f.test(p) && (!q || normalize(`${p.name} ${p.brand || ''} ${p.ref} #${p.ref}`).includes(q)));
  }

  function renderFilters() {
    els.filters.innerHTML = FILTERS.map((f) => {
      const n = state.products.filter(f.test).length;
      return `<button class="chip" type="button" role="tab" data-filter="${f.id}" aria-selected="${state.filter === f.id}">
        ${f.label} <small>${n.toLocaleString('es-MX')}</small></button>`;
    }).join('');
  }

  function colorRowHTML(p, c) {
    const single = p.colors.length === 1 && !c.name;
    const label = single ? '' : `<span class="stock-row__color">
        <span class="swatch"${c.hex ? ` style="background:${c.hex}"` : ''} aria-hidden="true"></span>${escapeHTML(c.name || 'Sin color')}</span>`;
    const who = `${p.name}${c.name ? `, ${c.name}` : ''}`;
    return `<div class="stock-row" data-color="${c.id}" data-tone="${stockTone(c.stock)}">
      <div class="stock-row__info">
        ${label}
        <span class="stock-row__state" data-state>${stockLabel(c.stock)}</span>
        <span class="stock-row__save" data-save aria-live="polite"></span>
      </div>
      <div class="stepper" role="group" aria-label="Piezas de ${escapeHTML(who)}">
        <button class="stepper__btn" type="button" data-step="-1" aria-label="Quitar una"${c.stock === 0 ? ' disabled' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg></button>
        <output class="stepper__value" data-value>${c.stock === null ? '—' : c.stock}</output>
        <button class="stepper__btn" type="button" data-step="1" aria-label="Agregar una"${c.stock >= MAX_STOCK ? ' disabled' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg></button>
      </div>
    </div>`;
  }

  function itemHTML(p) {
    const meta = [`#${p.ref}`, p.price ? money.format(p.price) : 'Sin precio', p.brand].filter(Boolean).map(escapeHTML).join(' · ');
    return `<li class="stock-item${p.archived ? ' is-archived' : ''}" data-product="${p.id}">
      <div class="stock-item__head">
        <span class="stock-item__thumb">${p.thumb
          ? `<img src="${escapeHTML(imgURL(p.thumb))}" alt="" width="56" height="70" loading="lazy" decoding="async" onerror="this.remove()" />`
          : ''}</span>
        <span class="stock-item__text">
          <span class="stock-item__name">${escapeHTML(p.name)}</span>
          <span class="stock-item__meta">${meta}</span>
          ${p.archived ? '<span class="stock-item__flag">Oculta del catálogo</span>' : ''}
        </span>
      </div>
      ${p.colors.length ? p.colors.map((c) => colorRowHTML(p, c)).join('') : '<p class="stock-item__none">Esta pieza no tiene colores registrados.</p>'}
    </li>`;
  }

  function render() {
    renderFilters();
    const list = visible();
    els.list.innerHTML = list.map(itemHTML).join('');
    els.empty.hidden = list.length > 0 || !state.products.length;
    if (!state.products.length && !els.listStatus.classList.contains('is-error')) setStatus('Todavía no hay piezas en el catálogo.');
  }

  // Actualiza una fila sin volver a dibujar la lista (conserva foco y posición)
  function paintRow(colorId) {
    const entry = colorIndex.get(colorId);
    const row = els.list.querySelector(`[data-color="${colorId}"]`);
    if (!entry || !row) return;
    const { stock } = entry.color;
    row.dataset.tone = stockTone(stock);
    $('[data-state]', row).textContent = stockLabel(stock);
    $('[data-value]', row).textContent = stock === null ? '—' : stock;
    $('[data-step="-1"]', row).disabled = stock === 0;
    $('[data-step="1"]', row).disabled = stock !== null && stock >= MAX_STOCK;
  }

  function paintSave(colorId, status, text = '') {
    const row = els.list.querySelector(`[data-color="${colorId}"]`);
    if (!row) return;
    row.dataset.save = status;
    $('[data-save]', row).textContent = text;
  }

  /* ---------- Guardado ---------- */
  function step(colorId, delta) {
    const entry = colorIndex.get(colorId);
    if (!entry) return;
    const cur = entry.color.stock;
    const next = cur === null ? (delta > 0 ? 1 : 0) : Math.min(MAX_STOCK, Math.max(0, cur + delta));
    if (next === cur) return;

    const s = saves.get(colorId) || { saved: cur, inFlight: false };
    saves.set(colorId, s);
    entry.color.stock = next;
    s.local = next;
    paintRow(colorId);
    paintSave(colorId, 'pending', '');
    clearTimeout(s.timer);
    s.timer = setTimeout(() => flush(colorId), SAVE_DELAY);
  }

  async function flush(colorId) {
    const s = saves.get(colorId);
    const entry = colorIndex.get(colorId);
    if (!s || !entry || s.inFlight) return;
    const value = s.local;
    if (value === s.saved) { saves.delete(colorId); paintSave(colorId, '', ''); return; }

    s.inFlight = true;
    paintSave(colorId, 'saving', 'Guardando…');
    try {
      const row = await api.setStock(colorId, value);
      s.saved = row.stock;
      s.inFlight = false;
      if (s.local !== s.saved) return flush(colorId); // hubo más toques mientras guardaba
      saves.delete(colorId);
      paintSave(colorId, 'saved', 'Guardado');
      renderFiltersCounts();
      setTimeout(() => {
        const row = els.list.querySelector(`[data-color="${colorId}"]`);
        if (row?.dataset.save === 'saved') paintSave(colorId, '', '');
      }, 1600);
    } catch (err) {
      s.inFlight = false;
      saves.delete(colorId);
      entry.color.stock = s.saved; // se regresa al último valor que sí está en la base
      paintRow(colorId);
      paintSave(colorId, 'error', 'No se guardó');
      toast(`${entry.product.name}: ${err.message}`);
    }
  }

  function renderFiltersCounts() {
    els.filters.querySelectorAll('[data-filter]').forEach((b) => {
      const f = FILTERS.find((x) => x.id === b.dataset.filter);
      $('small', b).textContent = state.products.filter(f.test).length.toLocaleString('es-MX');
    });
  }

  const hasUnsaved = () => saves.size > 0;

  /* ---------- Eventos ---------- */
  els.list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn || btn.disabled) return;
    step(btn.closest('[data-color]').dataset.color, Number(btn.dataset.step));
  });

  els.filters.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    render();
    window.scrollTo({ top: 0 });
  });

  let searchTimer;
  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.query = els.search.value; render(); }, 120);
  });

  $('[data-reload]').addEventListener('click', () => load());

  // Al volver a la app después de un rato, trae lo último (otra persona pudo vender algo)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !views.panel.hidden && !hasUnsaved() &&
        Date.now() - state.loadedAt > STALE_MS) load({ quiet: true });
    // Al salir de la app, guarda de inmediato lo pendiente
    if (document.visibilityState === 'hidden') saves.forEach((s, id) => { clearTimeout(s.timer); flush(id); });
  });

  window.addEventListener('beforeunload', (e) => {
    if (hasUnsaved()) { e.preventDefault(); e.returnValue = ''; }
  });

  enter();
})();
