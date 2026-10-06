import type { ProveedorLlm } from "./llm";
import type { ConfigPrompt, SalidaV3A, SalidaV5 } from "../config/prompts";
import type { OrganoEsperado } from "../config/reglas";
import type { SeccionesClinicas } from "../domain/types";
import { mencionAfirmativa } from "../domain/normalize";

/**
 * Simulador local del modelo de IA para demos y pruebas sin conexión.
 * Aplica las mismas reglas del prompt con expresiones regulares.
 * En la interfaz se identifica como "Simulador local (sin IA)" para que nadie lo confunda con el modelo real.
 */

const HALLAZGO = /n[óo]dulo|calcificaci[óo]n|calcificaciones|masa|distorsi[óo]n|asimetr[íi]a|quiste/i;
const SOSPECHA = /espiculad|irregular|pleom[óo]rf|microcalcificaciones (agrupadas|lineales|segmentarias)|sospechos|mal definid|retracci[óo]n/i;
const ESTUDIO_ADICIONAL = /complement|estudio adicional|ecograf|magnificaci|focalizada|proyecci[óo]n adicional|resonancia|comparar con (estudios )?previos/i;

function cita(texto: string | undefined, m: RegExpExecArray | null, seccion: "hallazgos" | "conclusion") {
  if (!texto || !m) return [];
  const a = Math.max(0, texto.lastIndexOf(".", m.index) + 1);
  const finPunto = texto.indexOf(".", m.index);
  const b = finPunto === -1 ? texto.length : finPunto + 1;
  return [{ seccion, fragmento: texto.slice(a, b).trim() }];
}

export function simularV3A(s: SeccionesClinicas): SalidaV3A {
  const conclusion = s.conclusion ?? "";
  const hallazgos = s.hallazgos ?? "";
  const mCat = /bi[\s-]?rads[^0-9]{0,12}([0-6])/i.exec(conclusion) ?? /bi[\s-]?rads[^0-9]{0,12}([0-6])/i.exec(hallazgos);
  if (!mCat) {
    return { resultado: "indeterminado", categoriaDetectada: "no_consignada", reglaAplicada: "NINGUNA", evidencia: [], explicacion: "No se encontró la categoría BI-RADS en el informe." };
  }
  const cat = mCat[1] as SalidaV3A["categoriaDetectada"];
  const evCat = cita(conclusion, /bi[\s-]?rads[^0-9]{0,12}[0-6]/i.exec(conclusion), "conclusion");
  const todo = `${hallazgos} ${conclusion}`;

  if (cat === "0") {
    const m = ESTUDIO_ADICIONAL.exec(todo);
    return m
      ? { resultado: "consistente", categoriaDetectada: cat, reglaAplicada: "NINGUNA", evidencia: cita(conclusion, m, "conclusion"), explicacion: "Se menciona el estudio adicional requerido." }
      : { resultado: "inconsistente", categoriaDetectada: cat, reglaAplicada: "BIRADS_0_SIN_ESTUDIO_ADICIONAL", evidencia: evCat, explicacion: "BI-RADS 0 indica estudio incompleto, pero el informe no menciona qué estudio adicional se requiere." };
  }
  if (cat === "1") {
    const m = mencionAfirmativa(hallazgos, HALLAZGO);
    return m
      ? { resultado: "inconsistente", categoriaDetectada: cat, reglaAplicada: "BIRADS_1_CON_HALLAZGOS", evidencia: [...cita(hallazgos, m, "hallazgos"), ...evCat], explicacion: "BI-RADS 1 corresponde a un estudio negativo, pero los hallazgos describen un hallazgo." }
      : { resultado: "consistente", categoriaDetectada: cat, reglaAplicada: "NINGUNA", evidencia: [], explicacion: "Sin hallazgos descritos, coherente con BI-RADS 1." };
  }
  if (cat === "2") {
    const m = mencionAfirmativa(hallazgos, SOSPECHA);
    return m
      ? { resultado: "inconsistente", categoriaDetectada: cat, reglaAplicada: "BIRADS_2_HALLAZGO_NO_BENIGNO", evidencia: [...cita(hallazgos, m, "hallazgos"), ...evCat], explicacion: "BI-RADS 2 indica hallazgo benigno, pero se describen características sospechosas." }
      : { resultado: "consistente", categoriaDetectada: cat, reglaAplicada: "NINGUNA", evidencia: [], explicacion: "Hallazgo descrito compatible con benignidad." };
  }
  if (cat === "4" || cat === "5") {
    const sospecha = mencionAfirmativa(hallazgos, SOSPECHA) ?? mencionAfirmativa(hallazgos, HALLAZGO);
    if (sospecha) return { resultado: "consistente", categoriaDetectada: cat, reglaAplicada: "NINGUNA", evidencia: [], explicacion: "Se describen hallazgos compatibles con la categoría." };
    const normal = /sin (hallazgos|alteraciones)|normal|no se observan/i.exec(hallazgos);
    return { resultado: "inconsistente", categoriaDetectada: cat, reglaAplicada: "BIRADS_4_5_HALLAZGOS_NORMALES", evidencia: [...cita(hallazgos, normal, "hallazgos"), ...evCat], explicacion: `BI-RADS ${cat} indica sospecha de malignidad, pero los hallazgos describen un estudio normal.` };
  }
  return { resultado: "consistente", categoriaDetectada: cat, reglaAplicada: "NINGUNA", evidencia: [], explicacion: "Categoría sin regla de verificación en esta versión." };
}

