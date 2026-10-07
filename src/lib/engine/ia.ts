import { armarEntrada, promptVigente, salidaV3ASchema, salidaV5Schema, type ConfigPrompt } from "../config/prompts";
import type { ConfigReglas, OrganoEsperado } from "../config/reglas";
import type { Alerta, Informe, ResultadoValidacion, SeccionesClinicas, TrazaLlm } from "../domain/types";
import { NOMBRE_ESTUDIO } from "../domain/types";
import type { ProveedorLlm } from "./llm";
import { ProveedorSimulado } from "./simulador";
import { crearAlerta, sha256 } from "./util";

/** Solo estas secciones pueden llegar a un modelo. El encabezado (identidad) nunca se incluye. */
function seccionesPermitidas(informe: Informe, p: ConfigPrompt): SeccionesClinicas {
  const out: SeccionesClinicas = {};
  for (const s of p.seccionesEnviadas) out[s] = informe.secciones[s];
  return out;
}

async function ejecutar<T>(params: {
  informe: Informe;
  prompt: ConfigPrompt;
  organos?: OrganoEsperado[];
  schema: Parameters<ProveedorLlm["generar"]>[0]["schema"];
  proveedor?: ProveedorLlm;
}): Promise<{ salida: T; traza: TrazaLlm }> {
  const secciones = seccionesPermitidas(params.informe, params.prompt);
  const entrada = armarEntrada(params.prompt, {
    tipoEstudio: NOMBRE_ESTUDIO[params.informe.tipoEstudio],
    secciones,
    organos: params.organos?.map((o) => `${o.id} (${o.nombre})`).join(", "),
  });
  // Sin proveedor explícito se usa el simulador: el modelo de pago solo se llama para informes reales (ver motor.ts).
  const proveedor = params.proveedor ?? new ProveedorSimulado().preparar(secciones, params.organos);
  const t0 = Date.now();
  const salida = (await proveedor.generar({ prompt: params.prompt, entrada, schema: params.schema })) as T;
  return {
    salida,
    traza: {
      proveedor: proveedor.nombre,
      modelo: proveedor.modelo,
      versionPrompt: params.prompt.version,
      seccionesEnviadas: params.prompt.seccionesEnviadas,
      camposIdentificatoriosEnviados: false,
      hashEntrada: sha256(entrada),
      duracionMs: Date.now() - t0,
    },
  };
}

function noEjecutada(v: "V3A" | "V5", error: unknown): ResultadoValidacion {
  return {
    validacion: v,
    estado: "no_ejecutada",
    motivo: `No se pudo obtener una respuesta válida del modelo: ${error instanceof Error ? error.message : String(error)}`,
    alertas: [],
  };
}

/** V3A: coherencia BI-RADS / hallazgos (solo mamografía). */
export async function validarBirads(informe: Informe, reglas: ConfigReglas, proveedor?: ProveedorLlm): Promise<ResultadoValidacion> {
  if (informe.tipoEstudio !== "mamografia") return { validacion: "V3A", estado: "no_aplica", alertas: [] };
  const prompt = promptVigente("V3A");
  try {
    const { salida, traza } = await ejecutar<import("../config/prompts").SalidaV3A>({ informe, prompt, schema: salidaV3ASchema, proveedor });
    const alertas: Alerta[] = [];
    const nivel =
      salida.resultado === "inconsistente" ? reglas.v3a.nivelInconsistente : salida.resultado === "indeterminado" ? reglas.v3a.nivelIndeterminado : null;
    if (nivel) {
      alertas.push(
        crearAlerta({
          informeId: informe.id,
          validacion: "V3A",
          nivel,
          titulo:
            salida.resultado === "inconsistente"
              ? `BI-RADS ${salida.categoriaDetectada} no coincide con los hallazgos descritos`
              : "No se pudo verificar la categoría BI-RADS",
          detalle: salida.explicacion,
          evidencia: salida.evidencia,
          versionReglas: reglas.version,
          versionPrompt: prompt.version,
          clave: salida.reglaAplicada,
        }),
      );
    }
    return { validacion: "V3A", estado: "ejecutada", alertas, traza };
  } catch (e) {
    return noEjecutada("V3A", e);
  }
}

