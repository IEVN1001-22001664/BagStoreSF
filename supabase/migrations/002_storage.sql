-- BAG STORE SF · Bucket de fotos en Supabase Storage
-- Ejecutar después de 001_catalogo.sql. Solo funciona en Supabase (usa el esquema storage).
--
-- Bucket público "products": cualquiera puede ver las fotos por URL; solo admin sube, cambia o borra.
-- El panel subirá dos archivos por foto: <producto>/<uuid>.webp (≤1000px) y <producto>/<uuid>-sm.webp (460px).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 2 * 1024 * 1024, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "fotos: admin sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'products' and (select public.is_admin()));

create policy "fotos: admin reemplaza" on storage.objects
  for update to authenticated
  using (bucket_id = 'products' and (select public.is_admin()))
  with check (bucket_id = 'products' and (select public.is_admin()));

create policy "fotos: admin borra" on storage.objects
  for delete to authenticated
  using (bucket_id = 'products' and (select public.is_admin()));
