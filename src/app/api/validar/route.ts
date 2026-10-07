import { z } from "zod";
import { TIPOS_ESTUDIO, type Informe } from "@/lib/domain/types";
import { validarInforme } from "@/lib/engine/motor";

/**
 * Contrato de la etapa 2: el sistema de gestión de imágenes envía el informe ya extraído
 * (o el PDF, cuando se implemente la extracción) y recibe las alertas.
 * Este endpoint solo lee: no guarda el informe ni modifica nada en el sistema de origen.
 */

const informeSchema = z.object({
  id: z.string(),
  turnoId: z.string(),
  version: z.number().int().default(1),
  tipoEstudio: z.enum(TIPOS_ESTUDIO),
  medicoId: z.string(),
  medicoFirmante: z.string().optional(),
  fecha: z.string(),
  encabezado: z.object({
    apellidoNombre: z.string().optional(),
    dni: z.string().optional(),
    fechaNacimiento: z.string().optional(),
    tipoEstudio: z.string().optional(),
  }),
  secciones: z.object({ tecnica: z.string().optional(), hallazgos: z.string().optional(), conclusion: z.string().optional() }),
});

const solicitudSchema = z.object({
  informe: informeSchema,
  turno: z
    .object({ id: z.string(), apellidoNombre: z.string(), dni: z.string(), fechaNacimiento: z.string(), tipoEstudio: z.enum(TIPOS_ESTUDIO), medicoId: z.string() })
    .optional(),
  historial: z.array(informeSchema).max(10).default([]),
});

export async function POST(req: Request) {
  const token = process.env.M06_API_TOKEN;
  if (token && req.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const parsed = solicitudSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Solicitud inválida", detalle: parsed.error.issues }, { status: 400 });
  const { informe, turno, historial } = parsed.data;
  const conOrigen = (i: typeof informe): Informe => ({ ...i, origen: "api" });
  const resultado = await validarInforme(conOrigen(informe), { turno, historial: historial.map(conOrigen) }, { usarIa: true });
  return Response.json(resultado);
}
