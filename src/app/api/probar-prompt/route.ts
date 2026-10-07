import { z } from "zod";
import { ACCESO, usuarioApi } from "@/lib/auth/sesion";
import { armarEntrada, promptDesdeFila, salidaV3ASchema, salidaV5Schema, type ConfigPrompt } from "@/lib/config/prompts";
import { reglasVigentes } from "@/lib/config/reglas";
import type { Informe } from "@/lib/domain/types";
import { NOMBRE_ESTUDIO } from "@/lib/domain/types";
import { validarBirads, validarOrganos } from "@/lib/engine/ia";
import { proveedorConfigurado } from "@/lib/engine/llm";
import { ProveedorSimulado } from "@/lib/engine/simulador";
import { marcarProbado, obtenerVersion, promptsVigentes } from "@/lib/db/prompts";

const schema = z.object({
  validacion: z.enum(["V3A", "V5"]),
  hallazgos: z.string().max(5000),
  conclusion: z.string().max(2000),
  /** Versión a probar (por ejemplo un borrador). Sin esto se prueba la vigente. */
  promptId: z.string().uuid().optional(),
});

/**
 * Prueba un prompt sobre un texto libre (HU28). No usa datos de pacientes ni guarda informes.
 * Si se prueba un borrador con el modelo real y responde bien, queda registrado como «probado» (habilita su aprobación).
 */
export async function POST(req: Request) {
  const u = await usuarioApi(ACCESO.configuracion);
  if (u instanceof Response) return u;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  const { validacion, hallazgos, conclusion, promptId } = p.data;

  let prompt: ConfigPrompt;
  let esBorrador = false;
  if (promptId) {
    const fila = await obtenerVersion(promptId);
    if (!fila || fila.validacion !== validacion) return Response.json({ error: "Versión inexistente" }, { status: 404 });
    prompt = promptDesdeFila(fila);
    esBorrador = fila.estado === "borrador";
  } else {
    prompt = (await promptsVigentes())[validacion];
  }

  const reglas = reglasVigentes();
  const tipo = validacion === "V3A" ? "mamografia" : "ecografia_abdominal";
  const secciones = { tecnica: "", hallazgos, conclusion };
  const organos = validacion === "V5" ? reglas.v5.organos[tipo] : undefined;
  const entrada = armarEntrada(prompt, { tipoEstudio: NOMBRE_ESTUDIO[tipo], secciones, organos: organos?.map((o) => `${o.id} (${o.nombre})`).join(", ") });
  const real = proveedorConfigurado();
  const proveedor = real ?? new ProveedorSimulado().preparar(secciones, organos);

  try {
    const salida = await proveedor.generar({ prompt, entrada, schema: (validacion === "V3A" ? salidaV3ASchema : salidaV5Schema) as z.ZodType<unknown> });
    const informe: Informe = {
      id: "PRUEBA", turnoId: "PRUEBA", version: 1, tipoEstudio: tipo, medicoId: "PRUEBA", fecha: new Date().toISOString(),
      encabezado: {}, secciones, origen: "sintetico",
    };
    const r = validacion === "V3A" ? await validarBirads(informe, reglas, proveedor, prompt) : await validarOrganos(informe, reglas, proveedor, prompt);
    let probado = false;
    if (esBorrador && real && promptId) {
      await marcarProbado(promptId, u.email);
      probado = true;
    }
    return Response.json({ entrada, salida, proveedor: proveedor.nombre, version: prompt.version, probado, alertas: r.alertas.map((a) => ({ nivel: a.nivel, titulo: a.titulo })) });
  } catch (e) {
    return Response.json({ entrada, salida: { error: e instanceof Error ? e.message : String(e) }, proveedor: proveedor.nombre, version: prompt.version, probado: false, alertas: [] });
  }
}
