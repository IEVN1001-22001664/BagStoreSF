/* BAG STORE SF — Carrito y pedidos para apartar por WhatsApp y pagar en tienda.
   El carrito vive en este teléfono. Al apartar se crea el pedido en Supabase (create_order valida
   disponibilidad y precios), y la clienta recibe un código BS-XXXX con su QR para mostrar en tienda.
   El QR abre el pedido en el panel de la dueña; ella lo cobra y el inventario baja. */
(() => {
  'use strict';

  const CART_KEY = 'bagstore:cart';
  const ORDERS_KEY = 'bagstore:orders';
  const MAX_PIECES = 10;
  const QR_SRC = 'assets/vendor/qrcode-generator-1.4.4.js';
  const { supabaseUrl: URL_, supabaseKey: KEY, orders: ORDERS = false } = window.BAGSTORE_CONFIG || {};
  const $ = (sel, root = document) => root.querySelector(sel);

  const dialog = $('[data-cart]');
  const panel = $('[data-cart-panel]');
  const body = $('[data-cart-body]');
  const badge = $('[data-cart-count]');
  const button = $('[data-cart-open]');

  let C = null;           // lo que comparte app.js (BagCatalog)
  let items = read(CART_KEY, []);   // [{ color, qty }]
  let view = 'cart';      // 'cart' | 'order'
  let busy = false;
  let sent = false;       // ya se abrió WhatsApp con la lista (modo directo)

  function read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : fallback; } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* modo privado: dura la visita */ }
  }

  /* ---------- Datos ---------- */
  function find(colorId) {
    for (const p of C.products) {
      const c = (p.colors || []).find((x) => x.id === colorId);
      if (c) return { p, c };
    }
    return null;
  }
  const limitOf = (c) => Math.min(MAX_PIECES, c.stock === null ? MAX_PIECES : c.stock);
  const pieces = () => items.reduce((n, it) => n + it.qty, 0);

  // Quita lo que ya no existe o se agotó y ajusta cantidades a lo disponible
  function clean() {
    const notes = [];
    items = items.filter((it) => {
      const hit = find(it.color);
      if (!hit || hit.p.stock === 0 || hit.c.stock === 0) { notes.push(hit ? `#${hit.p.ref} se agotó` : 'Una pieza ya no está'); return false; }
      const max = limitOf(hit.c);
      if (it.qty > max) { it.qty = max; notes.push(`#${hit.p.ref}: solo quedan ${max}`); }
      return true;
    });
    write(CART_KEY, items);
    return notes;
  }

  function lines() {
    return items.map((it) => ({ ...it, ...find(it.color) })).filter((l) => l.p);
  }

  function totals(ls) {
    let total = 0, unpriced = false;
    for (const l of ls) {
      if (C.hasPrice(l.p)) total += l.p.price * l.qty; else unpriced = true;
    }
    return { total, unpriced };
  }

  function updateBadge(bump = false) {
    const n = pieces();
    badge.hidden = n === 0;
    badge.textContent = n;
    button.setAttribute('aria-label', n ? `Carrito, ${n} ${n === 1 ? 'pieza' : 'piezas'}` : 'Carrito vacío');
    if (bump && !C.reduceMotion.matches) {
      badge.classList.add('is-bump');
      setTimeout(() => badge.classList.remove('is-bump'), 90);
    }
  }

  /* ---------- API pública para app.js ---------- */
  // Cuántas piezas más de ese color caben (por disponibilidad y por el tope de 10)
  function room(p, colorId) {
    const c = (p.colors || []).find((x) => x.id === colorId);
    if (!c) return 0;
    const inCart = items.find((it) => it.color === colorId)?.qty || 0;
    return Math.max(0, Math.min(limitOf(c) - inCart, MAX_PIECES - pieces()));
  }

  function add(p, colorId) {
    if (room(p, colorId) <= 0) {
      C.toast(pieces() >= MAX_PIECES ? `Máximo ${MAX_PIECES} piezas por pedido` : 'Ya tienes todas las disponibles');
      return;
    }
    const it = items.find((x) => x.color === colorId);
    if (it) it.qty += 1; else items.push({ color: colorId, qty: 1 });
    write(CART_KEY, items);
    updateBadge(true);
    C.toast('Agregada al carrito');
  }

  /* ---------- Abrir / cerrar ---------- */
  function open() {
    view = 'cart';
    const notes = clean();
    render();
    show();
    if (notes.length) C.toast(notes.join(' · '));
  }

  function show() {
    C.closeSheet({ instant: true });
    document.documentElement.classList.add('is-locked');
    if (!dialog.open) {
      dialog.showModal();
      dialog.scrollTop = 0;
      $('[data-cart-close]').focus({ preventScroll: true });
    }
    body.scrollTop = 0;
    const token = ++openToken; // si se cierra antes de este cuadro, no se vuelve a abrir
    requestAnimationFrame(() => requestAnimationFrame(() => { if (token === openToken && dialog.open) dialog.classList.add('is-open'); }));
  }

  let openToken = 0;
  function close({ instant = false } = {}) {
    if (!dialog.open) return;
    openToken++;
    const finish = () => {
      dialog.close();
      document.documentElement.classList.remove('is-locked');
      if (/^#pedido\//.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
      button.focus({ preventScroll: true });
    };
    dialog.classList.remove('is-open');
    if (instant || C.reduceMotion.matches) return finish();
    let done = false;
    const end = () => { if (!done) { done = true; finish(); } };
    panel.addEventListener('transitionend', function te(e) {
      if (e.target !== panel || e.propertyName !== 'transform') return;
      panel.removeEventListener('transitionend', te);
      end();
    });
    setTimeout(() => dialog.open && !dialog.classList.contains('is-open') && end(), 400);
  }

  /* ---------- Vista: carrito ---------- */
  const ICON_TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';

  function render() {
    if (view !== 'cart') return;
    const e = C.escapeHTML;
    const ls = lines();
    const saved = ORDERS ? read(ORDERS_KEY, []) : [];
    const myOrders = saved.length ? `<div class="cart__orders">
        <p class="detail__label">Mis pedidos</p>
        <ul>${saved.slice(0, 5).map((o) => `<li><a href="#pedido/${e(o.id)}">${e(o.code)}<span>${new Date(o.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span></a></li>`).join('')}</ul>
      </div>` : '';

    if (!ls.length) {
      body.innerHTML = `<div class="cart__inner">
        <h2 class="cart__title" id="cart-title">Tu carrito</h2>
        <div class="cart__empty">
          <p class="empty__title">Todavía está vacío.</p>
          <p>${ORDERS ? 'Abre una pieza y toca "Agregar al carrito". Luego la apartas por WhatsApp y la pagas en tienda.' : 'Abre una pieza y toca "Agregar al carrito". Cuando estés lista, nos mandas tu lista por WhatsApp y te atendemos ahí.'}</p>
          <button class="button button--primary" type="button" data-cart-close>Ver catálogo</button>
        </div>
        ${myOrders}
      </div>`;
      return;
    }

    const { total, unpriced } = totals(ls);
    const n = pieces();
    body.innerHTML = `<div class="cart__inner">
      <h2 class="cart__title" id="cart-title">Tu carrito <small>${n} ${n === 1 ? 'pieza' : 'piezas'}</small></h2>
      <ul class="cart__lines">${ls.map((l) => {
        const img = C.imagesOf(l.p).find((im) => im.color === l.color) || C.imagesOf(l.p)[0];
        const max = limitOf(l.c);
        return `<li class="cart-line" data-line="${e(l.color)}">
          <img class="cart-line__img${img.fallback ? ' is-fallback' : ''}" src="${e(img.sm || img.src)}" alt="" width="64" height="80" loading="lazy" ${C.ON_IMG_ERROR} />
          <div class="cart-line__info">
            <span class="cart-line__name">${e(l.p.name)}</span>
            <span class="cart-line__meta">#${e(l.p.ref)}${l.c.name ? ` · ${e(l.c.name)}` : ''}</span>
            <span class="cart-line__price">${C.hasPrice(l.p) ? C.money.format(l.p.price * l.qty) : 'Consultar precio'}</span>
          </div>
          <div class="cart-line__qty">
            <div class="stepper stepper--sm" role="group" aria-label="Cantidad de ${e(l.p.name)}">
              <button class="stepper__btn" type="button" data-qty="-1" aria-label="${l.qty === 1 ? 'Quitar del carrito' : 'Una menos'}">${l.qty === 1 ? ICON_TRASH : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>'}</button>
              <output class="stepper__value">${l.qty}</output>
              <button class="stepper__btn" type="button" data-qty="1" aria-label="Una más"${l.qty >= max || n >= MAX_PIECES ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg></button>
            </div>
          </div>
        </li>`;
      }).join('')}</ul>

      <div class="cart__summary">
        <span>Total</span>
        <strong>${C.money.format(total)}${unpriced ? '<small> + piezas con precio por confirmar</small>' : ''}</strong>
      </div>

      ${ORDERS ? `<label class="cart__name">
        <span class="detail__label">Tu nombre <span class="cart__optional">(opcional)</span></span>
        <input data-cart-name maxlength="60" autocomplete="given-name" autocapitalize="words" enterkeyhint="send" placeholder="Para saber de quién es el pedido" />
      </label>

      <p class="cart__error" data-cart-error role="alert"></p>
      <button class="button button--primary cart__submit" type="button" data-cart-submit>Apartar por WhatsApp</button>
      <p class="cart__fine">Pagas en tienda. Te guardamos el pedido 7 días y te confirmamos por WhatsApp que todo siga disponible.</p>`
      : `<a class="button button--primary cart__submit" href="${e(waInterest(ls))}" target="_blank" rel="noopener" data-cart-send>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8z"/></svg>
          Enviar por WhatsApp</a>
        ${sent ? `<div class="cart__sent" role="status">
            <p>¿Ya enviaste tu lista? Te respondemos por ahí. 💜</p>
            <button class="button button--ghost" type="button" data-cart-clear>Vaciar carrito</button>
          </div>`
        : '<p class="cart__fine">Te respondemos por WhatsApp para confirmar disponibilidad y si lo quieres con envío o para recoger en tienda.</p>'}`}
      ${myOrders}
    </div>`;
    const nameInput = $('[data-cart-name]', body);
    if (nameInput) try { nameInput.value = localStorage.getItem('bagstore:name') || ''; } catch { /* sin almacenamiento */ }
  }

  // Modo directo: "Me interesan estas piezas…" listo para mandar a la tienda
  function waInterest(ls) {
    const { total, unpriced } = totals(ls);
    const one = ls.length === 1 && ls[0].qty === 1;
    const lines = ls.map((l) => `• ${l.qty > 1 ? `${l.qty} × ` : ''}#${l.p.ref} ${l.p.name}${l.c.name ? ` (${l.c.name})` : ''} — ${C.hasPrice(l.p) ? C.money.format(l.p.price * l.qty) : 'consultar precio'}`);
    const text = [
      `¡Hola! 💜 ${one ? 'Me interesa esta pieza' : 'Me interesan estas piezas'} del catálogo:`,
      ...lines,
      ls.length > 1 || ls[0].qty > 1 ? `Total: ${C.money.format(total)}${unpriced ? ' + piezas por consultar' : ''}` : '',
      '',
      one ? '¿Está disponible?' : '¿Están disponibles?',
    ].filter((x, k) => x !== '' || k > 0).join('\n').replace(/\n{3,}/g, '\n\n');
    return `https://wa.me/${C.store.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  }

  function setQty(colorId, delta) {
    const it = items.find((x) => x.color === colorId);
    const hit = find(colorId);
    if (!it || !hit) return;
    const next = it.qty + delta;
    sent = false;
    if (next <= 0) items = items.filter((x) => x !== it);
    else if (delta > 0 && (next > limitOf(hit.c) || pieces() >= MAX_PIECES)) return;
    else it.qty = next;
    write(CART_KEY, items);
    updateBadge();
    const scroll = body.scrollTop;
    const name = $('[data-cart-name]', body)?.value;
    render();
    if (name !== undefined && $('[data-cart-name]', body)) $('[data-cart-name]', body).value = name;
    body.scrollTop = scroll;
    $(`[data-line="${CSS.escape(colorId)}"] [data-qty="${delta}"]:not(:disabled)`, body)?.focus({ preventScroll: true });
    C.refreshSheet();
  }

  /* ---------- Crear el pedido ---------- */
  async function rpc(fn, args) {
    let res;
    try {
      res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
        method: 'POST', cache: 'no-store',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
    } catch {
      throw new Error('Sin conexión. Revisa tu internet e intenta de nuevo.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.message || '';
      // Los mensajes de create_order ya vienen en español claro
      throw new Error(/^(La pieza|Una pieza|Máximo|El carrito|Hay muchos)/.test(msg) ? msg : 'No pudimos crear el pedido. Intenta de nuevo en un momento.');
    }
    return data;
  }

  async function submit() {
    if (busy) return;
    const notes = clean();
    if (notes.length) { render(); updateBadge(); C.toast(notes.join(' · ')); return; }
    const ls = lines();
    if (!ls.length) return render();
    const nameInput = $('[data-cart-name]', body);
    const name = nameInput.value.trim();
    try { localStorage.setItem('bagstore:name', name); } catch { /* sin almacenamiento */ }
    const btn = $('[data-cart-submit]', body);
    const err = $('[data-cart-error]', body);
    busy = true;
    btn.disabled = true;
    btn.textContent = 'Creando tu pedido…';
    err.textContent = '';
    try {
      const order = await rpc('create_order', { items: ls.map((l) => ({ color: l.color, qty: l.qty })), customer_name: name || null });
      items = [];
      write(CART_KEY, items);
      updateBadge();
      const saved = read(ORDERS_KEY, []).filter((o) => o.id !== order.id);
      saved.unshift({ id: order.id, code: order.code, createdAt: order.createdAt });
      write(ORDERS_KEY, saved.slice(0, 10));
      C.refreshSheet();
      showOrder(order, { fresh: true });
    } catch (e) {
      err.textContent = e.message;
      btn.disabled = false;
      btn.textContent = 'Apartar por WhatsApp';
    } finally {
      busy = false;
    }
  }

  /* ---------- Vista: pedido con QR ---------- */
  const STATUS = {
    pending: ['Pendiente de pago', 'ok'],
    expired: ['Vencido', 'out'],
    paid: ['Pagado y entregado', 'paid'],
    cancelled: ['Cancelado', 'out'],
  };
  const adminURL = (id) => new URL(`admin/#pedido/${id}`, document.baseURI).href;

  function whatsappText(o) {
    const lines = o.items.map((i) => `• ${i.qty > 1 ? `${i.qty} × ` : ''}#${i.ref} ${i.name}${i.colorName ? ` (${i.colorName})` : ''} — ${i.price ? C.money.format(i.price * i.qty) : 'precio por confirmar'}`);
    return [
      `¡Hola! Quiero apartar este pedido 🛍️`,
      `Pedido ${o.code}`,
      ...lines,
      `Total: ${C.money.format(Number(o.total))}${o.hasUnpriced ? ' + piezas por confirmar' : ''}`,
      o.customerName ? `A nombre de: ${o.customerName}` : '',
      '',
      `Para la tienda: ${adminURL(o.id)}`,
    ].filter((x, k, a) => x !== '' || a[k - 1] !== '').join('\n');
  }

  let qrLoading = null;
  function loadQR() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    qrLoading ??= new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = QR_SRC;
      s.onload = () => resolve(window.qrcode);
      s.onerror = () => { qrLoading = null; reject(new Error('qr')); };
      document.head.append(s);
    });
    return qrLoading;
  }

  async function paintQR(o) {
    const box = $('[data-qr]', body);
    if (!box) return;
    try {
      const qrcode = await loadQR();
      const qr = qrcode(0, 'M');
      qr.addData(adminURL(o.id));
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: `Código QR del pedido ${o.code}` });
    } catch {
      box.innerHTML = '<p class="cart__fine">No se pudo dibujar el QR. En tienda basta con el código de arriba.</p>';
    }
  }

  function showOrder(o, { fresh = false } = {}) {
    view = 'order';
    const e = C.escapeHTML;
    const [label, tone] = STATUS[o.status] || STATUS.pending;
    const active = o.status === 'pending';
    const wa = C.store.whatsapp ? `https://wa.me/${C.store.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappText(o))}` : null;
    const until = new Date(o.expiresAt).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    body.innerHTML = `<div class="cart__inner order">
      <p class="eyebrow">${fresh ? '¡Listo! Tu pedido quedó registrado' : 'Tu pedido'}</p>
      <h2 class="order__code" id="cart-title">${e(o.code)}</h2>
      <span class="order__status" data-tone="${tone}">${label}</span>
      ${active ? `
        <div class="order__qr" data-qr aria-label="Código QR del pedido ${e(o.code)}"><span class="order__qr-loading">Generando QR…</span></div>
        <p class="order__hint">${fresh ? 'Paso 2: envíalo por WhatsApp. Luego muestra este QR (o el código) en tienda.' : 'Muestra este QR o el código en tienda para pagar.'}</p>
        ${wa ? `<a class="button button--primary order__wa" href="${e(wa)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>` : ''}
        <p class="cart__fine">Lo guardamos hasta el ${e(until)}. Te confirmamos por WhatsApp que todo siga disponible.</p>`
      : o.status === 'expired' ? '<p class="order__hint">Este pedido venció. Arma uno nuevo o escríbenos por WhatsApp.</p>'
      : ''}
      <ul class="order__items">${o.items.map((i) => `<li>
        <span>${i.qty > 1 ? `${i.qty} × ` : ''}${e(i.name)}${i.colorName ? ` · ${e(i.colorName)}` : ''} <small>#${e(i.ref)}</small></span>
        <span>${i.price ? C.money.format(i.price * i.qty) : 'Por confirmar'}</span></li>`).join('')}</ul>
      <div class="cart__summary"><span>Total</span><strong>${C.money.format(Number(o.total))}${o.hasUnpriced ? '<small> + piezas por confirmar</small>' : ''}</strong></div>
      <button class="button button--ghost cart__back" type="button" data-cart-close>Seguir viendo el catálogo</button>
    </div>`;
    body.scrollTop = 0;
    if (active) paintQR(o);
  }

  async function openOrder(id) {
    view = 'order';
    body.innerHTML = `<div class="cart__inner"><h2 class="cart__title" id="cart-title">Tu pedido</h2><p class="cart__fine">Cargando…</p></div>`;
    show();
    try {
      const o = await rpc('get_order', { oid: id });
      if (!o) throw new Error('No encontramos ese pedido.');
      showOrder(o);
    } catch (e) {
      body.innerHTML = `<div class="cart__inner"><h2 class="cart__title" id="cart-title">Tu pedido</h2>
        <p class="cart__error">${C.escapeHTML(e.message)}</p>
        <button class="button button--ghost cart__back" type="button" data-cart-close>Volver al catálogo</button></div>`;
    }
  }

  /* ---------- Eventos ---------- */
  function init(catalog) {
    C = catalog;
    if (!enabled()) { button.hidden = true; return; }
    button.hidden = false;
    clean();
    updateBadge();

    button.addEventListener('click', open);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) return close();
      if (e.target.closest('[data-cart-close]')) return close();
      const q = e.target.closest('[data-qty]');
      if (q && !q.disabled) return setQty(q.closest('[data-line]').dataset.line, Number(q.dataset.qty));
      if (e.target.closest('[data-cart-submit]') && ORDERS) return submit();
      if (e.target.closest('[data-cart-send]')) {
        // El enlace abre WhatsApp por sí solo; después se ofrece vaciar el carrito
        setTimeout(() => { sent = true; if (dialog.open && view === 'cart') { const y = body.scrollTop; render(); body.scrollTop = y; } }, 400);
        return;
      }
      if (e.target.closest('[data-cart-clear]')) {
        items = [];
        sent = false;
        write(CART_KEY, items);
        updateBadge();
        render();
        C.refreshSheet();
        C.toast('Carrito vacío');
        return;
      }
      const link = e.target.closest('a[href^="#pedido/"]');
      if (link) { e.preventDefault(); history.replaceState(null, '', link.getAttribute('href')); openOrder(link.getAttribute('href').slice(8)); }
    });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-cart-name]')) { e.preventDefault(); submit(); }
    });
    // Escape: acción de teclado → cierre instantáneo
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); close({ instant: true }); });
  }

  // El carrito solo tiene sentido con WhatsApp y con datos de Supabase (necesita el id de cada color)
  function enabled() {
    return !!(C && C.store.whatsapp && URL_ && C.products.some((p) => Array.isArray(p.colors) && p.colors.length));
  }

  window.BagCart = { init, enabled, room, add, open, openOrder };
})();
