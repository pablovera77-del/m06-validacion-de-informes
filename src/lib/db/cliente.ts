import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase SOLO para el servidor, con la clave secreta.
 * Las tablas m06_ tienen RLS activado y sin políticas: no hay acceso posible desde el navegador.
 * Si las variables no están configuradas, la app funciona en modo demo con datos sintéticos en memoria.
 */
let cliente: SupabaseClient | null | undefined;

export function db(): SupabaseClient | null {
  if (cliente !== undefined) return cliente;
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SECRET_KEY;
  cliente = url && clave ? createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return cliente;
}

export function hayBaseDeDatos(): boolean {
  return db() !== null;
}

export function exigirDb(): SupabaseClient {
  const c = db();
  if (!c) throw new Error("Base de datos no configurada: faltan SUPABASE_URL y SUPABASE_SECRET_KEY");
  return c;
}
