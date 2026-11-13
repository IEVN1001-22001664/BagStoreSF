-- BAG STORE SF · Guardar y eliminar piezas desde el panel (fase 4)
-- Ejecutar después de 001 y 002 en Supabase → SQL Editor.
--
-- save_product(p jsonb): crea o actualiza una pieza con sus colores y fotos en una sola transacción.
--   p = { id, name, brand, category, price, description, status,
--         colors: [{ id, name, hex, stock }],            -- en orden; al menos uno
--         images: [{ id, src, sm, w, h, color }] }       -- en orden; color = id de un color o null
--   Los ids los genera el panel (crypto.randomUUID) para poder subir las fotos antes de guardar.
--   Devuelve { id, ref, removed: [rutas de fotos que ya no se usan] } para limpiar Storage.
--
-- delete_product(pid uuid): borra la pieza (colores y fotos en cascada) y devuelve las rutas de sus fotos.
--
-- Ambas son security invoker: además de revisar is_admin(), el RLS de cada tabla sigue aplicando.

begin;

create or replace function public.save_product(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pid     uuid := (p ->> 'id')::uuid;
  pref    text;
  removed jsonb := '[]'::jsonb;
  gone    jsonb;
begin
  if not public.is_admin() then
    raise exception 'No tienes permiso para editar el catálogo.' using errcode = '42501';
  end if;
  if pid is null then
    raise exception 'Falta el id de la pieza.' using errcode = '22023';
  end if;
  if jsonb_typeof(p -> 'colors') is distinct from 'array' or jsonb_array_length(p -> 'colors') = 0 then
    raise exception 'La pieza necesita al menos un color o una disponibilidad.' using errcode = '22023';
  end if;

  -- Pieza: las nuevas entran al principio de "Destacados"
  insert into public.products as t (id, name, brand, category_id, price, description, status, position)
  values (
    pid,
    btrim(p ->> 'name'),
    nullif(btrim(coalesce(p ->> 'brand', '')), ''),
    p ->> 'category',
    nullif(p ->> 'price', '')::numeric,
    nullif(btrim(coalesce(p ->> 'description', '')), ''),
    coalesce(p ->> 'status', 'active'),
    coalesce((select min(position) from public.products), 0) - 1
  )
  on conflict (id) do update set
    name        = excluded.name,
    brand       = excluded.brand,
    category_id = excluded.category_id,
    price       = excluded.price,
    description = excluded.description,
    status      = excluded.status
  returning t.ref into pref;

  -- Fotos que ya no están: se borran y se reportan para limpiar Storage
  with d as (
    delete from public.product_images
    where product_id = pid
      and id not in (select (i ->> 'id')::uuid from jsonb_array_elements(coalesce(p -> 'images', '[]'::jsonb)) i)
    returning src, sm
  )
  select coalesce(jsonb_agg(x), '[]'::jsonb) into gone
  from d, lateral (values (d.src), (d.sm)) v(x);
  removed := removed || gone;

  -- Colores: borra los quitados; limpia nombres antes de reescribirlos (permite intercambiar nombres)
  delete from public.product_colors
  where product_id = pid
    and id not in (select (c ->> 'id')::uuid from jsonb_array_elements(p -> 'colors') c);
  update public.product_colors set name = null where product_id = pid and name is not null;

  insert into public.product_colors as t (id, product_id, name, hex, stock, position)
  select (c ->> 'id')::uuid, pid,
         nullif(btrim(coalesce(c ->> 'name', '')), ''),
         nullif(c ->> 'hex', ''),
         nullif(c ->> 'stock', '')::int,
         (ord - 1)::int
  from jsonb_array_elements(p -> 'colors') with ordinality as x(c, ord)
  on conflict (id) do update set
    name = excluded.name, hex = excluded.hex, stock = excluded.stock, position = excluded.position
  where t.product_id = pid;  -- nunca toca colores de otra pieza

  insert into public.product_images as t (id, product_id, color_id, src, sm, width, height, position)
  select (i ->> 'id')::uuid, pid,
         nullif(i ->> 'color', '')::uuid,
         i ->> 'src', coalesce(nullif(i ->> 'sm', ''), i ->> 'src'),
         (i ->> 'w')::int, (i ->> 'h')::int,
         (ord - 1)::int
  from jsonb_array_elements(coalesce(p -> 'images', '[]'::jsonb)) with ordinality as x(i, ord)
  on conflict (id) do update set
    color_id = excluded.color_id, src = excluded.src, sm = excluded.sm,
    width = excluded.width, height = excluded.height, position = excluded.position
  where t.product_id = pid;

  return jsonb_build_object('id', pid, 'ref', pref, 'removed', removed);
end $$;

create or replace function public.delete_product(pid uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  removed jsonb;
begin
  if not public.is_admin() then
    raise exception 'No tienes permiso para editar el catálogo.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into removed
  from public.product_images i, lateral (values (i.src), (i.sm)) v(x)
  where i.product_id = pid;
  delete from public.products where id = pid;
  if not found then
    raise exception 'Esa pieza ya no existe.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('removed', removed);
end $$;

-- Storage: reemplazar (upsert) y borrar fotos también exige permiso de lectura sobre storage.objects.
-- (Las fotos se ven por su URL pública sin esto; la regla solo deja a admin listarlas y manipularlas.)
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage')
     and not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'fotos: admin lee') then
    create policy "fotos: admin lee" on storage.objects
      for select to authenticated
      using (bucket_id = 'products' and (select public.is_admin()));
  end if;
end $$;

revoke execute on function public.save_product(jsonb) from public, anon;
revoke execute on function public.delete_product(uuid) from public, anon;
grant execute on function public.save_product(jsonb) to authenticated;
grant execute on function public.delete_product(uuid) to authenticated;

commit;
