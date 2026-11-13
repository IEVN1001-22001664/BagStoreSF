# Supabase · base de datos del catálogo

Aquí vive el esquema que reemplaza a `assets/data/catalog.js` como fuente de verdad.
El sitio ya lee de Supabase (`assets/js/data.js`); `catalog.js` queda solo como respaldo si Supabase no responde.

> ⚠️ `seed.sql` **borra todos los productos** y los recarga desde `catalog.js`. Solo sirvió para la carga inicial;
> no lo vuelvas a ejecutar o perderás lo que la dueña haya editado.

| Archivo | Qué hace |
| --- | --- |
| `migrations/001_catalogo.sql` | Tablas, reglas de acceso (RLS) y la función pública `catalog()` |
| `migrations/002_storage.sql` | Bucket público `products` para las fotos; solo admin sube o borra |
| `seed.sql` | Los 40 productos actuales. **Generado**: no lo edites a mano |
| `generate-seed.mjs` | `node supabase/generate-seed.mjs` vuelve a crear `seed.sql` desde `catalog.js` |

## Modelo

- **products**: nombre, marca, categoría, precio (`null` o `0` = "Consultar precio"), descripción,
  `status` (`active` o `archived`; archivar la oculta sin borrarla) y `position` para el orden.
  `ref` se asigna sola: la siguiente pieza nueva será la #41.
- **product_colors**: cada color con su propio `stock`. Al migrar, cada pieza tiene un color sin
  nombre que guarda su stock actual; desde el panel se le pone nombre o se divide en varios colores.
  Stock: `null` = disponible · `0` = agotada · `1` = pieza única · `n` = quedan n.
  El stock de la pieza es la suma de sus colores (o `null` si alguno no tiene cantidad).
- **product_images**: fotos ordenadas; pueden ligarse a un color.
- **store_settings**, **categories**: contacto de la tienda y filtros.
- **admins**: correos que pueden editar. Tener cuenta en Auth no basta: el correo debe estar aquí.

El sitio público hace una sola llamada, `POST /rest/v1/rpc/catalog`, y recibe `{ store, categories, products }`
con la misma forma que `window.BAGSTORE` (más `colors` y `description`).

## Puesta en marcha (una vez)

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito, región `us-east` o la más cercana).
2. En **SQL Editor**, pega y ejecuta, en este orden:
   `migrations/001_catalogo.sql`, `migrations/002_storage.sql` y `seed.sql`.
3. Da de alta a la dueña (y a ti) como admin:
   ```sql
   insert into public.admins (email) values ('correo-de-la-duena@ejemplo.com');
   ```
4. En **Authentication → Sign In / Providers**: deja activo **Email** y desactiva
   "Allow new users to sign up". Así nadie puede crearse una cuenta desde fuera.
5. Crea la cuenta de cada admin en **Authentication → Users → Add user → Create new user**:
   correo, contraseña y la casilla **Auto Confirm User** marcada. Comparte la contraseña en persona;
   el teléfono la guarda en su llavero al primer inicio de sesión.
   El panel entra con correo + contraseña (no con enlace mágico): el correo integrado de Supabase solo
   envía a miembros del equipo del proyecto, y el enlace se abriría fuera de la app instalada.
6. Copia de **Project Settings → API**: la *Project URL* y la clave *anon / publishable*.
   Esa clave es pública por diseño (el RLS protege los datos). **Nunca** uses la `service_role` en el sitio.

## Notas

- Las fotos migradas siguen en `assets/img/products/` (rutas relativas). Las que suba la dueña irán a
  Storage con URL completa; la UI acepta ambas.
- El plan gratuito pausa el proyecto tras 7 días sin actividad. Las visitas al catálogo cuentan como actividad.
- Para cambiar la contraseña de una admin: **Authentication → Users → (la cuenta) → Reset password** o
  bórrala y créala otra vez. Quitarla de `admins` le retira el permiso de inmediato.
