import type { ConfigReglas } from "../config/reglas";
import type { Informe, ResultadoValidacion } from "../domain/types";
import { fragmento, mencionAfirmativa } from "../domain/normalize";
import { crearAlerta } from "./util";

export type ClaseOsea = "normal" | "osteopenia" | "osteoporosis";

export interface ValorT {
  valor: number;
  texto: string;
  inicio: number;
  fin: number;
}

/** Extrae todos los T-score informados ("T-score: -2,7", "T score -1.3", "puntaje T -0.8"). */
export function extraerTScores(texto: string): ValorT[] {
  const re = /(?:t[\s-]*score|puntaje\s*t|[íi]ndice\s*t)\s*(?:de|:|=)?\s*([-−–]?\s*\d+(?:[.,]\d+)?)/gi;
  const out: ValorT[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const num = Number(m[1].replace(/[−–]/, "-").replace(/\s/g, "").replace(",", "."));
    if (!Number.isNaN(num) && num > -10 && num < 10) out.push({ valor: num, texto: m[0], inicio: m.index, fin: m.index + m[0].length });
  }
  return out;
}

/** Clasificación según la regla de la especificación (criterio OMS). */
export function clasificarT(t: number, reglas: ConfigReglas): ClaseOsea {
  if (t >= reglas.v3b.limiteNormal) return "normal";
  if (t <= reglas.v3b.limiteOsteoporosis) return "osteoporosis";
  return "osteopenia";
}

const PATRONES: Record<ClaseOsea, RegExp> = {
  osteoporosis: /osteoporosis/i,
  osteopenia: /osteopenia|baja masa [óo]sea|masa [óo]sea baja/i,
  normal: /normal|dentro de (los )?(par[áa]metros|l[íi]mites)|densidad mineral [óo]sea conservada/i,
};

/** Clases que la conclusión afirma (ignora menciones negadas como "sin osteoporosis"). */
export function clasesEnConclusion(conclusion: string): ClaseOsea[] {
  const out: ClaseOsea[] = [];
  if (mencionAfirmativa(conclusion, PATRONES.osteoporosis)) out.push("osteoporosis");
  if (mencionAfirmativa(conclusion, PATRONES.osteopenia)) out.push("osteopenia");
  if (out.length === 0 && mencionAfirmativa(conclusion, PATRONES.normal)) out.push("normal");
  return out;
}

const PESO: Record<ClaseOsea, number> = { normal: 0, osteopenia: 1, osteoporosis: 2 };

/**
 * V3B: coherencia entre T-score y conclusión.
 * Con varios sitios medidos (columna, cadera) se usa el T-score más bajo, como en el criterio diagnóstico.
 */
export function validarDensitometria(informe: Informe, reglas: ConfigReglas): ResultadoValidacion {
  if (informe.tipoEstudio !== "densitometria") return { validacion: "V3B", estado: "no_aplica", alertas: [] };

  const texto = [informe.secciones.hallazgos, informe.secciones.tecnica].filter(Boolean).join("\n");
  const conclusion = informe.secciones.conclusion ?? "";
  const valores = extraerTScores(texto).concat(extraerTScores(conclusion));

  if (valores.length === 0) {
    return {
      validacion: "V3B",
      estado: "ejecutada",
      alertas: [
        crearAlerta({
          informeId: informe.id,
          validacion: "V3B",
          nivel: "azul",
          titulo: "No se encontró un T-score para verificar",
          detalle: "El informe de densitometría no tiene un valor de T-score legible, por lo que no se pudo verificar la conclusión.",
          evidencia: [{ seccion: "hallazgos", fragmento: (informe.secciones.hallazgos ?? "(vacío)").slice(0, 160) }],
          versionReglas: reglas.version,
          clave: "sin-tscore",
        }),
      ],
    };
  }

  const peor = valores.reduce((a, b) => (b.valor < a.valor ? b : a));
  const esperada = clasificarT(peor.valor, reglas);
  const informadas = clasesEnConclusion(conclusion);
  const informadaPrincipal = informadas.sort((a, b) => PESO[b] - PESO[a])[0];

  if (informadaPrincipal === esperada) return { validacion: "V3B", estado: "ejecutada", alertas: [] };

  const fuente = texto.includes(peor.texto) ? texto : conclusion;
  return {
    validacion: "V3B",
    estado: "ejecutada",
    alertas: [
      crearAlerta({
        informeId: informe.id,
        validacion: "V3B",
        nivel: reglas.v3b.nivelInconsistencia,
        titulo: informadaPrincipal
          ? `Conclusión "${informadaPrincipal}" no coincide con T-score ${peor.valor.toFixed(1)}`
          : `La conclusión no indica la clasificación para T-score ${peor.valor.toFixed(1)}`,
        detalle: `Con un T-score de ${peor.valor.toFixed(1)} la clasificación esperada es "${esperada}" (normal ≥ ${reglas.v3b.limiteNormal}; osteoporosis ≤ ${reglas.v3b.limiteOsteoporosis}). ${
          valores.length > 1 ? `Se tomó el valor más bajo de ${valores.length} informados. ` : ""
        }Revisá la conclusión o el valor transcripto.`,
        evidencia: [
          { seccion: fuente === conclusion ? "conclusion" : "hallazgos", fragmento: fragmento(fuente, peor.inicio, peor.fin) },
          { seccion: "conclusion", fragmento: conclusion.trim() || "(vacía)" },
        ],
        versionReglas: reglas.version,
        clave: "inconsistencia",
      }),
    ],
  };
}
