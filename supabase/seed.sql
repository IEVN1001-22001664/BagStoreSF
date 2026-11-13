-- GENERADO por supabase/generate-seed.mjs desde assets/data/catalog.js. No editar a mano.
-- Ejecutar después de las migraciones. Vuelve a cargar el catálogo desde cero.
begin;

delete from public.products;

insert into public.store_settings (id, name, tagline, address, maps_url, whatsapp, instagram, currency, theme_color)
values (true, 'BAG STORE SF', 'Bags · Style · Elegance', 'Calle Altamirano #132, San Felipe, Gto.', 'https://www.google.com/maps/search/?api=1&query=Calle+Altamirano+132+San+Felipe+Guanajuato', '525631807025', null, 'MXN', '#aa83d0')
on conflict (id) do update set name = excluded.name, tagline = excluded.tagline, address = excluded.address,
  maps_url = excluded.maps_url, whatsapp = excluded.whatsapp, instagram = excluded.instagram,
  currency = excluded.currency, theme_color = excluded.theme_color;

insert into public.categories (id, label, position) values
  ('crossbody', 'Crossbody', 0),
  ('hombro', 'Hombro y Tote', 1),
  ('carteras', 'Carteras', 2),
  ('munequeras', 'Muñequeras', 3),
  ('pequenos', 'Monederos y tarjeteros', 4),
  ('fragancias', 'Fragancias', 5)
on conflict (id) do update set label = excluded.label, position = excluded.position;

-- #01 Body Mist Ariana Grande
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('01', 'Body Mist Ariana Grande', 'Ariana Grande', 'fragancias', 300, 0, '1794526833506-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 4, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/01-body-mist-ariana-grande-1.webp', 'assets/img/products/01-body-mist-ariana-grande-1-sm.webp', 556, 840, 0),
  ('assets/img/products/01-body-mist-ariana-grande-2.webp', 'assets/img/products/01-body-mist-ariana-grande-2-sm.webp', 566, 840, 1),
  ('assets/img/products/01-body-mist-ariana-grande-3.webp', 'assets/img/products/01-body-mist-ariana-grande-3-sm.webp', 628, 840, 2),
  ('assets/img/products/01-body-mist-ariana-grande-4.webp', 'assets/img/products/01-body-mist-ariana-grande-4-sm.webp', 671, 840, 3)
) as v(src, sm, w, h, pos);

-- #02 Body Mist Guess
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('02', 'Body Mist Guess', 'Guess', 'fragancias', 300, 1, '1794526907135-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 2, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/02-body-mist-guess-1.webp', 'assets/img/products/02-body-mist-guess-1-sm.webp', 1008, 840, 0),
  ('assets/img/products/02-body-mist-guess-2.webp', 'assets/img/products/02-body-mist-guess-2-sm.webp', 1008, 840, 1)
) as v(src, sm, w, h, pos);

-- #03 Cartera Bebe
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('03', 'Cartera Bebe', 'Bebe', 'carteras', 420, 2, '1794521926349-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/03-cartera-bebe-1.webp', 'assets/img/products/03-cartera-bebe-1-sm.webp', 471, 840, 0)
) as v(src, sm, w, h, pos);

-- #04 Cartera Cereza
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('04', 'Cartera Cereza', null, 'carteras', 300, 3, '1794520387837-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/04-cartera-cereza-1.webp', 'assets/img/products/04-cartera-cereza-1-sm.webp', 628, 840, 0),
  ('assets/img/products/04-cartera-cereza-2.webp', 'assets/img/products/04-cartera-cereza-2-sm.webp', 628, 840, 1)
) as v(src, sm, w, h, pos);

-- #05 Cartera Guess
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('05', 'Cartera Guess', 'Guess', 'carteras', 670, 4, '1794520982343-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/05-cartera-guess-1.webp', 'assets/img/products/05-cartera-guess-1-sm.webp', 1008, 840, 0)
) as v(src, sm, w, h, pos);