/** Marcadores sin completar ("xx mm", "__ mm"): regla de texto, no depende del modelo. */
export function detectarMarcadores(informe: Informe, reglas: ConfigReglas): Alerta[] {
  const alertas: Alerta[] = [];
  for (const seccion of ["tecnica", "hallazgos", "conclusion"] as const) {
    const texto = informe.secciones[seccion] ?? "";
    const re = /[^.\n]*(?:\bx{2,}\b|_{2,}|\?{2,})\s*(?:mm|cm|ml|cc)?[^.\n]*/gi;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(texto))) {
      alertas.push(
        crearAlerta({
          informeId: informe.id,
          validacion: "V5",
          nivel: reglas.v5.nivelPlaceholder,
          titulo: "Medida sin completar",
          detalle: "El informe tiene un marcador de plantilla sin reemplazar por el valor medido. Completá la medida o explicá por qué no se pudo obtener.",
          evidencia: [{ seccion, fragmento: m[0].trim() }],
          versionReglas: reglas.version,
          clave: `marcador-${seccion}-${i++}`,
        }),
      );
    }
  }
  return alertas;
}

/** V5: órgano ausente y medidas incompletas. */
export async function validarOrganos(informe: Informe, reglas: ConfigReglas, proveedor?: ProveedorLlm): Promise<ResultadoValidacion> {
  const organos = reglas.v5.organos[informe.tipoEstudio];
  const marcadores = detectarMarcadores(informe, reglas);
  if (!organos?.length) {
    return { validacion: "V5", estado: marcadores.length ? "ejecutada" : "no_aplica", alertas: marcadores };
  }
  const prompt = promptVigente("V5");
  try {
    const { salida, traza } = await ejecutar<import("../config/prompts").SalidaV5>({ informe, prompt, organos, schema: salidaV5Schema, proveedor });
    // Un órgano que ya tiene alerta de marcador en su oración no se alerta dos veces.
    const textosMarcador = marcadores.map((a) => a.evidencia[0]?.fragmento ?? "");
    const alertas = [...marcadores];
    for (const o of salida.organos) {
      if (o.categoria !== "faltante_sin_explicacion") continue;
      const org = organos.find((x) => x.id === o.organoId);
      if (!org) continue;
      const re = new RegExp(org.patron, "i");
      if (textosMarcador.some((t) => re.test(t))) continue;
      alertas.push(
        crearAlerta({
          informeId: informe.id,
          validacion: "V5",
          nivel: reglas.v5.nivelFaltanteSinExplicacion,
          titulo: `${org.nombre}: sin medida ni explicación`,
          detalle: `${o.explicacion} Si el órgano fue extirpado, indicá la ausencia y el antecedente (por ejemplo "${
            org.id.startsWith("rinon") ? `riñón ${org.lateralidad} ausente por nefrectomía` : org.id === "vesicula" ? "colecistectomizada" : "ausente por antecedente quirúrgico"
          }"). Si no pudo evaluarse, explicá el motivo.`,
          evidencia: o.evidencia.length ? o.evidencia : [{ seccion: "hallazgos", fragmento: "(el órgano no se menciona)" }],
          versionReglas: reglas.version,
          versionPrompt: prompt.version,
          clave: `organo-${o.organoId}`,
        }),
      );
    }
    return { validacion: "V5", estado: "ejecutada", alertas, traza };
  } catch (e) {
    // Si el modelo falla, los marcadores (regla de texto) igual se informan, pero la validación queda incompleta.
    return { ...noEjecutada("V5", e), alertas: marcadores };
  }
}
