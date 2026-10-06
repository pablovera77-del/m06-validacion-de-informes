import "server-only";
import type { Rol } from "../auth/sesion";
import { exigirDb } from "./cliente";
import { registrarEvento } from "./repositorio";

export interface FilaUsuario { email: string; nombre: string; rol: Rol; medico_id: string | null; activo: boolean; creado_por: string; creado_en: string }

export async function listarUsuarios(): Promise<FilaUsuario[]> {
  const { data, error } = await exigirDb().from("m06_usuarios").select("*").order("rol").order("nombre");
  if (error) throw error;
  return data as FilaUsuario[];
}

/**
 * Crea el usuario en Supabase Auth (email confirmado, sin envío de correo) y le asigna el rol en m06_usuarios.
 * Si el email ya existe en Auth, solo actualiza el rol: la contraseña no se toca.
 * La contraseña nunca se guarda en tablas de la app ni en el log.
 */
export async function crearUsuario(u: { email: string; nombre: string; rol: Rol; medicoId?: string; clave?: string }, actor: string) {
  const sb = exigirDb();
  const email = u.email.trim().toLowerCase();
  let creadoEnAuth = false;
  if (u.clave) {
    const { error } = await sb.auth.admin.createUser({ email, password: u.clave, email_confirm: true });
    if (error && !/already|registered|exists/i.test(error.message)) throw new Error(`Supabase Auth: ${error.message}`);
    creadoEnAuth = !error;
  }
  const { error } = await sb.from("m06_usuarios").upsert({
    email, nombre: u.nombre.trim(), rol: u.rol, medico_id: u.rol === "medico" ? u.medicoId?.trim().toUpperCase() : null, activo: true, creado_por: actor,
  });
  if (error) throw error;
  await registrarEvento({ tipo: "usuario_creado", actor, datos: { usuario: email, rol: u.rol, medicoId: u.medicoId ?? null, cuentaNueva: creadoEnAuth } });
  return { creadoEnAuth };
}

export async function cambiarEstadoUsuario(email: string, activo: boolean, actor: string) {
  const { error } = await exigirDb().from("m06_usuarios").update({ activo }).eq("email", email);
  if (error) throw error;
  await registrarEvento({ tipo: "usuario_modificado", actor, datos: { usuario: email, activo } });
}

/** Busca el usuario en Supabase Auth por email (volumen chico: pocas decenas de usuarios). */
async function idEnAuth(email: string): Promise<string | undefined> {
  const sb = exigirDb();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Supabase Auth: ${error.message}`);
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u.id;
    if (data.users.length < 200) return undefined;
  }
}

/** Emails que ya tienen cuenta en Supabase Auth (para mostrar quién puede ingresar). */
export async function emailsConCuenta(): Promise<Set<string>> {
  const { data, error } = await exigirDb().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`Supabase Auth: ${error.message}`);
  return new Set(data.users.map((u) => u.email?.toLowerCase() ?? ""));
}

/**
 * Establece la contraseña de un usuario habilitado: crea la cuenta en Supabase Auth si no existe
 * (confirmada, sin envío de correo) o reemplaza la contraseña si ya existe. No se registra la contraseña en ningún lado.
 */
export async function establecerClave(email: string, clave: string, actor: string) {
  const sb = exigirDb();
  const id = await idEnAuth(email);
  const { error } = id
    ? await sb.auth.admin.updateUserById(id, { password: clave })
    : await sb.auth.admin.createUser({ email, password: clave, email_confirm: true });
  if (error) throw new Error(`Supabase Auth: ${error.message}`);
  await registrarEvento({ tipo: "usuario_modificado", actor, datos: { usuario: email, accion: id ? "contraseña_cambiada" : "cuenta_creada" } });
}
