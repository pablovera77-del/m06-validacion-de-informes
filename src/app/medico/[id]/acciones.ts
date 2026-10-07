"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACCESO, exigirUsuario } from "@/lib/auth/sesion";
import { asignarMedico } from "@/lib/db/repositorio";

const schema = z.object({ informeId: z.string().min(1), medicoId: z.string().regex(/^[A-Za-z0-9_-]{2,20}$/) });

export async function asignar(form: FormData) {
  const u = await exigirUsuario(ACCESO.asignarMedico);
  const p = schema.safeParse(Object.fromEntries(form));
  if (!p.success) return;
  await asignarMedico(p.data.informeId, p.data.medicoId.toUpperCase(), u.email);
  revalidatePath(`/medico/${p.data.informeId}`);
  revalidatePath("/medico");
}
