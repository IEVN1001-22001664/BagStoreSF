-- BAG STORE SF · Esquema del catálogo
-- Ejecutar una sola vez en Supabase → SQL Editor (o `supabase db push`).
--
-- Modelo:
--   store_settings   1 fila con los datos de contacto de la tienda
--   categories       filtros del catálogo (crossbody, hombro, …)
--   products         la pieza: nombre, marca, precio, descripción, estado
--   product_colors   cada color de la pieza con su propia disponibilidad (stock)
--   product_images   fotos de la pieza; opcionalmente ligadas a un color
--   admins           correos que pueden editar (inician sesión con enlace mágico)
--
-- Reglas de disponibilidad (las mismas que ya maneja la UI):
--   stock null = disponible sin cantidad · 0 = agotada · 1 = pieza única · n = quedan n
--   El stock de la pieza se calcula de sus colores: si algún color es null → null; si no, la suma.
--
-- Lectura pública: una sola llamada  POST /rest/v1/rpc/catalog  devuelve { store, products }
-- con la misma forma que window.BAGSTORE, así app.js casi no cambia.

begin;

-- ---------------------------------------------------------------- utilidades
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- admins
create table public.admins (
  email      text primary key check (email = lower(btrim(email)) and email like '%@%'),
  created_at timestamptz not null default now()
);

-- security definer: las políticas pueden consultar admins sin exponer la tabla
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------- tienda
create table public.store_settings (
  id          boolean primary key default true check (id),  -- fuerza una sola fila
  name        text not null,
  tagline     text,
  address     text,
  maps_url    text,
  whatsapp    text check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$'),
  instagram   text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  currency    text not null default 'MXN',
  theme_color text check (theme_color is null or theme_color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at  timestamptz not null default now()
);
create trigger store_settings_touch before update on public.store_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- categorías
create table public.categories (
  id       text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  label    text not null check (btrim(label) <> ''),
  position int  not null default 0
);

-- ---------------------------------------------------------------- productos
create sequence public.product_ref_seq;

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique default lpad(nextval('public.product_ref_seq')::text, 2, '0'),
  name        text not null check (btrim(name) <> '' and length(name) <= 120),
  brand       text check (brand is null or btrim(brand) <> ''),
  category_id text not null references public.categories (id) on update cascade,
  price       numeric(10, 2) check (price is null or price >= 0),  -- null o 0 = "Consultar precio"
  description text check (description is null or length(description) <= 2000),
  status      text not null default 'active' check (status in ('active', 'archived')),
  position    int  not null default 0,          -- orden "Destacados" (menor primero)
  source_id   text,                             -- id de Kyte, solo para la migración
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index products_listing_idx on public.products (status, position, ref);
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

create table public.product_colors (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name       text check (name is null or btrim(name) <> ''),     -- null = sin color especificado
  hex        text check (hex is null or hex ~ '^#[0-9a-fA-F]{6}$'),
  stock      int  check (stock is null or stock >= 0),
  position   int  not null default 0,
  updated_at timestamptz not null default now()
);
create index product_colors_product_idx on public.product_colors (product_id, position);
create unique index product_colors_name_uniq on public.product_colors (product_id, lower(name)) where name is not null;
create trigger product_colors_touch before update on public.product_colors
  for each row execute function public.touch_updated_at();

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  color_id   uuid references public.product_colors (id) on delete set null,
  src        text not null,   -- ruta relativa (assets/…) o URL pública de Supabase Storage
  sm         text not null,   -- versión de 460px para la cuadrícula
  width      int  not null check (width > 0),
  height     int  not null check (height > 0),
  position   int  not null default 0
);
create index product_images_product_idx on public.product_images (product_id, position);

-- Un color solo puede tener fotos de su propia pieza
create or replace function public.check_image_color()
returns trigger language plpgsql as $$
begin
  if new.color_id is not null and not exists (
    select 1 from public.product_colors c where c.id = new.color_id and c.product_id = new.product_id
  ) then
    raise exception 'El color % no pertenece a la pieza %', new.color_id, new.product_id;
  end if;
  return new;
end $$;
create trigger product_images_color_check before insert or update on public.product_images
  for each row execute function public.check_image_color();

-- Cualquier cambio en colores o fotos marca la pieza como actualizada
create or replace function public.touch_parent_product()
returns trigger language plpgsql as $$
begin
  update public.products set updated_at = now()
  where id = coalesce(new.product_id, old.product_id);
  return null;
end $$;
create trigger product_colors_touch_parent after insert or update or delete on public.product_colors
  for each row execute function public.touch_parent_product();
create trigger product_images_touch_parent after insert or update or delete on public.product_images
  for each row execute function public.touch_parent_product();

-- ---------------------------------------------------------------- RLS
alter table public.admins          enable row level security;
alter table public.store_settings  enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.product_colors  enable row level security;
alter table public.product_images  enable row level security;

-- admins: cada quien solo ve si está en la lista; nadie la edita desde el sitio
create policy "admins: ver la propia fila" on public.admins
  for select to authenticated using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Lectura pública
create policy "tienda: lectura pública" on public.store_settings
  for select to anon, authenticated using (true);
create policy "categorías: lectura pública" on public.categories
  for select to anon, authenticated using (true);
create policy "productos: activos públicos, todos para admin" on public.products
  for select to anon, authenticated using (status = 'active' or (select public.is_admin()));
create policy "colores: de productos visibles" on public.product_colors
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id)  -- hereda el RLS de products
  );
create policy "fotos: de productos visibles" on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id)
  );

-- Escritura solo admin
create policy "tienda: admin edita" on public.store_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categorías: admin escribe" on public.categories
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "productos: admin escribe" on public.products
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "colores: admin escribe" on public.product_colors
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "fotos: admin escribe" on public.product_images
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------- lectura del catálogo
-- Devuelve { store, products } con la forma de window.BAGSTORE.
-- security invoker: respeta el RLS (el público solo recibe piezas activas).
create or replace function public.catalog()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'store', (
      select jsonb_build_object(
        'name', s.name, 'tagline', s.tagline, 'themeColor', s.theme_color,
        'address', s.address, 'mapsUrl', s.maps_url,
        'whatsapp', coalesce(s.whatsapp, ''), 'instagram', coalesce(s.instagram, ''),
        'currency', s.currency
      )
      from public.store_settings s
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label) order by c.position, c.id)
      from public.categories c
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(item order by p.position, p.ref)
      from public.products p
      cross join lateral (
        select jsonb_build_object(
          'ref', p.ref,
          'name', p.name,
          'brand', p.brand,
          'category', p.category_id,
          'price', p.price,
          'description', p.description,
          'stock', (
            select case
              when count(*) = 0 then null
              when bool_or(c.stock is null) then null
              else sum(c.stock)::int
            end
            from public.product_colors c where c.product_id = p.id
          ),
          'colors', coalesce((
            select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'hex', c.hex, 'stock', c.stock)
                             order by c.position)
            from public.product_colors c where c.product_id = p.id and c.name is not null
          ), '[]'::jsonb),
          'images', coalesce((
            select jsonb_agg(jsonb_build_object('src', i.src, 'sm', i.sm, 'w', i.width, 'h', i.height, 'color', i.color_id)
                             order by i.position)
            from public.product_images i where i.product_id = p.id
          ), '[]'::jsonb),
          'updatedAt', p.updated_at
        ) as item
      ) j
      where p.status = 'active'  -- también para admin: el panel usa sus propias consultas
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.catalog() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

commit;
