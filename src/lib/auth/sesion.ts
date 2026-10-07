import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db, hayBaseDeDatos } from "../db/cliente";
import { clienteAuth, configAuth } from "./supabase";

export type Rol = "medico" | "calidad" | "admin";

export interface Usuario {
  email: string;
  nombre: string;
  rol: Rol;
  /** Para rol médico: código del médico en los informes (M01…M21 en datos sintéticos). */
  medicoId: string | null;
  /** Modo demo: sin base de datos, sin login, solo datos sintéticos. */
  demo: boolean;
}

export const NOMBRE_ROL: Record<Rol, string> = { medico: "Médico informante", calidad: "Calidad", admin: "Administrador" };

/** Qué roles acceden a cada sección (HU26). El control real se hace en cada página, acción y API. */
export const ACCESO = {
  ingesta: ["calidad", "admin"],
  subirInformes: ["medico", "calidad", "admin"],
  asignarMedico: ["calidad", "admin"],
  medico: ["medico", "calidad", "admin"],
  firmar: ["medico", "admin"],
  calidad: ["calidad", "admin"],
  configuracion: ["calidad", "admin"],
  usuarios: ["admin"],
} as const satisfies Record<string, readonly Rol[]>;

const USUARIO_DEMO: Usuario = { email: "demo", nombre: "Modo demostración", rol: "admin", medicoId: null, demo: true };

/** Sin base de datos la app es una demo abierta con datos sintéticos. Con base de datos, el login es obligatorio. */
export function modoDemo(): boolean {
  return !hayBaseDeDatos();
}

/** Usuario de la solicitud actual, o null si no inició sesión o no está autorizado en m06_usuarios. */
export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  await connection(); // depende de la sesión: nunca se prerenderiza
  if (modoDemo()) return USUARIO_DEMO;
  if (!configAuth()) return null;
  const sb = await clienteAuth();
  const { data } = await sb.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email) return null;
  const { data: fila } = await db()!.from("m06_usuarios").select("email, nombre, rol, medico_id, activo").eq("email", email).maybeSingle();
  if (!fila || !fila.activo) return null;
  return { email: fila.email, nombre: fila.nombre, rol: fila.rol as Rol, medicoId: fila.medico_id, demo: false };
});

/** Para páginas y acciones: exige sesión y, si se indica, uno de los roles. */
export async function exigirUsuario(roles?: readonly Rol[]): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect("/login");
  if (roles && !roles.includes(u.rol)) redirect("/sin-acceso");
  return u;
}

/** Para rutas de API: devuelve el usuario o una respuesta 401/403. */
export async function usuarioApi(roles?: readonly Rol[]): Promise<Usuario | Response> {
  const u = await usuarioActual();
  if (!u) return Response.json({ error: "Sesión requerida" }, { status: 401 });
  if (roles && !roles.includes(u.rol)) return Response.json({ error: "Sin permiso para esta acción" }, { status: 403 });
  return u;
}

/** Un médico solo ve y firma sus propios informes; Calidad y Administración ven todos. */
export function puedeVerInforme(u: Usuario, medicoIdInforme: string): boolean {
  return u.rol !== "medico" || u.medicoId === medicoIdInforme;
}
