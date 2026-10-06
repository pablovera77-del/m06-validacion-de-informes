import { z } from "zod";
import { armarEntrada, promptVigente, salidaV3ASchema, salidaV5Schema } from "@/lib/config/prompts";
import { reglasVigentes } from "@/lib/config/reglas";
import type { Informe } from "@/lib/domain/types";
import { NOMBRE_ESTUDIO } from "@/lib/domain/types";
import { validarBirads, validarOrganos } from "@/lib/engine/ia";
import { proveedorConfigurado } from "@/lib/engine/llm";
import { ProveedorSimulado } from "@/lib/engine/simulador";

const schema = z.object({
  validacion: z.enum(["V3A", "V5"]),
  hallazgos: z.string().max(5000),
  conclusion: z.string().max(2000),
});

/** Prueba del prompt vigente sobre un texto libre (HU28). No usa datos de pacientes ni escribe en el log. */
export async function POST(req: Request) {
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  const { validacion, hallazgos, conclusion } = p.data;
  const reglas = reglasVigentes();
  const tipo = validacion === "V3A" ? "mamografia" : "ecografia_abdominal";
  const secciones = { tecnica: "", hallazgos, conclusion };
  const prompt = promptVigente(validacion);
  const organos = validacion === "V5" ? reglas.v5.organos[tipo] : undefined;
  const entrada = armarEntrada(prompt, { tipoEstudio: NOMBRE_ESTUDIO[tipo], secciones, organos: organos?.map((o) => `${o.id} (${o.nombre})`).join(", ") });
  const proveedor = proveedorConfigurado() ?? new ProveedorSimulado().preparar(secciones, organos);

  try {
    const salida = await proveedor.generar({ prompt, entrada, schema: (validacion === "V3A" ? salidaV3ASchema : salidaV5Schema) as z.ZodType<unknown> });
    const informe: Informe = {
      id: "PRUEBA", turnoId: "PRUEBA", version: 1, tipoEstudio: tipo, medicoId: "PRUEBA", fecha: new Date().toISOString(),
      encabezado: {}, secciones, origen: "sintetico",
    };
    const r = validacion === "V3A" ? await validarBirads(informe, reglas, proveedor) : await validarOrganos(informe, reglas, proveedor);
    return Response.json({ entrada, salida, proveedor: proveedor.nombre, alertas: r.alertas.map((a) => ({ nivel: a.nivel, titulo: a.titulo })) });
  } catch (e) {
    return Response.json({ entrada, salida: { error: e instanceof Error ? e.message : String(e) }, proveedor: proveedor.nombre, alertas: [] });
  }
}
