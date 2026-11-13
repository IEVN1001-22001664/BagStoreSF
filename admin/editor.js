/* BAG STORE SF — Editor de pieza: fotos, datos, colores con disponibilidad, visibilidad y borrar.
   Todo se edita en una copia local; "Guardar" sube las fotos nuevas y guarda la pieza de una sola vez
   (función save_product en Supabase), así nunca queda una pieza a medias. */
(() => {
  'use strict';

  const A = window.BagAdmin;
  const { api, $, escapeHTML, imgURL, toast } = A;
  const view = $('[data-view="editor"]');
  const sheet = $('[data-photo-sheet]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MAX_PHOTOS = 12;

  let draft = null;          // copia editable de la pieza
  let original = '';         // foto del estado guardado, para saber si hay cambios
  let busy = false;
  let openToken = 0;
  const uploaded = new Set(); // URLs subidas en esta edición (para limpiar si no se usan)

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

  const ICON = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  };

  function snapshot(d) {
    if (!d) return '';
    const { name, brand, category, price, description, status, colors } = d;
    return JSON.stringify({ name, brand, category, price, description, status, colors,
      images: d.images.map((i) => [i.id, i.src, i.color]) });
  }

  /* ---------- Abrir / cerrar ---------- */
  async function open(id) {
    discard();
    const token = ++openToken;
    view.innerHTML = shellHTML({ title: id ? 'Pieza' : 'Nueva pieza', body: '<p class="admin-status">Cargando…</p>' });
    try {
      if (!A.state.categories.length) await A.loadCategories();
      let d;
      if (id) {
        const p = A.mapProduct(await api.getProduct(id));
        d = { ...p, isNew: false, brand: p.brand || '', price: p.price === null ? '' : String(p.price), status: p.archived ? 'archived' : 'active' };
      } else {
        d = { id: uuid(), isNew: true, ref: null, name: '', brand: '', category: A.state.categories[0]?.id || '',
          price: '', description: '', status: 'active', colors: [{ id: uuid(), name: null, hex: null, stock: 1 }], images: [] };
      }
      if (!d.colors.length) d.colors.push({ id: uuid(), name: null, hex: null, stock: null });
      if (token !== openToken) return;
      draft = d;
      original = snapshot(draft);
      render();
    } catch (err) {
      if (token !== openToken) return;
      view.innerHTML = shellHTML({ title: 'Pieza', body: `<p class="admin-status is-error">${escapeHTML(err.message)}</p>
        <p class="admin-status"><a href="#piezas">Volver a la lista</a></p>` });
    }
  }

  function discard() {
    if (draft) {
      draft.images.forEach((i) => i.pending && URL.revokeObjectURL(i.pending.preview));
      // Fotos que se subieron pero la pieza nunca se guardó con ellas
      if (uploaded.size) api.removeFiles([...uploaded]).catch(() => {});
    }
    uploaded.clear();
    if (sheet.open) sheet.close();
    draft = null;
    original = '';
    openToken++;
    view.innerHTML = '';
  }

  const isDirty = () => !!draft && (snapshot(draft) !== original || draft.images.some((i) => i.pending || i.processing));

  /* ---------- Dibujo ---------- */
  function shellHTML({ title, body, footer = '' }) {
    return `<header class="admin-header editor-header">
        <div class="admin-header__inner">
          <a class="editor-back" href="#piezas">${ICON.back}<span>Piezas</span></a>
          <h1 class="editor-header__title">${escapeHTML(title)}</h1>
          <span class="editor-header__spacer" aria-hidden="true"></span>
        </div>
      </header>
      <div class="admin-main editor">${body}</div>${footer}`;
  }

  function render() {
    const d = draft;
    const cats = [...A.state.categories];
    if (d.category && !cats.some((c) => c.id === d.category)) cats.push({ id: d.category, label: d.category });
    const brands = [...new Set(A.state.products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

    const body = `<form data-editor novalidate>
      <section class="editor-card">
        <div class="editor-card__head"><h2 class="editor-card__title">Fotos</h2><span class="editor-card__count" data-photo-count></span></div>
        <p class="editor-card__hint">La primera es la portada. Toca una foto para moverla, ligarla a un color o quitarla.</p>
        <ul class="photo-strip" data-photos></ul>
      </section>

      <section class="editor-card">
        <h2 class="editor-card__title">Datos</h2>
        <label class="field"><span class="field__label">Nombre</span>
          <input name="name" value="${escapeHTML(d.name)}" maxlength="120" autocomplete="off" enterkeyhint="next" required />
          <span class="field__error" data-error="name"></span></label>
        <label class="field"><span class="field__label">Marca</span>
          <input name="brand" value="${escapeHTML(d.brand)}" maxlength="60" list="brand-list" autocomplete="off" enterkeyhint="next" placeholder="Opcional" />
          <datalist id="brand-list">${brands.map((b) => `<option value="${escapeHTML(b)}"></option>`).join('')}</datalist></label>
        <label class="field"><span class="field__label">Categoría</span>
          <span class="select"><select name="category">${cats.map((c) =>
            `<option value="${escapeHTML(c.id)}"${c.id === d.category ? ' selected' : ''}>${escapeHTML(c.label)}</option>`).join('')}</select></span>
          <span class="field__error" data-error="category"></span></label>
        <label class="field"><span class="field__label">Precio</span>
          <span class="field__money"><span aria-hidden="true">$</span>
            <input name="price" value="${escapeHTML(d.price)}" inputmode="decimal" autocomplete="off" enterkeyhint="next" placeholder="Consultar precio" /></span>
          <span class="field__hint">Vacío o 0 muestra "Consultar precio".</span>
          <span class="field__error" data-error="price"></span></label>
        <label class="field"><span class="field__label">Descripción</span>
          <textarea name="description" rows="4" maxlength="2000" placeholder="Material, medidas, detalles… (opcional)">${escapeHTML(d.description)}</textarea></label>
      </section>

      <section class="editor-card">
        <h2 class="editor-card__title">Colores y disponibilidad</h2>
        <p class="editor-card__hint">Si la pieza viene en un solo color, puedes dejar el nombre vacío.</p>
        <ul class="color-list" data-colors></ul>
        <span class="field__error" data-error="colors"></span>
        <button class="button button--lavender editor-add" type="button" data-add-color>${ICON.plus} Agregar color</button>
      </section>

      <section class="editor-card">
        <label class="switch-row">
          <span class="switch-row__text"><strong>Mostrar en el catálogo</strong>
            <span class="editor-card__hint">Apágalo para ocultar la pieza sin borrarla.</span></span>
          <input class="switch" type="checkbox" role="switch" name="visible"${d.status === 'active' ? ' checked' : ''} />
        </label>
      </section>

      ${d.isNew ? '' : `<section class="editor-card editor-card--danger">
        <h2 class="editor-card__title">Eliminar pieza</h2>
        <p class="editor-card__hint">Se borra con sus fotos y no se puede recuperar. Si solo se vendió, mejor márcala como agotada u ocúltala.</p>
        <button class="button button--ghost editor-delete" type="button" data-delete>${ICON.trash} Eliminar para siempre</button>
      </section>`}
    </form>`;

    const footer = `<div class="savebar"><div class="savebar__inner">
        <span class="savebar__status" data-save-status aria-live="polite"></span>
        <button class="button button--primary" type="button" data-save>${d.isNew ? 'Crear pieza' : 'Guardar'}</button>
      </div></div>`;

    view.innerHTML = shellHTML({ title: d.isNew ? 'Nueva pieza' : `Pieza #${d.ref}`, body, footer });
    renderPhotos();
    renderColors();
  }

  function renderPhotos() {
    const d = draft;
    const strip = $('[data-photos]', view);
    const named = new Map(d.colors.filter((c) => c.name).map((c) => [c.id, c]));
    strip.innerHTML = d.images.map((img, i) => {
      if (img.processing) return `<li><span class="photo is-processing" aria-label="Preparando foto"><span>Preparando…</span></span></li>`;
      const src = img.pending ? img.pending.preview : imgURL(img.sm || img.src);
      const color = img.color && named.get(img.color);
      return `<li><button class="photo" type="button" data-photo="${img.id}" aria-label="Foto ${i + 1}${i === 0 ? ', portada' : ''}${color ? `, color ${escapeHTML(color.name)}` : ''}">
        <img src="${escapeHTML(src)}" alt="" onerror="this.classList.add('is-broken')" />
        ${i === 0 ? '<span class="photo__badge">Portada</span>' : ''}
        ${img.pending ? '<span class="photo__badge photo__badge--new">Nueva</span>' : ''}
        ${color ? `<span class="photo__color"${color.hex ? ` style="background:${escapeHTML(color.hex)}"` : ''} aria-hidden="true"></span>` : ''}
      </button></li>`;
    }).join('') + (d.images.length < MAX_PHOTOS ? `<li><label class="photo photo--add">
        <input type="file" accept="image/*" multiple data-file class="sr-only" />
        ${ICON.camera}<span>Agregar fotos</span></label></li>` : '');
    $('[data-photo-count]', view).textContent = d.images.length ? `${d.images.length} de ${MAX_PHOTOS}` : '';
  }

  function renderColors() {
    const d = draft;
    const single = d.colors.length === 1;
    $('[data-colors]', view).innerHTML = d.colors.map((c) => `<li class="color-edit" data-cid="${c.id}">
      <div class="color-edit__top">
        <label class="color-edit__swatch"${c.hex ? ` style="background:${escapeHTML(c.hex)}"` : ' data-empty'}>
          <input type="color" value="${escapeHTML(c.hex || '#aa83d0')}" data-hex aria-label="Tono de ${escapeHTML(c.name || 'este color')}" />
        </label>
        <input class="color-edit__name" data-cname value="${escapeHTML(c.name || '')}" maxlength="40" autocomplete="off" enterkeyhint="done"
          placeholder="${single ? 'Color (opcional)' : 'Nombre del color'}" aria-label="Nombre del color" />
        <button class="icon-button color-edit__remove" type="button" data-remove-color aria-label="Quitar ${escapeHTML(c.name || 'este color')}"${single ? ' disabled' : ''}>${ICON.trash}</button>
      </div>
      <div class="color-edit__bottom" data-tone="${A.stockTone(c.stock)}">
        <span class="stock-row__state" data-state>${A.stockLabel(c.stock)}</span>
        ${A.stepperHTML(c.stock, `Piezas${c.name ? ` en ${c.name}` : ''}`)}
      </div>
    </li>`).join('');
  }

  function paintColor(cid) {
    const c = draft.colors.find((x) => x.id === cid);
    const li = view.querySelector(`[data-cid="${cid}"]`);
    if (!c || !li) return;
    const bottom = $('.color-edit__bottom', li);
    bottom.dataset.tone = A.stockTone(c.stock);
    $('[data-state]', li).textContent = A.stockLabel(c.stock);
    $('[data-value]', li).textContent = c.stock === null ? '—' : c.stock;
    $('[data-step="-1"]', li).disabled = c.stock === 0;
    $('[data-step="1"]', li).disabled = c.stock !== null && c.stock >= A.MAX_STOCK;
  }

  /* ---------- Fotos ---------- */
  async function addFiles(files) {
    const room = MAX_PHOTOS - draft.images.length;
    const list = [...files].slice(0, room);
    if (files.length > room) toast(`Solo caben ${MAX_PHOTOS} fotos por pieza.`);
    const items = list.map((file) => ({ id: uuid(), file, processing: true, src: '', sm: '', color: null }));
    draft.images.push(...items);
    renderPhotos();
    const d = draft;
    for (const item of items) {
      try {
        const out = await window.BagImages.prepare(item.file);
        if (d !== draft) { URL.revokeObjectURL(out.preview); return; } // se cerró el editor
        Object.assign(item, { pending: out, w: out.w, h: out.h, processing: false });
      } catch (err) {
        if (d !== draft) return;
        draft.images.splice(draft.images.indexOf(item), 1);
        toast(err.message);
      }
      delete item.file;
      renderPhotos();
    }
  }

  let sheetPhoto = null;
  function openSheet(photoId) {
    const i = draft.images.findIndex((x) => x.id === photoId);
    if (i < 0) return;
    sheetPhoto = photoId;
    const img = draft.images[i];
    $('[data-photo-preview]', sheet).src = img.pending ? img.pending.preview : imgURL(img.sm || img.src);
    $('#photo-sheet-title').textContent = `Foto ${i + 1} de ${draft.images.length}`;
    sheet.querySelector('[data-photo-action="first"]').disabled = i === 0;
    sheet.querySelector('[data-photo-action="left"]').disabled = i === 0;
    sheet.querySelector('[data-photo-action="right"]').disabled = i === draft.images.length - 1;
    const named = draft.colors.filter((c) => c.name);
    const wrap = $('[data-photo-color-wrap]', sheet);
    wrap.hidden = !named.length;
    $('[data-photo-color]', sheet).innerHTML = `<option value="">Todos los colores</option>` +
      named.map((c) => `<option value="${c.id}"${img.color === c.id ? ' selected' : ''}>${escapeHTML(c.name)}</option>`).join('');
    sheet.showModal();
    sheet.scrollTop = 0;
    $('[data-photo-action="close"]', sheet).focus({ preventScroll: true });
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('is-open')));
  }

  function closeSheet({ instant = false } = {}) {
    if (!sheet.open) return;
    sheet.classList.remove('is-open');
    const finish = () => { if (sheet.open) sheet.close(); sheetPhoto = null; };
    if (instant || reduceMotion.matches) return finish();
    setTimeout(finish, 220);
  }

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) return closeSheet();
    const btn = e.target.closest('[data-photo-action]');
    if (!btn || !draft) return;
    const action = btn.dataset.photoAction;
    const imgs = draft.images;
    const i = imgs.findIndex((x) => x.id === sheetPhoto);
    if (action === 'close' || i < 0) return closeSheet();
    if (action === 'first') imgs.unshift(...imgs.splice(i, 1));
    if (action === 'left' && i > 0) [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]];
    if (action === 'right' && i < imgs.length - 1) [imgs[i + 1], imgs[i]] = [imgs[i], imgs[i + 1]];
    if (action === 'remove') {
      const [gone] = imgs.splice(i, 1);
      if (gone.pending) URL.revokeObjectURL(gone.pending.preview);
    }
    renderPhotos();
    closeSheet();
  });
  sheet.addEventListener('change', (e) => {
    if (!e.target.matches('[data-photo-color]') || !draft) return;
    const img = draft.images.find((x) => x.id === sheetPhoto);
    if (img) img.color = e.target.value || null;
    renderPhotos();
  });
  // Escape: acción de teclado → se cierra sin animación
  sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet({ instant: true }); });

  /* ---------- Validar y guardar ---------- */
  function parsePrice(v) {
    const t = String(v).replace(/[$\s,]/g, '');
    if (!t) return { value: null };
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(t)) return { error: 'Escribe solo el número, por ejemplo 1299 o 1299.50.' };
    return { value: Number(t) };
  }

  function validate() {
    const e = {};
    if (!draft.name.trim()) e.name = 'Escribe el nombre de la pieza.';
    if (!draft.category) e.category = 'Elige una categoría.';
    const price = parsePrice(draft.price);
    if (price.error) e.price = price.error;
    if (draft.colors.length > 1) {
      const names = draft.colors.map((c) => (c.name || '').trim().toLowerCase());
      if (names.some((n) => !n)) e.colors = 'Ponle nombre a cada color (o deja uno solo).';
      else if (new Set(names).size !== names.length) e.colors = 'Hay dos colores con el mismo nombre.';
    }
    return { errors: e, price: price.value };
  }

  function showErrors(errors) {
    view.querySelectorAll('[data-error]').forEach((el) => { el.textContent = errors[el.dataset.error] || ''; });
    const first = Object.keys(errors)[0];
    if (!first) return false;
    const target = first === 'colors' ? $('[data-colors]', view) : view.querySelector(`[name="${first}"]`);
    target?.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    if (first !== 'colors') target?.focus({ preventScroll: true });
    return true;
  }

  function setBusy(on, text = '') {
    busy = on;
    const btn = $('[data-save]', view);
    if (btn) btn.disabled = on;
    const st = $('[data-save-status]', view);
    if (st) st.textContent = text;
    view.querySelector('[data-editor]')?.toggleAttribute('inert', on);
  }

  async function save() {
    if (busy || !draft) return;
    if (draft.images.some((i) => i.processing)) return toast('Espera a que terminen de prepararse las fotos.');
    const { errors, price } = validate();
    if (showErrors(errors)) return toast('Revisa los campos marcados.');

    const d = draft;
    setBusy(true, 'Guardando…');
    try {
      const pending = d.images.filter((i) => i.pending);
      for (const [n, img] of pending.entries()) {
        setBusy(true, `Subiendo foto ${n + 1} de ${pending.length}…`);
        const base = `${d.id}/${img.id}`;
        img.src = await api.upload(`${base}.${img.pending.ext}`, img.pending.big);
        uploaded.add(img.src);
        img.sm = await api.upload(`${base}-sm.${img.pending.ext}`, img.pending.sm);
        uploaded.add(img.sm);
        URL.revokeObjectURL(img.pending.preview);
        delete img.pending;
      }
      setBusy(true, 'Guardando…');
      const named = new Set(d.colors.filter((c) => c.name?.trim()).map((c) => c.id));
      const res = await api.saveProduct({
        id: d.id,
        name: d.name.trim(),
        brand: d.brand.trim() || null,
        category: d.category,
        price,
        description: d.description.trim() || null,
        status: d.status,
        colors: d.colors.map((c) => ({ id: c.id, name: c.name?.trim() || null, hex: c.hex || null, stock: c.stock })),
        images: d.images.map((i) => ({ id: i.id, src: i.src, sm: i.sm, w: i.w, h: i.h, color: i.color && named.has(i.color) ? i.color : null })),
      });
      // Limpia Storage: fotos quitadas de la pieza y subidas que al final no se usaron
      const used = new Set(d.images.flatMap((i) => [i.src, i.sm]));
      const leftovers = [...(res.removed || []), ...[...uploaded].filter((u) => !used.has(u))];
      uploaded.clear();
      if (leftovers.length) api.removeFiles(leftovers).catch(() => {});
      original = snapshot(d);
      toast(d.isNew ? `Pieza #${res.ref} creada` : 'Cambios guardados');
      A.load({ quiet: true });
      A.go('#piezas');
    } catch (err) {
      if (d === draft) { setBusy(false); renderPhotos(); }
      toast(err.message);
    } finally {
      if (d === draft) setBusy(false);
    }
  }

  async function remove() {
    if (busy || !draft || draft.isNew) return;
    if (!confirm(`¿Eliminar "${draft.name}" para siempre?\n\nSe borran sus fotos y no se puede deshacer.`)) return;
    const d = draft;
    setBusy(true, 'Eliminando…');
    try {
      const res = await api.deleteProduct(d.id);
      if (res?.removed?.length) api.removeFiles(res.removed).catch(() => {});
      original = snapshot(d);
      toast(`"${d.name}" se eliminó`);
      A.load({ quiet: true });
      A.go('#piezas');
    } catch (err) {
      toast(err.message);
      if (d === draft) setBusy(false);
    }
  }

  /* ---------- Eventos (delegados en la vista) ---------- */
  view.addEventListener('input', (e) => {
    if (!draft) return;
    const t = e.target;
    if (['name', 'brand', 'price', 'description'].includes(t.name)) draft[t.name] = t.value;
    if (t.matches('[data-cname]')) {
      const c = draft.colors.find((x) => x.id === t.closest('[data-cid]').dataset.cid);
      if (c) c.name = t.value || null;
    }
    if (t.matches('[data-hex]')) {
      const c = draft.colors.find((x) => x.id === t.closest('[data-cid]').dataset.cid);
      if (c) {
        c.hex = t.value;
        const sw = t.closest('.color-edit__swatch');
        sw.style.background = t.value;
        sw.removeAttribute('data-empty');
      }
    }
    const err = t.name && view.querySelector(`[data-error="${t.name}"]`);
    if (err) err.textContent = '';
  });

  view.addEventListener('change', (e) => {
    if (!draft) return;
    const t = e.target;
    if (t.name === 'category') draft.category = t.value;
    if (t.name === 'visible') draft.status = t.checked ? 'active' : 'archived';
    if (t.matches('[data-file]') && t.files?.length) { addFiles(t.files); t.value = ''; }
    if (t.matches('[data-cname]')) renderPhotos(); // el nombre del color aparece en las fotos ligadas
  });

  view.addEventListener('click', (e) => {
    if (!draft) return;
    const t = e.target;
    const stepBtn = t.closest('[data-step]');
    if (stepBtn && !stepBtn.disabled) {
      const cid = stepBtn.closest('[data-cid]').dataset.cid;
      const c = draft.colors.find((x) => x.id === cid);
      c.stock = A.nextStock(c.stock, Number(stepBtn.dataset.step));
      return paintColor(cid);
    }
    if (t.closest('[data-add-color]')) {
      const c = { id: uuid(), name: null, hex: null, stock: 1 };
      draft.colors.push(c);
      renderColors();
      view.querySelector(`[data-cid="${c.id}"] [data-cname]`)?.focus();
      return;
    }
    const rm = t.closest('[data-remove-color]');
    if (rm && !rm.disabled) {
      const cid = rm.closest('[data-cid]').dataset.cid;
      draft.colors = draft.colors.filter((x) => x.id !== cid);
      draft.images.forEach((i) => { if (i.color === cid) i.color = null; });
      renderColors();
      renderPhotos();
      return;
    }
    const photo = t.closest('[data-photo]');
    if (photo) return openSheet(photo.dataset.photo);
    if (t.closest('[data-save]')) return save();
    if (t.closest('[data-delete]')) return remove();
  });

  // Enter en un campo no envía el formulario
  view.addEventListener('submit', (e) => e.preventDefault());

  window.BagEditor = { open, discard, isDirty };
})();
