import { z } from "zod";
import type { SeccionesClinicas } from "../domain/types";
import type { MetadatosVersion } from "./reglas";
import { descripcionProveedor } from "../engine/llm";

/**
 * Prompts versionados de las validaciones que usan IA (HU28).
 * El texto que se muestra en Configuración > Prompts es exactamente el que recibe el modelo.
 * La transformación de la salida del modelo en un nivel de alerta la hace el código, no el modelo.
 */

export const evidenciaSchema = z.object({
  seccion: z.enum(["tecnica", "hallazgos", "conclusion"]),
  fragmento: z.string().describe("Cita textual del informe, sin modificar"),
});

export const salidaV3ASchema = z.object({
  resultado: z.enum(["consistente", "inconsistente", "indeterminado"]),
  categoriaDetectada: z.enum(["0", "1", "2", "3", "4", "5", "6", "no_consignada"]),
  reglaAplicada: z.enum([
    "BIRADS_0_SIN_ESTUDIO_ADICIONAL",
    "BIRADS_1_CON_HALLAZGOS",
    "BIRADS_2_HALLAZGO_NO_BENIGNO",
    "BIRADS_4_5_HALLAZGOS_NORMALES",
    "NINGUNA",
  ]),
  evidencia: z.array(evidenciaSchema).max(3),
  explicacion: z.string().max(400),
});
export type SalidaV3A = z.infer<typeof salidaV3ASchema>;

export const salidaV5Schema = z.object({
  organos: z.array(
    z.object({
      organoId: z.string(),
      categoria: z.enum(["medido", "ausente_documentado", "no_evaluable_explicado", "faltante_sin_explicacion"]),
      medidaEncontrada: z.string().nullable(),
      evidencia: z.array(evidenciaSchema).max(2),
      explicacion: z.string().max(300),
    }),
  ),
});
export type SalidaV5 = z.infer<typeof salidaV5Schema>;

export interface ConfigPrompt extends MetadatosVersion {
  validacion: "V3A" | "V5";
  modelo: { proveedor: string; nombre: string; temperatura: number };
  sistema: string;
  /** Plantilla con variables {{...}}; solo puede referenciar secciones clínicas. */
  plantillaEntrada: string;
  seccionesEnviadas: (keyof SeccionesClinicas)[];
  camposExcluidos: string[];
  /** Descripción legible del esquema de salida (el esquema real es Zod). */
  esquemaSalidaDescripcion: string[];
  reglasNivel: string[];
}

// Proveedor y modelo efectivos según configuración (API de Anthropic directa, Vercel AI Gateway o simulador).
const proveedorActivo = descripcionProveedor();
const MODELO_POR_DEFECTO = {
  proveedor: proveedorActivo.nombre,
  nombre: proveedorActivo.modelo,
  temperatura: 0,
};

const EXCLUIDOS = [
  "Apellido y nombre",
  "DNI",
  "Fecha de nacimiento",
  "Número de turno",
  "Médico informante y firma",
  "Encabezado completo",
];

export const PROMPT_V3A_1_0: ConfigPrompt = {
  validacion: "V3A",
  version: "v3a-prompt-1.0.0",
  estado: "vigente",
  autor: "Pablo Vera (consultor)",
  aprobadoPor: "Pendiente: Dr. Orellano / Ma. Julia Napoli",
  fecha: "2026-10-06",
  vigenteDesde: "2026-10-06",
  motivo: "Versión inicial según tabla de verificación 3A de la especificación M06 v1.1.",
  modelo: MODELO_POR_DEFECTO,
  sistema: `Sos un verificador de consistencia documental de informes de mamografía.
Tu única tarea es comparar la categoría BI-RADS consignada en la conclusión con los hallazgos descritos en el texto del informe.
No diagnosticás, no evaluás imágenes y no sugerís una categoría distinta.

Aplicá solo estas reglas:
- BI-RADS 0: el informe debe mencionar que se requiere un estudio adicional. Si no lo menciona, es inconsistente (regla BIRADS_0_SIN_ESTUDIO_ADICIONAL).
- BI-RADS 1: no debe describir nódulos, calcificaciones ni otros hallazgos. Si los describe sin justificar la categoría, es inconsistente (regla BIRADS_1_CON_HALLAZGOS).
- BI-RADS 2: el hallazgo descrito debe ser benigno. Si el texto describe características sospechosas, es inconsistente (regla BIRADS_2_HALLAZGO_NO_BENIGNO).
- BI-RADS 4 o 5: el texto debe describir hallazgos sospechosos. Si describe solo hallazgos normales, es inconsistente (regla BIRADS_4_5_HALLAZGOS_NORMALES).

Las menciones negadas ("sin nódulos", "no se observan calcificaciones") no son hallazgos.
Si el texto es ambiguo o la categoría no figura, respondé "indeterminado". No fuerces una inconsistencia.
Citá textualmente el fragmento en que te basás. Respondé solo con el JSON pedido.`,
  plantillaEntrada: `Tipo de estudio: {{tipoEstudio}}

HALLAZGOS:
{{hallazgos}}

CONCLUSIÓN:
{{conclusion}}`,
  seccionesEnviadas: ["hallazgos", "conclusion"],
  camposExcluidos: EXCLUIDOS,
  esquemaSalidaDescripcion: [
    "resultado: consistente | inconsistente | indeterminado",
    "categoriaDetectada: 0 a 6 o no_consignada",
    "reglaAplicada: código de la regla o NINGUNA",
    "evidencia: hasta 3 citas (sección + fragmento textual)",
    "explicacion: hasta 2 oraciones",
  ],
  reglasNivel: [
    "inconsistente → alerta naranja (SUPUESTO, a validar con Calidad)",
    "indeterminado → alerta azul informativa",
    "consistente → sin alerta",
    "respuesta que no cumple el esquema o error del proveedor → validación no ejecutada",
  ],
};

