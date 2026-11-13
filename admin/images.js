/* BAG STORE SF — Preparar fotos en el teléfono antes de subirlas.
   Corrige la orientación (EXIF), reduce a las dos medidas del catálogo y comprime a WebP
   (JPEG si el navegador no sabe codificar WebP, como Safari antiguo). Nada sale del teléfono hasta Guardar. */
(() => {
  'use strict';

  const BIG = { w: 1000, h: 1250 };  // ficha de producto
  const SMALL = { w: 460, h: 620 };  // cuadrícula
  const MAX_INPUT = 40 * 1024 * 1024;

  const fit = (w, h, box) => {
    const s = Math.min(1, box.w / w, box.h / h);
    return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
  };

  async function decode(file) {
    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* formato raro: probar con <img> */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function toBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  async function encode(source, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff'; // PNG con transparencia → fondo blanco
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    let blob = await toBlob(canvas, 'image/webp', 0.82);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85);
    canvas.width = canvas.height = 0; // libera memoria en iOS
    if (!blob) throw new Error('No se pudo preparar la foto.');
    return { blob, canvas: null };
  }

  /** Devuelve { big, sm, w, h, ext, preview } listo para subir. */
  async function prepare(file) {
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) throw new Error(`"${file.name}" no es una foto.`);
    if (file.size > MAX_INPUT) throw new Error(`"${file.name}" pesa demasiado.`);
    let bitmap;
    try {
      bitmap = await decode(file);
    } catch {
      throw new Error(`No se pudo abrir "${file.name}". Prueba con otra foto o tómala de nuevo.`);
    }
    const sw = bitmap.width || bitmap.naturalWidth;
    const sh = bitmap.height || bitmap.naturalHeight;
    const [w, h] = fit(sw, sh, BIG);
    const [sw2, sh2] = fit(sw, sh, SMALL);
    const big = (await encode(bitmap, w, h)).blob;
    const sm = (await encode(bitmap, sw2, sh2)).blob;
    bitmap.close?.();
    return { big, sm, w, h, ext: big.type === 'image/webp' ? 'webp' : 'jpg', preview: URL.createObjectURL(sm) };
  }

  window.BagImages = { prepare };
})();
