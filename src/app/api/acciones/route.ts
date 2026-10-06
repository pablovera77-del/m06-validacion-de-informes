import { z } from "zod";
import { datasetDemo } from "@/lib/data/demo";
import { casoPorInforme } from "@/lib/data/bandeja";
import { hayBaseDeDatos } from "@/lib/db/cliente";
import { registrarDecisiones } from "@/lib/db/repositorio";

const accionSchema = z.object({
  informeId: z.string().min(1),
  acciones: z.array(
    z.object({
      alertaId: z.string(),
      validacion: z.string(),
      nivel: z.enum(["azul", "amarilla", "naranja", "roja"]),
      revisada: z.boolean().optional(),
      justificacion: z.string().max(1000).optional(),
      incorrecta: z.string().max(500).optional(),
    }),
  ),
});

/** Registra en el log las decisiones del médico al firmar (demo: el log vive en memoria del servidor). */
export async function POST(req: Request) {
  const parsed = accionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Solicitud inválida", detalle: parsed.error.issues }, { status: 400 });
  const { informeId, acciones } = parsed.data;
  if (!casoPorInforme(informeId) && hayBaseDeDatos()) {
    // Informe real: se persiste la decisión sobre cada alerta y la firma (HU2, HU9, HU16).
    const actor = "medico-demo"; // se reemplaza por el usuario autenticado (HU26)
    type Decision = { alertaId: string; estado: "marcada_incorrecta" | "override" | "revisada"; motivo?: string; justificacion?: string };
    const decisiones = acciones.flatMap((a): Decision[] =>
      a.incorrecta?.trim()
        ? [{ alertaId: a.alertaId, estado: "marcada_incorrecta", motivo: a.incorrecta }]
        : a.justificacion?.trim()
          ? [{ alertaId: a.alertaId, estado: "override", justificacion: a.justificacion }]
          : a.revisada || a.nivel === "azul"
            ? [{ alertaId: a.alertaId, estado: "revisada" }]
            : [],
    );
    try {
      const e = await registrarDecisiones(informeId, actor, decisiones);
      return Response.json({ ok: true, secuencia: e.secuencia, hash: e.hash });
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : "Error al registrar" }, { status: 500 });
    }
  }
  const { log } = await datasetDemo();
  const fecha = new Date().toISOString();
  const actor = "medico-demo";
  for (const a of acciones) {
    if (a.incorrecta?.trim()) log.registrar({ fecha, tipo: "alerta_marcada_incorrecta", actor, informeId, datos: { alertaId: a.alertaId, motivo: a.incorrecta } });
    else if (a.justificacion?.trim()) log.registrar({ fecha, tipo: "alerta_override", actor, informeId, datos: { alertaId: a.alertaId, nivel: a.nivel, justificacion: a.justificacion } });
    else if (a.revisada) log.registrar({ fecha, tipo: "alerta_revisada", actor, informeId, datos: { alertaId: a.alertaId } });
  }
  const e = log.registrar({ fecha, tipo: "informe_firmado", actor, informeId, datos: { alertas: acciones.length } });
  return Response.json({ ok: true, secuencia: e.secuencia, hash: e.hash });
}
