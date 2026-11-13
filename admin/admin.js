/* BAG STORE SF — Panel (vanilla JS, sin dependencias)
   Rutas: #piezas (lista y disponibilidad) · #pieza/<id> y #nueva (editor.js) · #tienda (datos de contacto).
   En la lista, cada toque en − / + se guarda solo (con una pausa corta para agrupar toques seguidos). */
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
    { id: 'hidden', label: 'Ocultas', test: (p) => p.archived },
  ];

  const views = {
    login: $('[data-view="login"]'),
    denied: $('[data-view="denied"]'),
    panel: $('[data-view="panel"]'),
    editor: $('[data-view="editor"]'),
    order: $('[data-view="order"]'),
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
    tools: $('[data-tools]'),
    sections: { list: $('[data-section="list"]'), orders: $('[data-section="orders"]'), store: $('[data-section="store"]') },
    tabs: document.querySelectorAll('[data-tab]'),
    store: $('[data-store-form]'),
    storeStatus: $('[data-store-status]'),
    storeSave: $('[data-store-save]'),
    toast: $('[data-toast]'),
  };

  const state = { products: [], categories: [], filter: 'all', query: '', loadedAt: 0, loading: false, admin: false };
  const colorIndex = new Map(); // colorId → { product, color }
  const saves = new Map();      // colorId → { timer, inFlight, saved, local }

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

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-signout]')) return;
    if ((hasUnsaved() || window.BagEditor?.isDirty()) && !confirm('Hay cambios sin guardar. ¿Salir de todos modos?')) return;
    window.BagEditor?.discard();
    api.signOut();
  });

  api.onSession((s) => {
    if (!s) {
      saves.forEach((x) => clearTimeout(x.timer));
      saves.clear();
      state.products = [];
      state.admin = false;
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
    state.admin = true;
    showInstall();
    window.BagOrders?.refreshBadge();
    await route();
    load();
    loadCategories();
  }

  /* ---------- Rutas ---------- */
  let currentHash = location.hash;
  let ignoreHash = false;

  async function route() {
    if (!state.admin) return;
    const h = location.hash;
    const m = h.match(/^#pieza\/([0-9a-f-]{36})$/i);
    const order = h.match(/^#pedido\/([0-9a-f-]{36})$/i);
    if (order) {
      show('order');
      await window.BagOrders.open(order[1]);
    } else if (m || h === '#nueva') {
      show('editor');
      await window.BagEditor.open(m ? m[1] : null);
    } else {
      show('panel');
      const tab = h === '#tienda' ? 'store' : h === '#pedidos' ? 'orders' : 'list';
      for (const [k, el] of Object.entries(els.sections)) el.hidden = k !== tab;
      els.tools.hidden = tab !== 'list';
      if (tab === 'orders') window.BagOrders.loadList();
      els.tabs.forEach((t) => (t.dataset.tab === tab ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current')));
      if (tab === 'store') { loadStore(); if (!catsDirty()) loadCats(); }
    }
    currentHash = h;
  }

  window.addEventListener('hashchange', () => {
    if (ignoreHash) { ignoreHash = false; return; }
    const leavingEditor = !views.editor.hidden;
    if (leavingEditor && window.BagEditor.isDirty() && !confirm('Tienes cambios sin guardar en esta pieza. ¿Salir sin guardar?')) {
      ignoreHash = true;
      location.hash = currentHash; // se queda en el editor
      return;
    }
    if (leavingEditor) window.BagEditor.discard();
    window.scrollTo(0, 0);
    route();
  });

  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  /* ---------- Datos ---------- */
  function mapProduct(p) {
    return {
      id: p.id, ref: p.ref, name: p.name, brand: p.brand,
      price: p.price === null ? null : Number(p.price),
      category: p.category_id, description: p.description || '',
      archived: p.status === 'archived',
      colors: (p.product_colors || []).map((c) => ({ id: c.id, name: c.name, hex: c.hex, stock: c.stock })),
      images: (p.product_images || []).map((i) => ({ id: i.id, src: i.src, sm: i.sm, w: i.width, h: i.height, color: i.color_id })),
    };
  }

  async function load({ quiet = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    if (!quiet) setStatus(state.products.length ? 'Actualizando…' : 'Cargando piezas…');
    els.list.setAttribute('aria-busy', 'true');
    try {
      const rows = await api.listProducts();
      state.products = rows.map(mapProduct);
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
      // Los contadores de "piezas" de cada categoría dependen de esta lista
      if (cats.draft.length && !cats.list.contains(document.activeElement)) renderCats();
    } catch (err) {
      if (err.status === 401) return;
      setStatus(err.message, true);
      if (state.products.length) toast(err.message);
    } finally {
      state.loading = false;
      els.list.removeAttribute('aria-busy');
    }
  }

  async function loadCategories() {
    try { state.categories = await api.listCategories(); } catch { /* el editor lo vuelve a intentar */ }
  }

  function setStatus(msg, isError = false) {
    els.listStatus.textContent = msg;
    els.listStatus.classList.toggle('is-error', isError);
    els.listStatus.hidden = !msg;
  }

  /* ---------- Lista ---------- */
  function visible() {
    const q = normalize(state.query.trim());
    const f = FILTERS.find((x) => x.id === state.filter) || FILTERS[0];
    return state.products.filter((p) =>
      f.test(p) && (!q || normalize(`${p.name} ${p.brand || ''} ${p.ref} #${p.ref}`).includes(q)));
  }

  function renderFilters() {
    els.filters.innerHTML = FILTERS.map((f) => {
      const n = state.products.filter(f.test).length;
      if (f.id === 'hidden' && !n && state.filter !== 'hidden') return '';
      return `<button class="chip" type="button" role="tab" data-filter="${f.id}" aria-selected="${state.filter === f.id}">
        ${f.label} <small>${n.toLocaleString('es-MX')}</small></button>`;
    }).join('');
  }

  function stepperHTML(stock, label) {
    return `<div class="stepper" role="group" aria-label="${escapeHTML(label)}">
        <button class="stepper__btn" type="button" data-step="-1" aria-label="Quitar una"${stock === 0 ? ' disabled' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg></button>
        <output class="stepper__value" data-value>${stock === null ? '—' : stock}</output>
        <button class="stepper__btn" type="button" data-step="1" aria-label="Agregar una"${stock !== null && stock >= MAX_STOCK ? ' disabled' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg></button>
      </div>`;
  }

  function colorRowHTML(p, c) {
    const single = p.colors.length === 1 && !c.name;
    const label = single ? '' : `<span class="stock-row__color">
        <span class="swatch"${c.hex ? ` style="background:${escapeHTML(c.hex)}"` : ''} aria-hidden="true"></span>${escapeHTML(c.name || 'Sin color')}</span>`;
    return `<div class="stock-row" data-color="${c.id}" data-tone="${stockTone(c.stock)}">
      <div class="stock-row__info">
        ${label}
        <span class="stock-row__state" data-state>${stockLabel(c.stock)}</span>
        <span class="stock-row__save" data-save aria-live="polite"></span>
      </div>
      ${stepperHTML(c.stock, `Piezas de ${p.name}${c.name ? `, ${c.name}` : ''}`)}
    </div>`;
  }

  function itemHTML(p) {
    const meta = [`#${p.ref}`, p.price ? money.format(p.price) : 'Sin precio', p.brand].filter(Boolean).map(escapeHTML).join(' · ');
    const thumb = p.images[0]?.sm;
    return `<li class="stock-item${p.archived ? ' is-archived' : ''}" data-product="${p.id}">
      <a class="stock-item__head" href="#pieza/${p.id}" aria-label="Editar ${escapeHTML(p.name)}">
        <span class="stock-item__thumb">${thumb
          ? `<img src="${escapeHTML(imgURL(thumb))}" alt="" width="56" height="70" loading="lazy" decoding="async" onerror="this.remove()" />`
          : ''}</span>
        <span class="stock-item__text">
          <span class="stock-item__name">${escapeHTML(p.name)}</span>
          <span class="stock-item__meta">${meta}</span>
          ${p.archived ? '<span class="stock-item__flag">Oculta del catálogo</span>' : ''}
        </span>
        <svg class="stock-item__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
      </a>
      ${p.colors.length ? p.colors.map((c) => colorRowHTML(p, c)).join('') : '<p class="stock-item__none">Sin disponibilidad registrada. Ábrela para agregarla.</p>'}
    </li>`;
  }

  function render() {
    renderFilters();
    const list = visible();
    els.list.innerHTML = list.map(itemHTML).join('');
    els.empty.hidden = list.length > 0 || !state.products.length;
    if (!state.products.length && !els.listStatus.classList.contains('is-error')) setStatus('Todavía no hay piezas. Toca "Nueva pieza" para agregar la primera.');
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

  /* ---------- Guardado de disponibilidad ---------- */
  const nextStock = (cur, delta) => (cur === null ? (delta > 0 ? 1 : 0) : Math.min(MAX_STOCK, Math.max(0, cur + delta)));

  function step(colorId, delta) {
    const entry = colorIndex.get(colorId);
    if (!entry) return;
    const cur = entry.color.stock;
    const next = nextStock(cur, delta);
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
        const r = els.list.querySelector(`[data-color="${colorId}"]`);
        if (r?.dataset.save === 'saved') paintSave(colorId, '', '');
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

  /* ---------- Datos de la tienda ---------- */
  const STORE_FIELDS = ['name', 'tagline', 'address', 'maps_url', 'whatsapp', 'instagram'];
  let storeLoaded = null;

  const field = (k) => els.store.elements.namedItem(k);

  // Mientras cargan los datos no se puede guardar (evita pisar la dirección con campos vacíos)
  let storeLoading = null;
  function loadStore() {
    if (storeLoading) return storeLoading;
    els.storeSave.disabled = true;
    els.storeStatus.textContent = 'Cargando…';
    storeLoading = (async () => {
      try {
        storeLoaded = await api.getStore();
        for (const k of STORE_FIELDS) field(k).value = storeLoaded?.[k] || '';
        els.storeStatus.textContent = '';
        els.storeSave.disabled = false;
      } catch (err) {
        els.storeStatus.textContent = `${err.message} Toca ↻ para reintentar.`;
      } finally {
        storeLoading = null;
      }
    })();
    return storeLoading;
  }

  function storeErrors(v) {
    const e = {};
    if (!v.name) e.name = 'Escribe el nombre de la tienda.';
    if (v.maps_url && !/^https?:\/\/\S+$/i.test(v.maps_url)) e.maps_url = 'Pega el enlace completo (empieza con https://).';
    if (v.whatsapp && !/^[0-9]{10,15}$/.test(v.whatsapp)) e.whatsapp = 'Escribe de 10 a 15 números, con 52 al inicio.';
    if (v.instagram && !/^[A-Za-z0-9._]{1,30}$/.test(v.instagram)) e.instagram = 'Solo letras, números, punto y guion bajo.';
    return e;
  }

  els.store.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (els.storeSave.disabled) return;
    const v = {
      name: field('name').value.trim(),
      tagline: field('tagline').value.trim() || null,
      address: field('address').value.trim() || null,
      maps_url: field('maps_url').value.trim() || null,
      whatsapp: field('whatsapp').value.replace(/\D/g, '') || null,
      instagram: field('instagram').value.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '') || null,
    };
    const errors = storeErrors(v);
    els.store.querySelectorAll('[data-error]').forEach((el) => { el.textContent = errors[el.dataset.error] || ''; });
    const first = Object.keys(errors)[0];
    if (first) { field(first).focus(); return; }

    els.storeSave.disabled = true;
    els.storeStatus.textContent = 'Guardando…';
    try {
      storeLoaded = await api.updateStore(v);
      for (const k of STORE_FIELDS) field(k).value = storeLoaded[k] || '';
      els.storeStatus.textContent = '';
      toast('Datos de la tienda guardados');
    } catch (err) {
      els.storeStatus.textContent = '';
      toast(err.message);
    } finally {
      els.storeSave.disabled = false;
    }
  });

  /* ---------- Categorías ---------- */
  const cats = {
    form: $('[data-cat-form]'), list: $('[data-cat-list]'), input: $('[data-cat-new]'),
    error: $('[data-cat-error]'), status: $('[data-cat-status]'), save: $('[data-cat-save]'),
    draft: [], removed: [], original: '', loading: null, saving: false,
  };
  const ICON_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  const ICON_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';

  const catSnapshot = () => JSON.stringify([cats.draft.map((c) => [c.id, c.label]), cats.removed]);
  const catsDirty = () => !!cats.original && catSnapshot() !== cats.original;
  const usage = (id) => state.products.filter((p) => p.category === id).length;

  // "Monederos y tarjeteros" → "monederos-y-tarjeteros" (formato que exige la base)
  function slugify(label) {
    let id = normalize(label).trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    if (id.length < 2) id = `cat-${Date.now().toString(36)}`;
    const taken = new Set(cats.draft.map((c) => c.id));
    let out = id, n = 2;
    while (taken.has(out)) out = `${id.slice(0, 37)}-${n++}`;
    return out;
  }

  function loadCats() {
    if (cats.loading) return cats.loading;
    cats.save.disabled = true;
    cats.status.textContent = 'Cargando…';
    cats.loading = (async () => {
      try {
        const rows = await api.listCategories();
        state.categories = rows.map(({ id, label }) => ({ id, label }));
        cats.draft = state.categories.map((c) => ({ ...c }));
        cats.removed = [];
        cats.original = catSnapshot();
        renderCats();
        cats.status.textContent = '';
        cats.save.disabled = false;
      } catch (err) {
        cats.status.textContent = `${err.message} Toca ↻ para reintentar.`;
      } finally {
        cats.loading = null;
      }
    })();
    return cats.loading;
  }

  function renderCats() {
    const n = cats.draft.length;
    cats.list.innerHTML = cats.draft.map((c, i) => {
      const used = usage(c.id);
      const count = c.isNew ? 'Nueva' : used ? `${used.toLocaleString('es-MX')} ${used === 1 ? 'pieza' : 'piezas'}` : 'Sin piezas';
      return `<li class="cat-row" data-cat="${escapeHTML(c.id)}">
        <input class="cat-row__name" data-cat-label value="${escapeHTML(c.label)}" maxlength="40" autocomplete="off" enterkeyhint="done" aria-label="Nombre de la categoría ${i + 1}" />
        <div class="cat-row__bottom">
          <span class="cat-row__count">${count}</span>
          <span class="cat-row__actions">
            <button class="icon-button" type="button" data-cat-move="-1" aria-label="Subir ${escapeHTML(c.label)}"${i === 0 ? ' disabled' : ''}>${ICON_UP}</button>
            <button class="icon-button" type="button" data-cat-move="1" aria-label="Bajar ${escapeHTML(c.label)}"${i === n - 1 ? ' disabled' : ''}>${ICON_DOWN}</button>
            <button class="icon-button cat-row__remove" type="button" data-cat-remove aria-label="Borrar ${escapeHTML(c.label)}"${used ? ` disabled title="Tiene piezas: muévelas antes de borrarla"` : ''}>${ICON_TRASH}</button>
          </span>
        </div>
      </li>`;
    }).join('') || '<li class="cat-row cat-row--empty">Todavía no hay categorías.</li>';
  }

  function addCat() {
    const label = cats.input.value.trim().replace(/\s+/g, ' ');
    cats.error.textContent = '';
    if (!label) { cats.input.focus(); return; }
    if (cats.draft.some((c) => normalize(c.label) === normalize(label))) {
      cats.error.textContent = `Ya existe "${label}".`;
      return;
    }
    const c = { id: slugify(label), label, isNew: true };
    cats.removed = cats.removed.filter((id) => id !== c.id); // se vuelve a crear una que se iba a borrar
    cats.draft.push(c);
    cats.input.value = '';
    renderCats();
  }

  cats.list.addEventListener('input', (e) => {
    if (!e.target.matches('[data-cat-label]')) return;
    const c = cats.draft.find((x) => x.id === e.target.closest('[data-cat]').dataset.cat);
    if (c) c.label = e.target.value;
    cats.error.textContent = '';
  });

  cats.list.addEventListener('click', (e) => {
    const row = e.target.closest('[data-cat]');
    if (!row) return;
    const i = cats.draft.findIndex((x) => x.id === row.dataset.cat);
    const move = e.target.closest('[data-cat-move]');
    if (move && !move.disabled) {
      const j = i + Number(move.dataset.catMove);
      [cats.draft[i], cats.draft[j]] = [cats.draft[j], cats.draft[i]];
      renderCats();
      cats.list.querySelector(`[data-cat="${CSS.escape(row.dataset.cat)}"] [data-cat-move="${move.dataset.catMove}"]:not(:disabled)`)?.focus();
      return;
    }
    const rm = e.target.closest('[data-cat-remove]');
    if (rm && !rm.disabled) {
      const [gone] = cats.draft.splice(i, 1);
      if (!gone.isNew) cats.removed.push(gone.id);
      renderCats();
    }
  });

  cats.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } });
  $('[data-cat-add]').addEventListener('click', addCat);

  cats.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (cats.save.disabled || cats.saving) return;
    cats.draft.forEach((c) => { c.label = c.label.trim().replace(/\s+/g, ' '); });
    const labels = cats.draft.map((c) => normalize(c.label));
    if (labels.some((l) => !l)) { cats.error.textContent = 'Ponle nombre a cada categoría.'; return; }
    if (new Set(labels).size !== labels.length) { cats.error.textContent = 'Hay dos categorías con el mismo nombre.'; return; }
    const blocked = cats.removed.filter((id) => usage(id));
    if (blocked.length) { cats.error.textContent = 'Una categoría que quitaste todavía tiene piezas.'; return; }
    if (!catsDirty()) { toast('No hay cambios en las categorías'); return; }

    cats.saving = true;
    cats.save.disabled = true;
    cats.status.textContent = 'Guardando…';
    try {
      const rows = await api.saveCategories(cats.draft, cats.removed);
      state.categories = rows.sort((a, b) => a.position - b.position).map(({ id, label }) => ({ id, label }));
      cats.draft = state.categories.map((c) => ({ ...c }));
      cats.removed = [];
      cats.original = catSnapshot();
      renderCats();
      cats.status.textContent = '';
      toast('Categorías guardadas');
    } catch (err) {
      cats.status.textContent = '';
      toast(err.message);
      loadCats(); // vuelve a lo que de verdad quedó en la base
    } finally {
      cats.saving = false;
      cats.save.disabled = false;
    }
  });

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

  $('[data-reload]').addEventListener('click', () => {
    if (!els.sections.orders.hidden) return window.BagOrders.loadList();
    if (els.sections.store.hidden) return load();
    loadStore();
    if (!catsDirty() || confirm('¿Descartar los cambios en las categorías?')) { cats.original = ''; loadCats(); }
  });

  // Al volver a la app después de un rato, trae lo último (otra persona pudo vender algo)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !views.panel.hidden && !els.sections.list.hidden &&
        !hasUnsaved() && Date.now() - state.loadedAt > STALE_MS) load({ quiet: true });
    // Al salir de la app, guarda de inmediato lo pendiente
    if (document.visibilityState === 'hidden') saves.forEach((s, id) => { clearTimeout(s.timer); flush(id); });
  });

  window.addEventListener('beforeunload', (e) => {
    if (hasUnsaved() || window.BagEditor?.isDirty() || catsDirty()) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- Instalar como app (PWA) ---------- */
  const INSTALL_KEY = 'bagstore:install-dismissed';
  const install = {
    card: $('[data-install]'), text: $('[data-install-text]'), go: $('[data-install-go]'), prompt: null,
  };
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const dismissed = () => { try { return localStorage.getItem(INSTALL_KEY) === '1'; } catch { return false; } };

  function showInstall() {
    if (isStandalone() || dismissed() || !window.matchMedia('(pointer: coarse)').matches) return;
    if (install.prompt) {
      // Android / Chrome: el navegador ofrece su propio diálogo
      install.text.textContent = 'Instálalo y ábrelo desde tu pantalla de inicio, como una app.';
      install.go.hidden = false;
    } else if ('standalone' in navigator) {
      // Safari en iPhone/iPad: no hay diálogo, se explica el gesto
      install.text.textContent = 'Toca Compartir y luego "Agregar a inicio". Ahí entras una vez y queda abierta.';
      install.go.hidden = true;
    } else return;
    install.card.hidden = false;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    install.prompt = e;
    showInstall();
  });
  window.addEventListener('appinstalled', () => { install.card.hidden = true; });
  install.go.addEventListener('click', async () => {
    if (!install.prompt) return;
    install.prompt.prompt();
    const { outcome } = await install.prompt.userChoice;
    install.prompt = null;
    if (outcome === 'accepted') install.card.hidden = true;
  });
  $('[data-install-close]').addEventListener('click', () => {
    install.card.hidden = true;
    try { localStorage.setItem(INSTALL_KEY, '1'); } catch { /* modo privado */ }
  });

  // Service worker: solo en el panel real (/admin/), no en el simulador de dev/
  if ('serviceWorker' in navigator && /\/admin\/(index\.html)?$/.test(location.pathname)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // Lo que comparte el editor
  window.BagAdmin = {
    api, $, escapeHTML, money, imgURL, toast, normalize,
    stockLabel, stockTone, stepperHTML, nextStock, mapProduct, MAX_STOCK,
    state, go, load, loadCategories, show,
  };

  enter();
})();
