/* Datos de peor caso para break-ui. Solo desarrollo: dev/ está en .vercelignore.
   Se aplican sobre window.BAGSTORE (la misma frontera de datos que usa el catálogo). */
(() => {
  const real = window.BAGSTORE;
  const img = (ref) => real.products.find((p) => p.ref === ref).images;
  const many = [...img('01'), ...img('23'), ...img('04'), ...img('36'), ...img('27'), ...img('02')]; // 10+ fotos

  const worst = [
    // 1. Nombre largo y realista, precio con centavos, stock alto, muchas fotos
    { ref: '01', name: 'Crossbody Steve Madden Bvital con Monedero Desmontable Edición Rosa Palo', brand: 'Steve Madden', category: 'crossbody', price: 1899.5, stock: 12, images: many },
    // 2. Nombre de 4 letras, sin marca, agotada (stock 0) y precio 0
    { ref: '02', name: 'Mini', brand: null, category: 'carteras', price: 0, stock: 0, images: img('29') },
    // 3. Código de modelo sin espacios (así los capturan algunos proveedores), precio alto, 128 en stock
    { ref: '03', name: 'Guess HWPG787906-Noelle-Satchel-Logo-Peony-Multi', brand: 'Guess', category: 'hombro', price: 12450, stock: 128, images: img('36') },
    // 4. Comillas, apóstrofo, guion largo y una categoría nueva que no está en el menú
    { ref: '04', name: 'Mochila "Cereza" de Piel — Edición O\'Neill', brand: 'Bebe', category: 'mochilas', price: 899, stock: 1, images: img('04') },
    // 5. Foto que ya no existe (404) y stock desconocido
    { ref: '05', name: 'Cartera Guess', brand: 'Guess', category: 'carteras', price: 670, stock: null, images: [{ src: 'assets/img/products/no-existe.webp', sm: 'assets/img/products/no-existe-sm.webp', w: 600, h: 800 }] },
    // 6. Precio faltante (importación incompleta) y marca larga
    { ref: '06', name: 'Shoulder Bag', brand: 'Tommy Hilfiger Jeans Collection', category: 'hombro', price: null, stock: 1, images: img('26') },
    // 7-9. Nombres idénticos, solo la foto los distingue
    { ref: '07', name: 'Cartera Muñequera Steve Madden', brand: 'Steve Madden', category: 'carteras', price: 530, stock: 1, images: img('07') },
    { ref: '08', name: 'Cartera Muñequera Steve Madden', brand: 'Steve Madden', category: 'carteras', price: 530, stock: 1, images: img('09') },
    { ref: '09', name: 'Cartera Muñequera Steve Madden', brand: 'Steve Madden', category: 'carteras', price: 530, stock: 1, images: img('11') },
    // 10. Foto horizontal muy ancha
    { ref: '10', name: 'Body Mist Guess', brand: 'Guess', category: 'fragancias', price: 300, stock: 2, images: img('02') },
    // 11. Etiqueta HTML en el nombre: debe verse como texto
    { ref: '11', name: 'Tote <b>Guess</b> & Co.', brand: 'Guess', category: 'hombro', price: 1200, stock: 1, images: img('40') },
  ];

  const huge = Array.from({ length: 1000 }, (_, i) => {
    const base = real.products[i % real.products.length];
    return { ...base, ref: String(i + 1).padStart(2, '0') };
  });

  const sets = {
    demo: real.products,
    worst,
    empty: [],
    one: [real.products[22]],
    huge,
    nophoto: [{ ...real.products[0], ref: '01', images: [] }, ...real.products.slice(1, 8)],
  };
  const key = new URLSearchParams(location.search).get('data') || 'demo';
  window.BAGSTORE = { store: real.store, products: sets[key] || real.products };
  window.__BREAKUI_KEY = key;
})();
