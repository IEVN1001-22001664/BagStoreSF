/* BAG STORE SF — Pedidos: lista, detalle (abre al escanear el QR) y cobro.
   "Pagado y entregado" llama a complete_order: baja el inventario de cada color en una sola
   operación y, si algo ya no alcanza, no cambia nada y dice qué ajustar. */
(() => {
  'use strict';

  const A = window.BagAdmin;
  const { api, $, escapeHTML: e, money, imgURL, toast } = A;
  const view = $('[data-view="order"]');
  const els = {
    list: $('[data-orders-list]'),
    status: $('[data-orders-status]'),
    filters: $('[data-orders-filters]'),
    search: $('[data-orders-search]'),
    badge: $('[data-orders-badge]'),
  };

  const STATUS = {
    pending: ['Pendiente', 'ok'],
    expired: ['Vencido', 'warn'],
    paid: ['Cobrado', 'paid'],
    cancelled: ['Cancelado', 'out'],
  };
  const FILTERS = [
    { id: 'open', label: 'Por cobrar', test: (o) => o.status === 'pending' || o.status === 'expired' },
    { id: 'paid', label: 'Cobrados', test: (o) => o.status === 'paid' },
    { id: 'cancelled', label: 'Cancelados', test: (o) => o.status === 'cancelled' },
  ];
  const state = { orders: [], filter: 'open', query: '', loading: null };
  let current = null;   // pedido abierto
  let qty = new Map();  // ajustes de cantidad antes de cobrar: itemId → qty
  let busy = false;

  const when = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const days = Math.round((Date.now() - d) / 864e5);
    const time = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
    if (days <= 0 && new Date().toDateString() === d.toDateString()) return `hoy ${time}`;
    if (days <= 1) return `ayer ${time}`;
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + ` ${time}`;
  };
  const pieces = (o) => o.items.reduce((n, i) => n + i.qty, 0);
  const totalLabel = (total, unpriced) => `${money.format(Number(total))}${unpriced ? ' + por confirmar' : ''}`;

  /* ---------- Lista ---------- */
  function loadList() {
    if (state.loading) return state.loading;
    els.status.hidden = false;
    els.status.classList.remove('is-error');
    els.status.textContent = state.orders.length ? 'Actualizando…' : 'Cargando pedidos…';
    state.loading = (async () => {
      try {
        state.orders = await api.listOrders();
        els.status.textContent = '';
        els.status.hidden = true;
        renderList();
        paintBadge();
      } catch (err) {
        els.status.textContent = err.message;
        els.status.classList.add('is-error');
      } finally {
        state.loading = null;
      }
    })();
    return state.loading;
  }

  function paintBadge() {
    const n = state.orders.filter((o) => o.status === 'pending').length;
    els.badge.hidden = n === 0;
    els.badge.textContent = n;
  }

  // Al entrar al panel: solo el número de pendientes (sin bloquear nada)
  async function refreshBadge() {
    try { state.orders = await api.listOrders(); paintBadge(); } catch { /* sin pedidos aún o sin migración 004 */ }
  }

  function renderList() {
    const q = A.normalize(state.query.trim()).replace(/\s+/g, '');
    els.filters.innerHTML = FILTERS.map((f) => `<button class="chip" type="button" role="tab" data-order-filter="${f.id}" aria-selected="${state.filter === f.id}">
      ${f.label} <small>${state.orders.filter(f.test).length}</small></button>`).join('');
    const f = FILTERS.find((x) => x.id === state.filter);
    // Al buscar se ignora el filtro: un código escaneado o dictado debe aparecer siempre
    const list = state.orders.filter((o) => (q ? A.normalize(`${o.code}${o.customerName || ''}`).replace(/\s+/g, '').includes(q) : f.test(o)));
    els.list.innerHTML = list.map((o) => {
      const [label, tone] = STATUS[o.status] || STATUS.pending;
      const n = pieces(o);
      return `<li><a class="order-card" href="#pedido/${e(o.id)}">
        <span class="order-card__top"><strong class="order-card__code">${e(o.code)}</strong><span class="order-pill" data-tone="${tone}">${label}</span></span>
        <span class="order-card__who">${e(o.customerName || 'Sin nombre')} · ${n} ${n === 1 ? 'pieza' : 'piezas'}</span>
        <span class="order-card__bottom"><span>${when(o.createdAt)}</span><strong>${totalLabel(o.total, o.hasUnpriced)}</strong></span>
      </a></li>`;
    }).join('');
    if (!list.length) {
      els.status.hidden = false;
      els.status.textContent = q ? 'Ningún pedido con ese código o nombre.' : state.filter === 'open' ? 'No hay pedidos por cobrar.' : 'Nada por aquí.';
    } else if (!els.status.classList.contains('is-error')) {
      els.status.hidden = true;
    }
  }

  els.filters.addEventListener('click', (ev) => {
    const chip = ev.target.closest('[data-order-filter]');
    if (!chip) return;
    state.filter = chip.dataset.orderFilter;
    renderList();
  });
  let t;
  els.search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.query = els.search.value; renderList(); }, 120);
  });

  /* ---------- Detalle ---------- */
  function shell(title, inner, footer = '') {
    return `<header class="admin-header editor-header">
        <div class="admin-header__inner">
          <a class="editor-back" href="#pedidos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>Pedidos</span></a>
          <h1 class="editor-header__title">${e(title)}</h1>
          <span class="editor-header__spacer" aria-hidden="true"></span>
        </div>
      </header>
      <div class="admin-main editor">${inner}</div>${footer}`;
  }

  let store = null; // nombre y dirección para los mensajes
  async function loadStore() {
    if (store) return store;
    try { store = await api.getStore(); } catch { store = null; }
    return store;
  }

  async function open(id) {
    loadStore().then(() => { if (current) render(); });
    current = null;
    qty = new Map();
    view.innerHTML = shell('Pedido', '<p class="admin-status">Cargando pedido…</p>');
    try {
      const o = await api.getOrder(id);
      if (!o) throw new Error('No encontramos ese pedido. Revisa el código con la clienta.');
      current = o;
      render();
    } catch (err) {
      view.innerHTML = shell('Pedido', `<p class="admin-status is-error">${e(err.message)}</p>`);
    }
  }

  function liveTotals() {
    let total = 0, unpriced = false;
    for (const i of current.items) {
      const n = qty.has(i.id) ? qty.get(i.id) : i.qty;
      if (!n) continue;
      if (i.price) total += i.price * n; else unpriced = true;
    }
    return { total, unpriced };
  }

  function itemHTML(i, editable) {
    const n = qty.has(i.id) ? qty.get(i.id) : i.qty;
    const short = editable && (i.colorExists === false || (i.stockNow !== null && i.stockNow < n));
    const avail = i.colorExists === false ? 'Esta pieza ya no está en el catálogo'
      : i.stockNow === null ? 'Disponible' : i.stockNow === 0 ? 'Agotada en el inventario' : `Quedan ${i.stockNow} en inventario`;
    return `<li class="order-item${n === 0 ? ' is-removed' : ''}${short ? ' is-short' : ''}" data-item="${e(i.id)}">
      <span class="stock-item__thumb">${i.image ? `<img src="${e(imgURL(i.image))}" alt="" width="56" height="70" loading="lazy" onerror="this.remove()" />` : ''}</span>
      <span class="order-item__info">
        <span class="stock-item__name">${e(i.name)}</span>
        <span class="stock-item__meta">#${e(i.ref)}${i.colorName ? ` · ${e(i.colorName)}` : ''} · ${i.price ? money.format(i.price) : 'Precio por confirmar'}</span>
        ${editable ? `<span class="order-item__avail">${avail}</span>` : ''}
      </span>
      ${editable
        ? `<div class="stepper stepper--sm" role="group" aria-label="Piezas de ${e(i.name)} que se lleva">
            <button class="stepper__btn" type="button" data-oqty="-1" aria-label="Una menos"${n === 0 ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg></button>
            <output class="stepper__value">${n}</output>
            <button class="stepper__btn" type="button" data-oqty="1" aria-label="Una más"${n >= i.qty ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg></button>
          </div>`
        : `<strong class="order-item__qty">× ${n}</strong>`}
    </li>`;
  }

  function render() {
    const o = current;
    const editable = o.status === 'pending' || o.status === 'expired';
    const [label, tone] = STATUS[o.status] || STATUS.pending;
    const { total, unpriced } = liveTotals();
    const short = editable && o.items.some((i) => {
      const n = qty.has(i.id) ? qty.get(i.id) : i.qty;
      return n > 0 && (i.colorExists === false || (i.stockNow !== null && i.stockNow < n));
    });
    const dates = [
      `Pedido: ${when(o.createdAt)}`,
      o.status === 'paid' ? `Cobrado: ${when(o.paidAt)}` : '',
      o.status === 'cancelled' ? `Cancelado: ${when(o.cancelledAt)}` : '',
      editable ? `${o.status === 'expired' ? 'Venció' : 'Vence'}: ${new Date(o.expiresAt).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}` : '',
    ].filter(Boolean).join(' · ');

    const inner = `<section class="editor-card order-head">
        <p class="order-head__code">${e(o.code)}</p>
        <span class="order-pill" data-tone="${tone}">${label}</span>
        <p class="order-head__who">${e(o.customerName || 'Sin nombre')}</p>
        <p class="editor-card__hint">${dates}</p>
      </section>
      <section class="editor-card">
        <h2 class="editor-card__title">Piezas</h2>
        ${editable ? '<p class="editor-card__hint">Si se lleva menos, ajusta con − antes de cobrar.</p>' : ''}
        <ul class="order-items">${o.items.map((i) => itemHTML(i, editable)).join('')}</ul>
        <div class="order-total"><span>Total a cobrar</span><strong>${totalLabel(total, unpriced)}</strong></div>
        ${unpriced && editable ? '<p class="editor-card__hint">Hay piezas sin precio: cóbralas aparte con el precio que acuerden.</p>' : ''}
        ${short ? '<p class="order-warn" role="alert">Una pieza no alcanza en el inventario. Bájala a lo que hay o ajusta la disponibilidad en Piezas.</p>' : ''}
      </section>
      ${messagesHTML(o)}
      ${editable ? `<section class="editor-card editor-card--danger">
        <h2 class="editor-card__title">Cancelar pedido</h2>
        <p class="editor-card__hint">Si la clienta ya no vendrá. No cambia el inventario.</p>
        <button class="button button--ghost editor-delete" type="button" data-order-cancel>Cancelar pedido</button>
      </section>` : ''}`;

    const footer = editable ? `<div class="savebar"><div class="savebar__inner">
        <span class="savebar__status" data-order-status aria-live="polite">${totalLabel(total, unpriced)}</span>
        <button class="button button--primary" type="button" data-order-pay>Pagado y entregado</button>
      </div></div>` : '';
    view.innerHTML = shell(o.code, inner, footer);
  }

  /* ---------- Mensajes para la clienta (copiar o compartir a WhatsApp) ---------- */
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  function itemsText(list) {
    return list.map((i) => `• ${i.qty > 1 ? `${i.qty} × ` : ''}${i.name}${i.colorName ? ` (${i.colorName})` : ''}${i.price ? ` — ${money.format(i.price * i.qty)}` : ''}`).join('\n');
  }
  function templates(o) {
    const hi = `¡Hola${o.customerName ? ` ${o.customerName.split(' ')[0]}` : ''}! 💜`;
    const where = store?.address ? `\n📍 ${store.address}${store.maps_url ? `\n${store.maps_url}` : ''}` : '';
    const total = totalLabel(o.total, o.hasUnpriced);
    const unavailable = o.items.filter((i) => i.colorExists === false || (i.stockNow !== null && i.stockNow < i.qty));
    const available = o.items.filter((i) => !unavailable.includes(i));
    const t = [];
    if (o.status === 'pending' || o.status === 'expired') {
      if (o.status === 'expired') {
        // vencido: solo el aviso de vencimiento (más abajo)
      } else if (!unavailable.length) {
        t.push({ id: 'confirm', label: 'Confirmar pedido', text:
          `${hi} Tu pedido *${o.code}* está confirmado ✅\n\n${itemsText(o.items)}\n\n*Total: ${total}*\nTe lo guardamos hasta el ${fmtDate(o.expiresAt)}.${where}\n\nAl llegar muestra tu código o el QR y pagas en tienda. ¡Te esperamos!` });
      } else {
        t.push({ id: 'short', label: 'Avisar que algo se agotó', text:
          `${hi} Gracias por tu pedido *${o.code}*. Una disculpa: ${unavailable.length === 1 ? 'esta pieza ya no está disponible' : 'estas piezas ya no están disponibles'}:\n${itemsText(unavailable)}\n\n${available.length ? `Sí tenemos:\n${itemsText(available)}\n\n¿Te lo apartamos así o prefieres que te mostremos algo parecido?` : '¿Te mostramos algo parecido?'}` });
      }
      if (o.status === 'pending') {
        t.push({ id: 'remind', label: 'Recordatorio', text:
          `${hi} Te recordamos que tu pedido *${o.code}* (${total}) te espera hasta el ${fmtDate(o.expiresAt)}.${where}\n\n¿Cuándo pasas por él? 🛍️` });
      } else {
        t.push({ id: 'expired', label: 'Pedido vencido', text:
          `${hi} Tu pedido *${o.code}* venció el ${fmtDate(o.expiresAt)}. Si todavía lo quieres, dinos y revisamos que todo siga disponible para apartártelo de nuevo.` });
      }
    }
    if (o.status === 'paid') {
      t.push({ id: 'thanks', label: 'Gracias por tu compra', text:
        `${hi} ¡Gracias por tu compra! 🛍️ Tu pedido *${o.code}* quedó pagado y entregado.\n\nNos encantará verte de nuevo. Mira lo nuevo en el catálogo: ${new URL('../', location.href).href}` });
    }
    if (o.status === 'cancelled') {
      t.push({ id: 'cancelled', label: 'Pedido cancelado', text:
        `${hi} Cancelamos tu pedido *${o.code}*. Si quieres armar otro, aquí está el catálogo: ${new URL('../', location.href).href}` });
    }
    return t;
  }

  function messagesHTML(o) {
    const list = templates(o);
    if (!list.length) return '';
    return `<section class="editor-card">
      <h2 class="editor-card__title">Mensajes para la clienta</h2>
      <p class="editor-card__hint">Toca "Enviar" y elige su chat de WhatsApp, o cópialo y pégalo en la conversación.</p>
      <div class="msg-list">${list.map((m) => `<details class="msg" data-msg="${m.id}">
        <summary>${e(m.label)}</summary>
        <p class="msg__text">${e(m.text)}</p>
        <div class="msg__actions">
          <button class="button button--primary" type="button" data-msg-share="${m.id}">Enviar…</button>
          <button class="button button--ghost" type="button" data-msg-copy="${m.id}">Copiar</button>
        </div>
      </details>`).join('')}</div>
    </section>`;
  }

  async function sendMessage(id, mode) {
    const m = current && templates(current).find((x) => x.id === id);
    if (!m) return;
    if (mode === 'share' && navigator.share) {
      try { await navigator.share({ text: m.text }); return; } catch (err) { if (err?.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(m.text);
      toast('Copiado. Pégalo en el chat de la clienta.');
    } catch {
      // Sin portapapeles: se selecciona el texto para copiarlo a mano
      const p = view.querySelector(`[data-msg="${id}"] .msg__text`);
      const r = document.createRange(); r.selectNodeContents(p);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      toast('Mantén presionado el texto para copiarlo.');
    }
  }

  async function pay() {
    if (busy || !current) return;
    const { total, unpriced } = liveTotals();
    const final = current.items.map((i) => ({ id: i.id, qty: qty.has(i.id) ? qty.get(i.id) : i.qty }));
    const n = final.reduce((s, x) => s + x.qty, 0);
    if (!n) return toast('El pedido quedó sin piezas. Mejor cancélalo.');
    if (!confirm(`¿Cobrado ${totalLabel(total, unpriced)} y entregadas ${n} ${n === 1 ? 'pieza' : 'piezas'} del pedido ${current.code}?\n\nEl inventario se descuenta en este momento.`)) return;
    await act(() => api.completeOrder(current.id, qty.size ? final : null), (o) => `Pedido ${o.code} cobrado. Inventario actualizado.`);
  }

  async function cancel() {
    if (busy || !current) return;
    if (!confirm(`¿Cancelar el pedido ${current.code}? El inventario no cambia.`)) return;
    await act(() => api.cancelOrder(current.id), (o) => `Pedido ${o.code} cancelado.`);
  }

  async function act(call, message) {
    busy = true;
    view.querySelectorAll('[data-order-pay], [data-order-cancel]').forEach((b) => { b.disabled = true; });
    const st = $('[data-order-status]', view);
    if (st) st.textContent = 'Guardando…';
    try {
      const o = await call();
      current = o;
      qty = new Map();
      toast(message(o));
      render();
      A.load({ quiet: true });  // la lista de piezas ya refleja el inventario nuevo
      loadList();
    } catch (err) {
      toast(err.message);
      // Recarga para ver la disponibilidad real y ajustar
      try { current = await api.getOrder(current.id); render(); } catch { render(); }
    } finally {
      busy = false;
    }
  }

  view.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-oqty]');
    if (b && !b.disabled && current) {
      const id = b.closest('[data-item]').dataset.item;
      const it = current.items.find((x) => x.id === id);
      const n = (qty.has(id) ? qty.get(id) : it.qty) + Number(b.dataset.oqty);
      qty.set(id, Math.max(0, Math.min(it.qty, n)));
      if (qty.get(id) === it.qty) qty.delete(id);
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
      view.querySelector(`[data-item="${CSS.escape(id)}"] [data-oqty="${b.dataset.oqty}"]:not(:disabled)`)?.focus({ preventScroll: true });
      return;
    }
    const share = ev.target.closest('[data-msg-share]');
    if (share) return sendMessage(share.dataset.msgShare, 'share');
    const copy = ev.target.closest('[data-msg-copy]');
    if (copy) return sendMessage(copy.dataset.msgCopy, 'copy');
    if (ev.target.closest('[data-order-pay]')) return pay();
    if (ev.target.closest('[data-order-cancel]')) return cancel();
  });

  window.BagOrders = { open, loadList, refreshBadge };
})();
