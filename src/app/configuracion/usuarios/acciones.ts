"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACCESO, exigirUsuario } from "@/lib/auth/sesion";
import { cambiarEstadoUsuario, crearUsuario, establecerClave } from "@/lib/db/usuarios";

export interface EstadoUsuario { ok?: string; error?: string }

const schema = z
  .object({
    email: z.string().email(),
    nombre: z.string().min(2).max(120),
    rol: z.enum(["medico", "calidad", "admin"]),
    medicoId: z.string().max(20).optional(),
    clave: z.string().max(72).optional(),
  })
  .refine((d) => d.rol !== "medico" || !!d.medicoId?.trim(), { message: "El rol médico necesita el código de médico (ej. M04)." })
  .refine((d) => !d.clave || d.clave.length >= 10, { message: "La contraseña inicial debe tener al menos 10 caracteres." });

export async function guardarUsuario(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  const admin = await exigirUsuario(ACCESO.usuarios);
  const p = schema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => v !== "")));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Revisá los datos." };
  try {
    const r = await crearUsuario(p.data, admin.email);
    revalidatePath("/configuracion/usuarios");
    return { ok: r.creadoEnAuth ? `Usuario ${p.data.email} creado.` : `Rol de ${p.data.email} actualizado (la cuenta ya existía o no se indicó contraseña).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al guardar" };
  }
}

export async function alternarUsuario(form: FormData) {
  const admin = await exigirUsuario(ACCESO.usuarios);
  const email = String(form.get("email"));
  if (email === admin.email) return; // un administrador no se desactiva a sí mismo
  await cambiarEstadoUsuario(email, form.get("activo") === "true", admin.email);
  revalidatePath("/configuracion/usuarios");
}

const claveSchema = z.object({ email: z.string().email(), clave: z.string().min(10, "Mínimo 10 caracteres.").max(72) });

export async function cambiarClave(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  const admin = await exigirUsuario(ACCESO.usuarios);
  const p = claveSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Revisá los datos." };
  try {
    await establecerClave(p.data.email.toLowerCase(), p.data.clave, admin.email);
    revalidatePath("/configuracion/usuarios");
    return { ok: "Contraseña establecida." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}
