import type { ConfigReglas } from "../config/reglas";
import type { ContextoValidacion, Informe, Nivel, ResultadoValidacion } from "../domain/types";
import { palabras } from "../domain/normalize";
import { crearAlerta } from "./util";

function ngramas(tokens: string[], n: number): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) s.add(tokens.slice(i, i + n).join(" "));
  return s;
}

/**
 * Proporción del texto actual que ya estaba en el anterior (contención de n-gramas de palabras).
 * Mide "cuánto del informe actual es copia", que es lo que pide la especificación.
 */
export function similitud(actual: string, anterior: string, n = 3): number {
  const a = ngramas(palabras(actual), n);
  if (a.size === 0) return 0;
  const b = ngramas(palabras(anterior), n);
  let comunes = 0;
  for (const g of a) if (b.has(g)) comunes++;
  return comunes / a.size;
}

/** Valores numéricos con unidad o decimales ("12 mm", "0,912", "-1,8"), normalizados. */
export function medidas(texto: string): string[] {
  return (texto.match(/-?\d+(?:[.,]\d+)?\s*(?:mm|cm|ml|cc|g\/cm²|%)?/gi) ?? [])
    .map((x) => x.replace(",", ".").replace(/\s+/g, "").toLowerCase())
    .sort();
}

const SECCIONES = ["hallazgos", "conclusion"] as const;

/** V2: contenido duplicado contra los últimos N informes del mismo médico y tipo de estudio. */
export function validarDuplicado(
  informe: Informe,
  ctx: ContextoValidacion,
  reglas: ConfigReglas,
): ResultadoValidacion {
  const cfg = reglas.v2;
  const previos = ctx.historial
    .filter(
      (h) =>
        h.id !== informe.id &&
        h.medicoId === informe.medicoId &&
        h.tipoEstudio === informe.tipoEstudio &&
        h.turnoId !== informe.turnoId,
    )
    .slice(0, cfg.cantidadHistorial);

  if (previos.length === 0) {
    return { validacion: "V2", estado: "no_aplica", motivo: "Sin informes previos del mismo médico y tipo de estudio", alertas: [] };
  }

  const alertas = [];
  for (const seccion of SECCIONES) {
    const texto = informe.secciones[seccion] ?? "";
    if (palabras(texto).length < cfg.minPalabras) continue; // frases estándar cortas: no se comparan
    if (cfg.plantillasAprobadas.some((pl) => similitud(texto, pl, cfg.tamanoNgrama) >= cfg.umbralAdvertencia)) continue;
    let mejor = { sim: 0, previo: null as Informe | null };
    const medidasActuales = medidas(texto).join("|");
    for (const p of previos) {
      const textoPrevio = p.secciones[seccion] ?? "";
      if (cfg.ignorarSiMedidasCambian && medidasActuales && medidas(textoPrevio).join("|") !== medidasActuales) continue;
      const s = similitud(texto, textoPrevio, cfg.tamanoNgrama);
      if (s > mejor.sim) mejor = { sim: s, previo: p };
    }
    let nivel: Nivel | null = null;
    if (mejor.sim >= cfg.umbralCritico) nivel = "naranja";
    else if (mejor.sim >= cfg.umbralAdvertencia) nivel = "amarilla";
    if (!nivel || !mejor.previo) continue;
    const pct = Math.round(mejor.sim * 100);
    alertas.push(
      crearAlerta({
        informeId: informe.id,
        validacion: "V2",
        nivel,
        titulo: `${seccion === "hallazgos" ? "Hallazgos" : "Conclusión"} ${pct}% igual a un informe anterior`,
        detalle: `El texto de esta sección coincide en un ${pct}% con el informe del ${mejor.previo.fecha.slice(0, 10)} del mismo médico y tipo de estudio. Verificá que describa al paciente actual.`,
        evidencia: [{ seccion, fragmento: texto.slice(0, 160) + (texto.length > 160 ? "…" : "") }],
        versionReglas: reglas.version,
        clave: seccion,
      }),
    );
  }
  return { validacion: "V2", estado: "ejecutada", alertas };
}
