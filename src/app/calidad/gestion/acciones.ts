"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardarAccionCorrectiva, guardarDebito, guardarMuestraAuditoria } from "@/lib/db/repositorio";

const ACTOR = "calidad-demo"; // se reemplaza por el usuario autenticado (HU26)

export interface Estado { ok?: string; error?: string }

const debitoSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  causa: z.enum(["informe", "otra"]),
  cantidad: z.coerce.number().int().min(0),
  monto: z.coerce.number().min(0),
  financiador: z.string().max(120).optional(),
  nota: z.string().max(500).optional(),
});

export async function cargarDebito(_: Estado, form: FormData): Promise<Estado> {
  const p = debitoSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Revisá los datos del débito." };
  try {
    await guardarDebito(p.data, ACTOR);
    revalidatePath("/calidad");
    return { ok: "Débito registrado" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

const accionSchema = z.object({
  id: z.string().min(3).max(20),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  patron: z.string().min(5).max(300),
  accion: z.string().min(5).max(500),
  responsable: z.string().min(2).max(120),
  estado: z.enum(["abierta", "en_curso", "cerrada"]),
  cierre: z.string().max(500).optional(),
});

export async function cargarAccion(_: Estado, form: FormData): Promise<Estado> {
  const p = accionSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Revisá los datos de la acción correctiva." };
  try {
    await guardarAccionCorrectiva(p.data, ACTOR);
    revalidatePath("/calidad");
    revalidatePath("/calidad/gestion");
    return { ok: `Acción ${p.data.id} guardada` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function auditarAlerta(form: FormData) {
  const correcta = form.get("correcta") === "si";
  const override = form.get("override");
  await guardarMuestraAuditoria(
    {
      alertaId: String(form.get("alertaId")),
      validacion: String(form.get("validacion")),
      correcta,
      overrideApropiado: override === null || override === "" ? undefined : override === "si",
      comentario: String(form.get("comentario") ?? "") || undefined,
    },
    ACTOR,
  );
  revalidatePath("/calidad/gestion");
}