export const PROMPT_V5_1_0: ConfigPrompt = {
  validacion: "V5",
  version: "v5-prompt-1.0.0",
  estado: "vigente",
  autor: "Pablo Vera (consultor)",
  aprobadoPor: "Pendiente: equipo médico CDO",
  fecha: "2026-10-06",
  vigenteDesde: "2026-10-06",
  motivo: "Versión inicial según validación 5 de la especificación M06 v1.1.",
  modelo: MODELO_POR_DEFECTO,
  sistema: `Sos un verificador de completitud documental de informes ecográficos.
Para cada órgano de la lista recibida, clasificá su situación en el informe en una de estas categorías:
- medido: el órgano está presente y su medida está informada con un valor numérico.
- ausente_documentado: el informe indica expresamente la ausencia del órgano y su antecedente quirúrgico (por ejemplo "colecistectomizada", "riñón derecho ausente por nefrectomía").
- no_evaluable_explicado: el informe explica por qué no pudo evaluarse o medirse (por ejemplo interposición gaseosa).
- faltante_sin_explicacion: no hay medida ni explicación.

Nunca asumas que un órgano fue extirpado porque faltan sus medidas.
Si hay lateralidad (riñón, ovario), evaluá cada lado por separado.
Los marcadores sin completar como "xx mm" no son una medida.
Citá textualmente el fragmento en que te basás. Respondé solo con el JSON pedido.`,
  plantillaEntrada: `Tipo de estudio: {{tipoEstudio}}
Órganos a verificar: {{organos}}

TÉCNICA:
{{tecnica}}

HALLAZGOS:
{{hallazgos}}

CONCLUSIÓN:
{{conclusion}}`,
  seccionesEnviadas: ["tecnica", "hallazgos", "conclusion"],
  camposExcluidos: EXCLUIDOS,
  esquemaSalidaDescripcion: [
    "organos: lista con un elemento por órgano y lado",
    "organoId: identificador del órgano recibido",
    "categoria: medido | ausente_documentado | no_evaluable_explicado | faltante_sin_explicacion",
    "medidaEncontrada: texto de la medida o null",
    "evidencia: hasta 2 citas; explicacion: hasta 300 caracteres",
  ],
  reglasNivel: [
    "faltante_sin_explicacion → alerta amarilla (SUPUESTO, a validar con Calidad)",
    "marcador sin completar (\"xx mm\") → alerta naranja; lo detecta una regla de texto antes del modelo",
    "medido, ausente_documentado, no_evaluable_explicado → sin alerta",
    "respuesta que no cumple el esquema o error del proveedor → validación no ejecutada",
  ],
};

export const HISTORIAL_PROMPTS: ConfigPrompt[] = [PROMPT_V3A_1_0, PROMPT_V5_1_0];

export function promptVigente(v: "V3A" | "V5"): ConfigPrompt {
  const p = HISTORIAL_PROMPTS.find((x) => x.validacion === v && x.estado === "vigente");
  if (!p) throw new Error(`No hay prompt vigente para ${v}`);
  return p;
}

/** Completa la plantilla. Solo acepta secciones clínicas: el tipo impide pasar el encabezado. */
export function armarEntrada(
  p: ConfigPrompt,
  datos: { tipoEstudio: string; secciones: SeccionesClinicas; organos?: string },
): string {
  const vars: Record<string, string> = {
    tipoEstudio: datos.tipoEstudio,
    organos: datos.organos ?? "",
  };
  for (const s of p.seccionesEnviadas) vars[s] = datos.secciones[s] ?? "(sección vacía)";
  return p.plantillaEntrada.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
}