-- #06 Cartera Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('06', 'Cartera Muñequera Steve Madden', 'Steve Madden', 'carteras', 480, 5, '1794520112947-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/06-cartera-munequera-steve-madden-1.webp', 'assets/img/products/06-cartera-munequera-steve-madden-1-sm.webp', 1008, 840, 0),
  ('assets/img/products/06-cartera-munequera-steve-madden-2.webp', 'assets/img/products/06-cartera-munequera-steve-madden-2-sm.webp', 1008, 840, 1)
) as v(src, sm, w, h, pos);

-- #07 Cartera Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('07', 'Cartera Muñequera Steve Madden', 'Steve Madden', 'carteras', 530, 6, '1794520593951-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/07-cartera-munequera-steve-madden-1.webp', 'assets/img/products/07-cartera-munequera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #08 Cartera Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('08', 'Cartera Muñequera Steve Madden', 'Steve Madden', 'carteras', 480, 7, '1794521128027947fdc-jK9I')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/08-cartera-munequera-steve-madden-1.webp', 'assets/img/products/08-cartera-munequera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #09 Cartera Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('09', 'Cartera Muñequera Steve Madden', 'Steve Madden', 'carteras', 530, 8, '1794521341217-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/09-cartera-munequera-steve-madden-1.webp', 'assets/img/products/09-cartera-munequera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #10 Cartera Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('10', 'Cartera Muñequera Steve Madden', 'Steve Madden', 'carteras', 480, 9, '1794521375598-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/10-cartera-munequera-steve-madden-1.webp', 'assets/img/products/10-cartera-munequera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #11 Cartera Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('11', 'Cartera Muñequera Steve Madden', 'Steve Madden', 'carteras', 530, 10, '1794521408020-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/11-cartera-munequera-steve-madden-1.webp', 'assets/img/products/11-cartera-munequera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #12 Cartera Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('12', 'Cartera Muñequera Steve Madden', 'Steve Madden', 'carteras', 530, 11, '1794521450445-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/12-cartera-munequera-steve-madden-1.webp', 'assets/img/products/12-cartera-munequera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #13 Cartera Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('13', 'Cartera Muñequera Steve Madden', 'Steve Madden', 'carteras', 600, 12, '1794521556165-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/13-cartera-munequera-steve-madden-1.webp', 'assets/img/products/13-cartera-munequera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #14 Cartera Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('14', 'Cartera Muñequera Steve Madden', 'Steve Madden', 'carteras', 600, 13, '1794521585520-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/14-cartera-munequera-steve-madden-1.webp', 'assets/img/products/14-cartera-munequera-steve-madden-1-sm.webp', 471, 840, 0)
) as v(src, sm, w, h, pos);

-- #15 Cartera Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('15', 'Cartera Muñequera Steve Madden', 'Steve Madden', 'carteras', 600, 14, '1794521628610-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/15-cartera-munequera-steve-madden-1.webp', 'assets/img/products/15-cartera-munequera-steve-madden-1-sm.webp', 471, 840, 0)
) as v(src, sm, w, h, pos);

-- #16 Cartera Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('16', 'Cartera Muñequera Steve Madden', 'Steve Madden', 'carteras', 600, 15, '1794521865722-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/16-cartera-munequera-steve-madden-1.webp', 'assets/img/products/16-cartera-munequera-steve-madden-1-sm.webp', 471, 840, 0)
) as v(src, sm, w, h, pos);

-- #17 Cartera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('17', 'Cartera Steve Madden', 'Steve Madden', 'carteras', 530, 16, '1794520308988-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/17-cartera-steve-madden-1.webp', 'assets/img/products/17-cartera-steve-madden-1-sm.webp', 628, 840, 0),
  ('assets/img/products/17-cartera-steve-madden-2.webp', 'assets/img/products/17-cartera-steve-madden-2-sm.webp', 1008, 840, 1)
) as v(src, sm, w, h, pos);

