/* BAG STORE SF — Catálogo (vanilla JS, sin dependencias) */
(() => {
  'use strict';

  let store, products; // llegan de data.js (Supabase, copia guardada o catalog.js)
  const $ = (sel, root = document) => root.querySelector(sel);

  let CATEGORIES = [
    { id: 'all', label: 'Todo' },
    { id: 'crossbody', label: 'Crossbody' },
    { id: 'hombro', label: 'Hombro y Tote' },
    { id: 'carteras', label: 'Carteras' },
    { id: 'munequeras', label: 'Muñequeras' },
    { id: 'pequenos', label: 'Monederos y tarjeteros' },
    { id: 'fragancias', label: 'Fragancias' },
  ];
  const HERO_REFS = ['21', '36', '27'];
  const MARQUEE = ['Steve Madden', 'Guess', 'Tommy Hilfiger', 'Bebe', 'Piezas originales', 'San Felipe, Gto.'];
  const FAV_KEY = 'bagstore:favs';

  let money;
  function setupMoney(currency = 'MXN') {
    const moneyInt = new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 });
    const moneyDec = new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    money = { format: (n) => (Number.isInteger(n) ? moneyInt : moneyDec).format(n) };
  }
  const hasPrice = (p) => typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0;
  const priceLabel = (p) => (hasPrice(p) ? money.format(p.price) : 'Consultar precio');
  const isSoldOut = (p) => p.stock === 0;
  const count = (n, one, many) => `${n.toLocaleString('es-MX')} ${n === 1 ? one : many}`;
  // Sin acentos ni puntuación: "O'Neill" se encuentra con "oneill"
  const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\s]/gu, '').toLowerCase();
  const PLACEHOLDER = { src: 'assets/img/brand/logo.webp', sm: 'assets/img/brand/logo.webp', w: 512, h: 512, fallback: true };
  const imagesOf = (p) => (Array.isArray(p.images) && p.images.length ? p.images : [PLACEHOLDER]);
  const ON_IMG_ERROR = `onerror="this.onerror=null;this.removeAttribute('srcset');this.src='${PLACEHOLDER.src}';this.classList.add('is-fallback')"`;
  const PAGE_SIZE = 24;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6"/></svg>';
  const CHEVRON = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg>`;

  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Favoritos (preferencia local, opcional) ---------- */
  const favs = new Set(readFavs());
  function readFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; }
  }
  function writeFavs() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch { /* modo privado */ }
  }

  /* ---------- Estado ---------- */
  const state = { category: 'all', brand: 'all', sort: 'featured', query: '', onlyFavs: false, limit: PAGE_SIZE };

  const els = {
    header: $('[data-header]'),
    grid: $('[data-grid]'),
    chips: $('[data-chips]'),
    brand: $('[data-brand]'),
    sort: $('[data-sort]'),
    search: $('[data-search]'),
    result: $('[data-result]'),
    empty: $('[data-empty]'),
    emptyTitle: $('[data-empty-title]'),
    emptyText: $('[data-empty-text]'),
    reset: $('[data-reset]'),
    more: $('[data-more]'),
    favFilter: $('[data-fav-filter]'),
    favCount: $('[data-fav-count]'),
    sheet: $('[data-sheet]'),
    sheetBody: $('[data-sheet-body]'),
    sheetPanel: $('[data-sheet-panel]'),
    toast: $('[data-toast]'),
  };

  /* ---------- Contenido estático ---------- */
  function renderStatic() {
    $('[data-total]').textContent = products.filter((p) => !isSoldOut(p)).length.toLocaleString('es-MX');
    $('[data-year]').textContent = new Date().getFullYear();
    $('[data-address]').textContent = store.address;
    $('[data-maps]').href = store.mapsUrl;

    const withPhoto = (p) => p && Array.isArray(p.images) && p.images.length;
    let heroItems = HERO_REFS.map((ref) => products.find((p) => p.ref === ref)).filter(withPhoto);
    if (heroItems.length < 3) heroItems = products.filter(withPhoto).slice(0, 3);
    const priced = products.filter((p) => hasPrice(p) && !isSoldOut(p)).map((p) => p.price);
    $('[data-hero-stack]').innerHTML = heroItems.map((p) =>
      `<div class="hero__card"><img src="${p.images[0].src}" alt="" width="${p.images[0].w}" height="${p.images[0].h}" fetchpriority="high" ${ON_IMG_ERROR} /></div>`
    ).join('') + (priced.length ? `<div class="hero__tag">Desde <span>${money.format(Math.min(...priced))}</span></div>` : '');

    const items = MARQUEE.map((t) => `<span class="marquee__item">${escapeHTML(t)}</span>`).join('');
    $('[data-marquee]').innerHTML = items + items; // duplicado para el loop infinito

    const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort();
    els.brand.innerHTML = '<option value="all">Marcas</option>' +
      brands.map((b) => `<option value="${escapeHTML(b)}">${escapeHTML(b)}</option>`).join('');
  }

  function renderChips() {
    const counts = products.reduce((acc, p) => ((acc[p.category] = (acc[p.category] || 0) + 1), acc), {});
    const known = new Set(CATEGORIES.map((c) => c.id));
    const extra = Object.keys(counts).filter((id) => !known.has(id)).map((id) => ({ id, label: catLabel(id) }));
    els.chips.innerHTML = [...CATEGORIES, ...extra]
      .filter((c) => c.id === 'all' || counts[c.id])
      .map((c) => `<button class="chip" type="button" role="tab" data-category="${c.id}" aria-selected="${state.category === c.id}">
          ${c.label} <small>${(c.id === 'all' ? products.length : counts[c.id]).toLocaleString('es-MX')}</small>
        </button>`).join('');
  }

  /* ---------- Filtrado ---------- */
  function filtered() {
    const q = normalize(state.query.trim());
    let list = products.filter((p) =>
      (state.category === 'all' || p.category === state.category) &&
      (state.brand === 'all' || p.brand === state.brand) &&
      (!state.onlyFavs || favs.has(p.ref)) &&
      (!q || normalize(`${p.name} ${p.brand || ''} ${p.ref}`).includes(q))
    );
    const dir = state.sort === 'price-asc' ? 1 : state.sort === 'price-desc' ? -1 : 0;
    return list
      .map((p, i) => ({ p, i }))
      .sort((a, b) =>
        isSoldOut(a.p) - isSoldOut(b.p) ||
        (dir && (!hasPrice(a.p) - !hasPrice(b.p) || dir * ((a.p.price || 0) - (b.p.price || 0)))) ||
        a.i - b.i)
      .map(({ p }) => p);
  }

  /* ---------- Grid ---------- */
  let observer;
  function cardHTML(p) {
    const imgs = imagesOf(p);
    const [main, alt] = imgs;
    const img = (im, cls) => im.fallback
      ? `<img class="card__img is-fallback ${cls}" src="${im.src}" alt="" loading="lazy" decoding="async" />`
      : `<img class="card__img ${cls}" src="${im.sm}" srcset="${im.sm} 460w, ${im.src} 1000w"
        sizes="(min-width: 1100px) 300px, (min-width: 700px) 32vw, 50vw" alt="" loading="lazy" decoding="async" ${ON_IMG_ERROR} />`;
    const soldOut = isSoldOut(p);
    const badge = soldOut ? '<span class="badge badge--out">Agotada</span>'
      : p.stock === 1 ? '<span class="badge">Pieza única</span>'
      : p.stock > 1 ? `<span class="badge badge--dark">Quedan ${p.stock.toLocaleString('es-MX')}</span>` : '';
    return `<li class="card is-pending${soldOut ? ' is-soldout' : ''}" data-ref="${p.ref}">
      <button class="card__hit" type="button" data-open="${p.ref}" aria-label="${escapeHTML(p.name)}, ${soldOut ? 'agotada' : priceLabel(p)}">
        <span class="card__media">
          ${img(main, '')}
          ${alt ? img(alt, 'card__img--alt') : ''}
          ${badge}
          ${imgs.length > 1 ? `<span class="card__photos">${imgs.length} fotos</span>` : ''}
        </span>
        <span class="card__info">
          <span class="card__brand">${escapeHTML(p.brand || 'Selección BS')}</span>
          <span class="card__name">${escapeHTML(p.name)}</span>
          <span class="card__meta"><span class="card__price${hasPrice(p) ? '' : ' card__price--ask'}">${priceLabel(p)}</span><span class="card__ref">#${p.ref}</span></span>
        </span>
      </button>
      <button class="heart" type="button" data-fav="${p.ref}" aria-pressed="${favs.has(p.ref)}" aria-label="Guardar ${escapeHTML(p.name)} en favoritos">${HEART}</button>
    </li>`;
  }

  function observeCards(cards) {
    observer ??= new IntersectionObserver((entries) => {
      let batch = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.style.setProperty('--stagger', Math.min(batch++, 7));
        e.target.classList.replace('is-pending', 'is-in');
        observer.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -40px 0px' });
    cards.forEach((c) => observer.observe(c));
  }

  let currentList = [];
  function renderGrid() {
    currentList = filtered();
    state.limit = PAGE_SIZE;
    observer?.disconnect();
    els.grid.innerHTML = currentList.slice(0, state.limit).map(cardHTML).join('');
    observeCards(els.grid.querySelectorAll('.card'));

    const total = products.length;
    els.empty.hidden = currentList.length > 0;
    if (total === 0) {
      els.emptyTitle.textContent = 'Muy pronto, nuevas piezas.';
      els.emptyText.textContent = 'Estamos preparando la próxima colección. Vuelve pronto.';
      els.reset.hidden = true;
    } else {
      els.emptyTitle.textContent = 'Nada por aquí… todavía.';
      els.emptyText.textContent = 'Prueba con otra búsqueda o categoría.';
      els.reset.hidden = false;
    }
    els.result.textContent = currentList.length === total
      ? count(total, 'pieza', 'piezas')
      : `${currentList.length.toLocaleString('es-MX')} de ${count(total, 'pieza', 'piezas')}`;
    updateMore();
  }

  function loadMore() {
    const start = state.limit;
    state.limit += PAGE_SIZE;
    els.grid.insertAdjacentHTML('beforeend', currentList.slice(start, state.limit).map(cardHTML).join(''));
    observeCards([...els.grid.children].slice(start));
    updateMore();
  }

  function updateMore() {
    const left = currentList.length - state.limit;
    els.more.hidden = left <= 0;
    if (left > 0) els.more.textContent = `Ver más · ${count(left, 'pieza', 'piezas')}`;
  }

  /* ---------- Favoritos UI ---------- */
  function toggleFav(ref) {
    favs.has(ref) ? favs.delete(ref) : favs.add(ref);
    writeFavs();
    document.querySelectorAll(`[data-fav="${ref}"]`).forEach((b) => b.setAttribute('aria-pressed', favs.has(ref)));
    updateFavCount(true);
    if (state.onlyFavs) renderGrid();
  }
  function updateFavCount(bump) {
    els.favCount.hidden = favs.size === 0;
    els.favCount.textContent = favs.size;
    if (bump && !reduceMotion.matches) {
      els.favCount.classList.add('is-bump');
      setTimeout(() => els.favCount.classList.remove('is-bump'), 90);
    }
  }

  /* ---------- Contacto ---------- */
  function contactFor(p) {
    const soldOut = isSoldOut(p);
    const price = hasPrice(p) ? ` (${money.format(p.price)})` : '';
    const msg = soldOut
      ? `¡Hola! Vi que la pieza #${p.ref} · ${p.name} está agotada. ¿Me avisan si vuelve a llegar?`
      : `¡Hola! Me interesa la pieza #${p.ref} · ${p.name}${price} del catálogo.${hasPrice(p) ? '' : ' ¿Qué precio tiene?'}`;
    if (store.whatsapp) return { href: `https://wa.me/${store.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, label: soldOut ? 'Avísame si vuelve' : 'Pedir por WhatsApp' };
    if (store.instagram) return { href: `https://ig.me/m/${store.instagram.replace(/^@/, '')}`, label: 'Escribir por Instagram' };
    return { href: store.mapsUrl, label: 'Apartar en tienda' };
  }

  /* ---------- Ficha de producto ---------- */
  function catLabel(id) {
    const known = CATEGORIES.find((c) => c.id === id);
    if (known) return known.label;
    const t = String(id || 'Accesorios').replace(/[-_]+/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  let current = null;

  function sheetHTML(p) {
    const contact = contactFor(p);
    const imgs = imagesOf(p);
    const soldOut = isSoldOut(p);
    const slides = imgs.map((im, i) =>
      `<div class="gallery__slide"><img ${im.fallback ? 'class="is-fallback" ' : ''}src="${im.src}" alt="${im.fallback ? 'Sin foto disponible' : `${escapeHTML(p.name)} — foto ${i + 1}`}" width="${im.w}" height="${im.h}" ${i ? 'loading="lazy"' : ''} ${ON_IMG_ERROR} /></div>`).join('');
    const multi = imgs.length > 1;
    return `
      <div class="gallery" data-gallery>
        <div class="gallery__track" data-track tabindex="0" aria-label="Fotos de ${escapeHTML(p.name)}">${slides}</div>
        ${multi ? `
          <button class="gallery__nav gallery__nav--prev" type="button" data-nav="-1" aria-label="Foto anterior" disabled>${CHEVRON('prev')}</button>
          <button class="gallery__nav gallery__nav--next" type="button" data-nav="1" aria-label="Foto siguiente">${CHEVRON('next')}</button>
          <div class="gallery__dots">${imgs.map((_, i) => `<button class="gallery__dot" type="button" data-dot="${i}" aria-label="Foto ${i + 1}" aria-current="${i === 0}"></button>`).join('')}</div>` : ''}
      </div>
      <div class="detail">
        <p class="detail__brand">${escapeHTML(p.brand || 'Selección BS')}</p>
        <h2 class="detail__title" id="sheet-title">${escapeHTML(p.name)}</h2>
        <p class="detail__price${hasPrice(p) ? '' : ' detail__price--ask'}">${priceLabel(p)}</p>
        <ul class="detail__tags">
          ${soldOut ? '<li class="is-out">Agotada</li>' : p.stock === 1 ? '<li class="is-hot">Pieza única</li>' : p.stock > 1 ? `<li>Quedan ${p.stock.toLocaleString('es-MX')}</li>` : ''}
          <li>${escapeHTML(catLabel(p.category))}</li>
          <li>Ref. #${p.ref}</li>
        </ul>
        ${p.description ? `<p class="detail__desc">${escapeHTML(p.description)}</p>` : ''}
        <p class="detail__note">${soldOut
          ? 'Esta pieza ya encontró dueña. Escríbenos y te avisamos si vuelve a llegar o te mostramos algo parecido.'
          : `Original y lista para estrenar. Visítanos en ${escapeHTML(store.address)} o apártala antes de que alguien más se enamore.`}</p>
        <div class="detail__actions">
          <a class="button button--primary" href="${contact.href}" target="_blank" rel="noopener">${contact.label}</a>
          <button class="icon-button" type="button" data-fav="${p.ref}" aria-pressed="${favs.has(p.ref)}" aria-label="Guardar en favoritos">${HEART}</button>
        </div>
        <button class="button button--ghost" type="button" data-share style="margin-top:10px;width:100%">${SHARE.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"')} Compartir</button>
      </div>`;
  }

  function openSheet(ref, { push = true } = {}) {
    const p = products.find((x) => x.ref === ref);
    if (!p) return;
    current = p;
    els.sheetBody.innerHTML = sheetHTML(p);
    els.sheetBody.scrollTop = 0;
    setupGallery();
    document.documentElement.classList.add('is-locked');
    if (!els.sheet.open) {
      els.sheet.showModal();
      // showModal enfoca el ✕ mientras el panel sigue fuera de pantalla: se reenfoca sin desplazar
      els.sheet.scrollTop = 0;
      $('[data-sheet-close]').focus({ preventScroll: true });
    }
    els.sheetPanel.style.transform = '';
    requestAnimationFrame(() => requestAnimationFrame(() => els.sheet.classList.add('is-open')));
    if (push) history.replaceState(null, '', `#producto-${p.ref}`);
  }

  function closeSheet({ instant = false } = {}) {
    if (!els.sheet.open) return;
    const finish = () => {
      els.sheet.close();
      els.sheet.classList.remove('is-dragging');
      els.sheetPanel.style.transform = '';
      document.documentElement.classList.remove('is-locked');
      const card = current && els.grid.querySelector(`[data-open="${current.ref}"]`);
      card?.focus({ preventScroll: true });
      current = null;
    };
    els.sheet.classList.remove('is-open');
    history.replaceState(null, '', location.pathname + location.search);
    if (instant || reduceMotion.matches) return finish();
    els.sheetPanel.addEventListener('transitionend', function done(e) {
      if (e.target !== els.sheetPanel || e.propertyName !== 'transform') return;
      els.sheetPanel.removeEventListener('transitionend', done);
      finish();
    });
    setTimeout(() => els.sheet.open && !els.sheet.classList.contains('is-open') && finish(), 400); // red de seguridad
  }

  function setupGallery() {
    const track = $('[data-track]', els.sheetBody);
    const dots = [...els.sheetBody.querySelectorAll('[data-dot]')];
    const prev = $('[data-nav="-1"]', els.sheetBody);
    const next = $('[data-nav="1"]', els.sheetBody);
    if (!dots.length) return;
    const index = () => Math.round(track.scrollLeft / track.clientWidth);
    const sync = () => {
      const i = index();
      dots.forEach((d, k) => d.setAttribute('aria-current', k === i));
      prev.disabled = i === 0;
      next.disabled = i === dots.length - 1;
    };
    const go = (i) => track.scrollTo({ left: i * track.clientWidth, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    prev.addEventListener('click', () => go(index() - 1));
    next.addEventListener('click', () => go(index() + 1));
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollLeft = (index() + 1) * track.clientWidth; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); track.scrollLeft = (index() - 1) * track.clientWidth; }
    });
  }

  /* Arrastrar para cerrar (móvil): velocidad o distancia, con fricción hacia arriba */
  function setupDrag() {
    const grabber = $('[data-sheet-grabber]');
    let startY = 0, startT = 0, dy = 0, pointerId = null;
    grabber.addEventListener('pointerdown', (e) => {
      if (pointerId !== null) return; // ignora un segundo dedo
      pointerId = e.pointerId;
      grabber.setPointerCapture(e.pointerId);
      startY = e.clientY; startT = performance.now(); dy = 0;
      els.sheet.classList.add('is-dragging');
    });
    grabber.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointerId) return;
      const raw = e.clientY - startY;
      dy = raw > 0 ? raw : -Math.sqrt(-raw) * 2; // amortiguación al tirar hacia arriba
      els.sheetPanel.style.transform = `translateY(${dy}px)`;
    });
    const end = (e) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      const velocity = Math.abs(dy) / (performance.now() - startT);
      els.sheet.classList.remove('is-dragging');
      if (dy > 120 || (dy > 10 && velocity > 0.11)) {
        els.sheetPanel.style.transform = '';
        closeSheet();
      } else {
        els.sheetPanel.style.transform = '';
      }
    };
    grabber.addEventListener('pointerup', end);
    grabber.addEventListener('pointercancel', end);
  }

  /* ---------- Compartir / toast ---------- */
  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2200);
  }
  async function share(p) {
    const url = `${location.origin}${location.pathname}#producto-${p.ref}`;
    const data = { title: `${p.name} · ${store.name}`, text: `${p.name} — ${priceLabel(p)}`, url };
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* cancelado */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } catch { toast(url); }
  }

  /* ---------- Eventos ---------- */
  function bind() {
    els.chips.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-category]');
      if (!chip) return;
      state.category = chip.dataset.category;
      els.chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-selected', c === chip));
      chip.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      renderGrid();
    });
    els.more.addEventListener('click', loadMore);
    els.brand.addEventListener('change', () => { state.brand = els.brand.value; renderGrid(); });
    els.sort.addEventListener('change', () => { state.sort = els.sort.value; renderGrid(); });
    let t;
    els.search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.query = els.search.value; renderGrid(); }, 120);
    });
    $('[data-reset]').addEventListener('click', () => {
      Object.assign(state, { category: 'all', brand: 'all', sort: 'featured', query: '', onlyFavs: false });
      els.search.value = ''; els.brand.value = 'all'; els.sort.value = 'featured';
      els.favFilter.setAttribute('aria-pressed', 'false');
      renderChips(); renderGrid();
    });
    els.favFilter.addEventListener('click', () => {
      state.onlyFavs = !state.onlyFavs;
      els.favFilter.setAttribute('aria-pressed', state.onlyFavs);
      if (state.onlyFavs && favs.size === 0) toast('Toca ♡ en una pieza para guardarla');
      renderGrid();
      document.getElementById('catalogo').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    });

    document.addEventListener('click', (e) => {
      const fav = e.target.closest('[data-fav]');
      if (fav) { toggleFav(fav.dataset.fav); return; }
      const open = e.target.closest('[data-open]');
      if (open) { openSheet(open.dataset.open); return; }
      if (e.target.closest('[data-sheet-close]')) { closeSheet(); return; }
      if (e.target.closest('[data-share]') && current) { share(current); }
    });

    // Clic en el fondo oscuro cierra
    els.sheet.addEventListener('click', (e) => { if (e.target === els.sheet) closeSheet(); });
    // Escape: acción de teclado → cierre instantáneo, sin animación
    els.sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet({ instant: true }); });

    window.addEventListener('hashchange', fromHash);
    const onScroll = () => els.header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function fromHash() {
    const m = location.hash.match(/^#producto-(\d+)$/);
    if (m) openSheet(m[1].padStart(2, '0'), { push: false });
    else if (els.sheet.open) closeSheet({ instant: true });
  }

  function boot(data) {
    store = data.store;
    products = data.products;
    if (Array.isArray(data.categories) && data.categories.length) {
      CATEGORIES = [{ id: 'all', label: 'Todo' }, ...data.categories];
    }
    setupMoney(store.currency || 'MXN');
    document.documentElement.dataset.catalogSource = data.source || 'bundled';
    els.grid.removeAttribute('aria-busy');
    renderStatic();
    renderChips();
    renderGrid();
    updateFavCount(false);
    bind();
    setupDrag();
    fromHash();
  }

  (window.BAGSTORE_READY || Promise.resolve(window.BAGSTORE)).then(boot);
})();
