import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Datos públicos de Supabase Auth. La clave publicable no da acceso a las tablas m06_ (RLS sin políticas + revoke). */
export function configAuth(): { url: string; clave: string } | null {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_PUBLISHABLE_KEY;
  return url && clave ? { url, clave } : null;
}

/** Cliente de Supabase Auth con la sesión del usuario (cookies). Solo para autenticación, no para datos. */
export async function clienteAuth() {
  const c = configAuth();
  if (!c) throw new Error("Falta configurar SUPABASE_PUBLISHABLE_KEY");
  const almacen = await cookies();
  return createServerClient(c.url, c.clave, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy ya renovó la sesión.
        }
      },
    },
  });
}
