-- BAG STORE SF · Carrito y pedidos (apartado para pagar en tienda)
-- Ejecutar después de 001–003 en Supabase → SQL Editor. Se puede volver a correr.
--
-- Flujo: la clienta arma su carrito → create_order (pública) guarda el pedido con un código corto
-- (BS-7K4Q) y los precios del momento → manda el pedido por WhatsApp y muestra el QR en tienda →
-- la dueña lo abre en el panel y toca "Pagado y entregado" → complete_order baja el inventario.
--
-- Decisiones (acordadas):
--   · El pedido NO aparta piezas: el inventario solo baja al cobrar (complete_order).
--   · Se guarda el precio del momento del pedido (lo que la clienta vio).
--   · Vence a los 7 días (se calcula al leer; no hace falta un proceso programado).
--   · Solo nombre opcional; el teléfono llega por WhatsApp. Máximo 10 piezas por pedido.
--   · Listo para un bot: código con formato fijo y fecha de cada cambio de estado.

begin;

-- ---------------------------------------------------------------- tablas
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^BS-[A-Z0-9]{4,6}$'),
  customer_name text check (customer_name is null or length(customer_name) between 1 and 60),
  status        text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  total         numeric(10, 2) not null default 0 check (total >= 0),
  has_unpriced  boolean not null default false,   -- alguna pieza era "Consultar precio"
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '7 days',
  paid_at       timestamptz,
  cancelled_at  timestamptz
);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);

create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  color_id   uuid references public.product_colors (id) on delete set null,
  -- copia de cómo era la pieza al pedirla (sobrevive si luego se edita o se borra)
  ref        text not null,
  name       text not null,
  color_name text,
  image      text,
  price      numeric(10, 2) check (price is null or price >= 0),
  qty        int not null check (qty between 1 and 10),
  position   int not null default 0
);
create index if not exists order_items_order_idx on public.order_items (order_id, position);

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Nadie escribe directo: todo pasa por las funciones. Solo admin lee las tablas.
drop policy if exists "pedidos: admin lee" on public.orders;
create policy "pedidos: admin lee" on public.orders
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "partidas: admin lee" on public.order_items;
create policy "partidas: admin lee" on public.order_items
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------- utilidades
-- Estado visible: un pendiente pasado de su fecha se muestra como vencido
create or replace function public.order_state(o public.orders)
returns text language sql stable set search_path = '' as $$
  select case when o.status = 'pending' and o.expires_at < now() then 'expired' else o.status end;
$$;

create or replace function public.order_json(oid uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'customerName', o.customer_name,
    'status', public.order_state(o), 'total', o.total, 'hasUnpriced', o.has_unpriced,
    'createdAt', o.created_at, 'expiresAt', o.expires_at, 'paidAt', o.paid_at, 'cancelledAt', o.cancelled_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'productId', i.product_id, 'colorId', i.color_id, 'ref', i.ref, 'name', i.name,
        'colorName', i.color_name, 'image', i.image, 'price', i.price, 'qty', i.qty,
        -- disponibilidad actual (para que la dueña vea si aún hay)
        'stockNow', (select c.stock from public.product_colors c where c.id = i.color_id),
        'colorExists', exists (select 1 from public.product_colors c where c.id = i.color_id)
      ) order by i.position)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o where o.id = oid;
