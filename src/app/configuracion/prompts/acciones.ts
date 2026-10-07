"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACCESO, exigirUsuario } from "@/lib/auth/sesion";
import { activarBorrador, descartarBorrador, guardarBorrador } from "@/lib/db/prompts";
import { hayBaseDeDatos } from "@/lib/db/cliente";

export interface EstadoPrompt { ok?: string; error?: string }

const borradorSchema = z.object({
  validacion: z.enum(["V3A", "V5"]),
  sistema: z.string().trim().min(50, "Las instrucciones son demasiado cortas.").max(12000, "Las instrucciones superan 12.000 caracteres."),
  motivo: z.string().trim().min(5, "Contá brevemente por qué cambia el prompt.").max(500),
});

export async function guardar(_: EstadoPrompt, form: FormData): Promise<EstadoPrompt> {
  const u = await exigirUsuario(ACCESO.configuracion);
  if (!hayBaseDeDatos()) return { error: "La base de datos no está configurada." };
  const p = borradorSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Revisá los datos." };
  try {
    const f = await guardarBorrador(p.data, u.email);
    revalidatePath("/configuracion/prompts");
    return { ok: `Borrador ${f.version} guardado. Probalo antes de aprobarlo.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al guardar" };
  }
}

export async function aprobar(_: EstadoPrompt, form: FormData): Promise<EstadoPrompt> {
  const u = await exigirUsuario(ACCESO.configuracion);
  if (form.get("confirmo") !== "si") return { error: "Confirmá que revisaste los cambios y el resultado de la prueba." };
  try {
    await activarBorrador(String(form.get("id")), u.email);
    revalidatePath("/configuracion/prompts");
    return { ok: "Versión aprobada: desde ahora se usa en todos los informes nuevos." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al aprobar" };
  }
}

export async function descartar(form: FormData) {
  const u = await exigirUsuario(ACCESO.configuracion);
  await descartarBorrador(String(form.get("id")), u.email);
  revalidatePath("/configuracion/prompts");
}