-- #18 Cartera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('18', 'Cartera Steve Madden', 'Steve Madden', 'carteras', 530, 17, '1794520476012-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/18-cartera-steve-madden-1.webp', 'assets/img/products/18-cartera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #19 Cartera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('19', 'Cartera Steve Madden', 'Steve Madden', 'carteras', 530, 18, '1794521515807-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/19-cartera-steve-madden-1.webp', 'assets/img/products/19-cartera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #20 Crossbody Guess
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('20', 'Crossbody Guess', 'Guess', 'crossbody', 950, 19, '1794519271056-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/20-crossbody-guess-1.webp', 'assets/img/products/20-crossbody-guess-1-sm.webp', 850, 840, 0)
) as v(src, sm, w, h, pos);

-- #21 Crossbody Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('21', 'Crossbody Steve Madden', 'Steve Madden', 'crossbody', 850, 20, '1794518040251-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/21-crossbody-steve-madden-1.webp', 'assets/img/products/21-crossbody-steve-madden-1-sm.webp', 721, 840, 0)
) as v(src, sm, w, h, pos);

-- #22 Crossbody Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('22', 'Crossbody Steve Madden', 'Steve Madden', 'crossbody', 880, 21, '1794518819515-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/22-crossbody-steve-madden-1.webp', 'assets/img/products/22-crossbody-steve-madden-1-sm.webp', 724, 840, 0)
) as v(src, sm, w, h, pos);

-- #23 Crossbody Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('23', 'Crossbody Steve Madden', 'Steve Madden', 'crossbody', 1050, 22, '1794519599929-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/23-crossbody-steve-madden-1.webp', 'assets/img/products/23-crossbody-steve-madden-1-sm.webp', 588, 840, 0),
  ('assets/img/products/23-crossbody-steve-madden-2.webp', 'assets/img/products/23-crossbody-steve-madden-2-sm.webp', 628, 840, 1)
) as v(src, sm, w, h, pos);

-- #24 Crossbody Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('24', 'Crossbody Steve Madden', 'Steve Madden', 'crossbody', 800, 23, '1794519847410-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/24-crossbody-steve-madden-1.webp', 'assets/img/products/24-crossbody-steve-madden-1-sm.webp', 471, 840, 0)
) as v(src, sm, w, h, pos);

-- #25 Crossbody Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('25', 'Crossbody Steve Madden', 'Steve Madden', 'crossbody', 700, 24, '1794519180827-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/25-crossbody-steve-madden-1.webp', 'assets/img/products/25-crossbody-steve-madden-1-sm.webp', 819, 840, 0),
  ('assets/img/products/25-crossbody-steve-madden-2.webp', 'assets/img/products/25-crossbody-steve-madden-2-sm.webp', 461, 840, 1)
) as v(src, sm, w, h, pos);

-- #26 Crossbody Tommy Hilfiger
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('26', 'Crossbody Tommy Hilfiger', 'Tommy Hilfiger', 'crossbody', 700, 25, '1794518557814-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/26-crossbody-tommy-hilfiger-1.webp', 'assets/img/products/26-crossbody-tommy-hilfiger-1-sm.webp', 757, 840, 0)
) as v(src, sm, w, h, pos);

-- #27 Mini Crossbody Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('27', 'Mini Crossbody Steve Madden', 'Steve Madden', 'crossbody', 750, 26, '1794519066455-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/27-mini-crossbody-steve-madden-1.webp', 'assets/img/products/27-mini-crossbody-steve-madden-1-sm.webp', 668, 840, 0)
) as v(src, sm, w, h, pos);

-- #28 Mini Crossbody Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('28', 'Mini Crossbody Steve Madden', 'Steve Madden', 'crossbody', 900, 27, '1794519768095-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/28-mini-crossbody-steve-madden-1.webp', 'assets/img/products/28-mini-crossbody-steve-madden-1-sm.webp', 471, 840, 0)
) as v(src, sm, w, h, pos);

-- #29 Mini Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('29', 'Mini Steve Madden', 'Steve Madden', 'crossbody', 550, 28, '1794517659142-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/29-mini-steve-madden-1.webp', 'assets/img/products/29-mini-steve-madden-1-sm.webp', 471, 840, 0)
) as v(src, sm, w, h, pos);

