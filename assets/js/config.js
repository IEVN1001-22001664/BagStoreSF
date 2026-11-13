/* BAG STORE SF — Conexión a Supabase (la usan el catálogo y el panel).
   La clave publicable es pública por diseño: las reglas RLS de la base protegen los datos.
   Nunca pongas aquí la clave service_role. */
window.BAGSTORE_CONFIG = {
  supabaseUrl: 'https://xspwkmkqeyzbuirjpytp.supabase.co',
  supabaseKey: 'sb_publishable_G3L7tZ7U_Zk-eFhl-gBSEg_4CRjCd3B',
  // false: el carrito solo arma la lista y la manda por WhatsApp ("Me interesan estas piezas…"); la dueña
  //        acuerda envío o recoger en tienda en el chat. No se crean pedidos ni hay QR, y el panel oculta Pedidos.
  // true:  sistema de apartado con pedido en Supabase, código BS-XXXX, QR y cobro en el panel (migración 004).
  orders: false,
};