$$;
revoke execute on function public.order_json(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- crear (pública)
-- items = [{ color: uuid, qty: int }]. Valida contra la base: pieza visible, color existente,
-- cantidad disponible y precio actual. Nunca confía en precios o nombres que mande el navegador.
create or replace function public.create_order(items jsonb, customer_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  oid      uuid := gen_random_uuid();
  ocode    text;
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- sin 0/O ni 1/I/L
  pieces   int := 0;
  line     record;
  pos      int := 0;
  tot      numeric(10, 2) := 0;
  unpriced boolean := false;
  cname    text := nullif(btrim(regexp_replace(coalesce(customer_name, ''), '\s+', ' ', 'g')), '');
begin
  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) = 0 then
    raise exception 'El carrito está vacío.' using errcode = '22023';
  end if;
  if jsonb_array_length(items) > 10 then
    raise exception 'Máximo 10 piezas por pedido.' using errcode = '22023';
  end if;
  if cname is not null and length(cname) > 60 then cname := left(cname, 60); end if;
  -- Freno contra pedidos masivos (bots): más de 30 pedidos en un minuto en toda la tienda
  if (select count(*) from public.orders where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Hay muchos pedidos en este momento. Intenta en un minuto.' using errcode = '54000';
  end if;

  -- Código corto y legible: BS-XXXX (reintenta si ya existe)
  loop
    ocode := 'BS-' || (select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
                       from generate_series(1, 4));
    exit when not exists (select 1 from public.orders where code = ocode);
  end loop;

  insert into public.orders (id, code, customer_name) values (oid, ocode, cname);

  for line in
    -- el mismo color dos veces cuenta como una sola partida
    select (x.it ->> 'color')::uuid as color_id,
           least(10, sum(greatest(1, coalesce((x.it ->> 'qty')::int, 1))))::int as qty
    from jsonb_array_elements(items) with ordinality as x(it, ord)
    group by 1
    order by min(x.ord)
  loop
    declare
      c public.product_colors;
      p public.products;
      img text;
    begin
      select * into c from public.product_colors where id = line.color_id;
      if not found then raise exception 'Una pieza del carrito ya no existe.' using errcode = 'P0002'; end if;
      select * into p from public.products where id = c.product_id;
      if p.status <> 'active' then
        raise exception 'La pieza #% ya no está en el catálogo.', p.ref using errcode = 'P0002';
      end if;
      if c.stock is not null and c.stock < line.qty then
        raise exception 'La pieza #% %ya no tiene esa cantidad disponible (quedan %).',
          p.ref, coalesce(c.name || ' ', ''), c.stock using errcode = 'P0001';
      end if;
      pieces := pieces + line.qty;
      if pieces > 10 then raise exception 'Máximo 10 piezas por pedido.' using errcode = '22023'; end if;

      select coalesce(nullif(i.sm, ''), i.src) into img
      from public.product_images i
      where i.product_id = p.id
      order by (i.color_id = c.id) desc nulls last, i.position
      limit 1;

      insert into public.order_items (order_id, product_id, color_id, ref, name, color_name, image, price, qty, position)
      values (oid, p.id, c.id, p.ref, p.name, c.name, img, nullif(p.price, 0), line.qty, pos);
      pos := pos + 1;
      if coalesce(p.price, 0) > 0 then tot := tot + p.price * line.qty; else unpriced := true; end if;
    end;
  end loop;

  update public.orders set total = tot, has_unpriced = unpriced where id = oid;
  return public.order_json(oid);
end $$;

-- Consulta pública de un pedido por su id (uuid imposible de adivinar). Para la pantalla de la clienta.
create or replace function public.get_order(oid uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.order_json(oid);
$$;

-- ---------------------------------------------------------------- cobrar y cancelar (solo admin)
-- final = [{ id: <partida>, qty: n }] cantidades finales (0 quita la partida). null = cobrar tal cual.
create or replace function public.complete_order(oid uuid, final jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o    public.orders;
  it   record;
  c    public.product_colors;
  tot  numeric(10, 2) := 0;
  unpriced boolean := false;
begin
  if not public.is_admin() then
    raise exception 'No tienes permiso para cobrar pedidos.' using errcode = '42501';
  end if;
  select * into o from public.orders where id = oid for update;
  if not found then raise exception 'Ese pedido no existe.' using errcode = 'P0002'; end if;
  if o.status <> 'pending' then
    raise exception 'El pedido % ya está %.', o.code,
      case o.status when 'paid' then 'cobrado' else 'cancelado' end using errcode = 'P0001';
  end if;

  -- Ajustes de última hora (la clienta se lleva menos piezas)
  if final is not null then
    update public.order_items i
    set qty = greatest(0, least(10, (f.x ->> 'qty')::int))
    from jsonb_array_elements(final) as f(x)
    where i.order_id = oid and i.id = (f.x ->> 'id')::uuid and (f.x ->> 'qty')::int between 1 and 10;
    delete from public.order_items i
    using jsonb_array_elements(final) as f(x)
    where i.order_id = oid and i.id = (f.x ->> 'id')::uuid and coalesce((f.x ->> 'qty')::int, 0) <= 0;
  end if;
  if not exists (select 1 from public.order_items where order_id = oid) then
    raise exception 'El pedido quedó sin piezas. Mejor cancélalo.' using errcode = '22023';
  end if;

  -- Baja el inventario de cada color, bloqueando la fila para que dos cobros no choquen
  for it in select * from public.order_items where order_id = oid order by position loop
    if it.color_id is not null then
      select * into c from public.product_colors where id = it.color_id for update;
      if c.stock is not null then
        if c.stock < it.qty then
          raise exception 'No alcanza: #% %(pedido %, quedan %). Ajusta la cantidad.',
            it.ref, coalesce(it.color_name || ' ', ''), it.qty, c.stock using errcode = 'P0001';
        end if;
        update public.product_colors set stock = stock - it.qty where id = c.id;
      end if;
    end if;
    if coalesce(it.price, 0) > 0 then tot := tot + it.price * it.qty; else unpriced := true; end if;
  end loop;

  update public.orders
  set status = 'paid', paid_at = now(), total = tot, has_unpriced = unpriced
  where id = oid;
  return public.order_json(oid);
end $$;

create or replace function public.cancel_order(oid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare o public.orders;
begin
  if not public.is_admin() then
    raise exception 'No tienes permiso para cancelar pedidos.' using errcode = '42501';
  end if;
  select * into o from public.orders where id = oid for update;
  if not found then raise exception 'Ese pedido no existe.' using errcode = 'P0002'; end if;
  if o.status = 'paid' then raise exception 'El pedido % ya se cobró.', o.code using errcode = 'P0001'; end if;
  update public.orders set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()) where id = oid;
  return public.order_json(oid);
end $$;

-- Lista para el panel (más recientes primero)
create or replace function public.list_orders(lim int default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No tienes permiso para ver pedidos.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(public.order_json(o.id) order by o.created_at desc)
    from (select id, created_at from public.orders order by created_at desc limit greatest(1, least(lim, 500))) o
  ), '[]'::jsonb);
end $$;

revoke execute on function public.create_order(jsonb, text) from public;
revoke execute on function public.get_order(uuid) from public;
revoke execute on function public.complete_order(uuid, jsonb) from public, anon;
revoke execute on function public.cancel_order(uuid) from public, anon;
revoke execute on function public.list_orders(int) from public, anon;
grant execute on function public.create_order(jsonb, text) to anon, authenticated;
grant execute on function public.get_order(uuid) to anon, authenticated;
grant execute on function public.complete_order(uuid, jsonb) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.list_orders(int) to authenticated;

-- ---------------------------------------------------------------- catálogo: todos los colores
-- El carrito necesita el id de cada color, también el del color "sin nombre" de las piezas de un solo color.
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
            from public.product_colors c where c.product_id = p.id
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

commit;