-- #30 Monedero Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('30', 'Monedero Steve Madden', 'Steve Madden', 'pequenos', 420, 29, '1794520170442-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/30-monedero-steve-madden-1.webp', 'assets/img/products/30-monedero-steve-madden-1-sm.webp', 628, 840, 0),
  ('assets/img/products/30-monedero-steve-madden-2.webp', 'assets/img/products/30-monedero-steve-madden-2-sm.webp', 1008, 840, 1)
) as v(src, sm, w, h, pos);

-- #31 Monedero Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('31', 'Monedero Steve Madden', 'Steve Madden', 'pequenos', 420, 30, '1794520664079-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/31-monedero-steve-madden-1.webp', 'assets/img/products/31-monedero-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #32 Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('32', 'Muñequera Steve Madden', 'Steve Madden', 'munequeras', 670, 31, '1794520824764-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/32-munequera-steve-madden-1.webp', 'assets/img/products/32-munequera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #33 Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('33', 'Muñequera Steve Madden', 'Steve Madden', 'munequeras', 670, 32, '1794520862726-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/33-munequera-steve-madden-1.webp', 'assets/img/products/33-munequera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #34 Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('34', 'Muñequera Steve Madden', 'Steve Madden', 'munequeras', 670, 33, '1794520897757-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/34-munequera-steve-madden-1.webp', 'assets/img/products/34-munequera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #35 Muñequera Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('35', 'Muñequera Steve Madden', 'Steve Madden', 'munequeras', 670, 34, '1794521477685-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/35-munequera-steve-madden-1.webp', 'assets/img/products/35-munequera-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #36 Shoulder Bag Guess
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('36', 'Shoulder Bag Guess', 'Guess', 'hombro', 1250, 35, '1794518672102-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/36-shoulder-bag-guess-1.webp', 'assets/img/products/36-shoulder-bag-guess-1-sm.webp', 738, 840, 0)
) as v(src, sm, w, h, pos);

-- #37 Shoulder Bag Guess
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('37', 'Shoulder Bag Guess', 'Guess', 'hombro', 1200, 36, '1794519479464-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/37-shoulder-bag-guess-1.webp', 'assets/img/products/37-shoulder-bag-guess-1-sm.webp', 556, 840, 0)
) as v(src, sm, w, h, pos);

-- #38 Tarjetero Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('38', 'Tarjetero Steve Madden', 'Steve Madden', 'pequenos', 420, 37, '1794520024249-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/38-tarjetero-steve-madden-1.webp', 'assets/img/products/38-tarjetero-steve-madden-1-sm.webp', 640, 840, 0)
) as v(src, sm, w, h, pos);

-- #39 Tarjetero Steve Madden
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('39', 'Tarjetero Steve Madden', 'Steve Madden', 'pequenos', 420, 38, '1794521307352-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/39-tarjetero-steve-madden-1.webp', 'assets/img/products/39-tarjetero-steve-madden-1-sm.webp', 628, 840, 0)
) as v(src, sm, w, h, pos);

-- #40 Tote Bag Guess
with p as (
  insert into public.products (ref, name, brand, category_id, price, position, source_id)
  values ('40', 'Tote Bag Guess', 'Guess', 'hombro', 1200, 39, '1794517398637-jK9Ig')
  returning id
), c as (
  insert into public.product_colors (product_id, name, stock, position) select id, null, 1, 0 from p
)
insert into public.product_images (product_id, src, sm, width, height, position)
select p.id, v.src, v.sm, v.w, v.h, v.pos from p, (values
  ('assets/img/products/40-tote-bag-guess-1.webp', 'assets/img/products/40-tote-bag-guess-1-sm.webp', 571, 840, 0)
) as v(src, sm, w, h, pos);

-- Las piezas nuevas siguen la numeración: #41 en adelante
select setval('public.product_ref_seq', 40);

commit;