const AUSENTE = /ausente|colecistectomizad|nefrectomi|histerectomizad|ooforectomi|anexectomi|extirpad|resecad|antecedente quir[úu]rgico/i;
const NO_EVALUABLE = /no (pudo|puede|logr[óo]) (ser )?(evaluad|medid|visualizad)|no evaluable|interposici[óo]n gaseosa|meteorismo|no se logr[óo] (medir|visualizar)|dificultad t[ée]cnica/i;
const MEDIDA = /\d+(?:[.,]\d+)?\s*(mm|cm)\b/i;

export function simularV5(s: SeccionesClinicas, organos: OrganoEsperado[]): SalidaV5 {
  const texto = [s.tecnica, s.hallazgos, s.conclusion].filter(Boolean).join("\n");
  const oraciones = texto.split(/(?<=\.)\s+|\n/); // no corta en decimales ("4.9 cm")
  return {
    organos: organos.map((o) => {
      const re = new RegExp(o.patron, "i");
      // Para órganos con lateralidad, también vale la mención conjunta ("riñones", "ambos ovarios") si tiene medida propia.
      // Un párrafo rotulado con el órgano ("ISTMO: … Midiendo 0.29 cm.") pertenece completo al órgano.
      const rotulo = new RegExp(`^\\s*(?:${o.patron})\\s*:`, "i");
      const bloques = texto.split("\n").filter((l) => rotulo.test(l));
      const delOrgano = [...bloques, ...oraciones.filter((x) => re.test(x))];
      const enTexto = delOrgano.join(" ");
      const ev = delOrgano.slice(0, 1).map((f) => ({ seccion: "hallazgos" as const, fragmento: f.trim() }));
      // Una mención conjunta ("riñón derecho e izquierdo: … 9 mm") no cuenta como medida de cada lado.
      const conjunta = (x: string) => !!o.lateralidad && /derech[oa]s? e izquierd[oa]s?|ambos/i.test(x);
      const conMedida = delOrgano.find((x) => MEDIDA.test(x) && !/\bx{2,}\b/i.test(x) && !conjunta(x));
      if (conMedida) return { organoId: o.id, categoria: "medido" as const, medidaEncontrada: MEDIDA.exec(conMedida)?.[0] ?? null, evidencia: [{ seccion: "hallazgos" as const, fragmento: conMedida.trim() }], explicacion: "Medida informada." };
      if (AUSENTE.test(enTexto) || (o.id === "vesicula" && /colecistectomizad/i.test(texto)) || (o.id === "utero" && /histerectomizad/i.test(texto)))
        return { organoId: o.id, categoria: "ausente_documentado" as const, medidaEncontrada: null, evidencia: ev, explicacion: "Ausencia y antecedente documentados." };
      if (NO_EVALUABLE.test(enTexto)) return { organoId: o.id, categoria: "no_evaluable_explicado" as const, medidaEncontrada: null, evidencia: ev, explicacion: "Se explica por qué no pudo evaluarse." };
      // Órganos sin requisito de medida explícita (hígado, páncreas, bazo) se consideran informados si hay descripción.
      if (delOrgano.length > 0 && !o.requiereMedida)
        return { organoId: o.id, categoria: "medido" as const, medidaEncontrada: null, evidencia: ev, explicacion: "Órgano descrito; no requiere medida en esta versión." };
      return { organoId: o.id, categoria: "faltante_sin_explicacion" as const, medidaEncontrada: null, evidencia: ev, explicacion: delOrgano.length ? "Se menciona el órgano pero no hay medida ni explicación." : "No se menciona el órgano ni se explica su ausencia." };
    }),
  };
}

export class ProveedorSimulado implements ProveedorLlm {
  nombre = "Simulador local (sin IA)";
  modelo = "reglas-simuladas";
  private organos: OrganoEsperado[] = [];
  private secciones: SeccionesClinicas = {};

  /** El simulador recibe las secciones directamente; el proveedor real recibe solo el texto armado con la plantilla. */
  preparar(secciones: SeccionesClinicas, organos: OrganoEsperado[] = []) {
    this.secciones = secciones;
    this.organos = organos;
    return this;
  }

  async generar<T>({ prompt }: { prompt: ConfigPrompt; entrada: string }): Promise<T> {
    if (prompt.validacion === "V3A") return simularV3A(this.secciones) as T;
    return simularV5(this.secciones, this.organos) as T;
  }
}
