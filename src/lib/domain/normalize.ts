import type { TipoEstudio } from "./types";

/** Quita tildes, pasa a mayúsculas, elimina puntuación y colapsa espacios. */
export function normalizarTexto(s: string | undefined | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9Ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza un nombre a un conjunto ordenado de palabras, para que
 * "PÉREZ, Juan Carlos" y "Juan Carlos Perez" se consideren iguales.
 */
export function normalizarNombre(s: string | undefined | null): string {
  return normalizarTexto(s).split(" ").filter(Boolean).sort().join(" ");
}

/** Deja solo los dígitos del DNI ("20.345.678" → "20345678"). */
export function normalizarDni(s: string | undefined | null): string {
  return (s ?? "").replace(/\D+/g, "").replace(/^0+/, "");
}

/** Acepta dd/mm/aaaa, dd-mm-aaaa, d/m/aa y aaaa-mm-dd. Devuelve aaaa-mm-dd o "" si no se puede leer. */
export function normalizarFecha(s: string | undefined | null): string {
  const t = (s ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = (Number(y) > 30 ? "19" : "20") + y;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

const SINONIMOS_ESTUDIO: [RegExp, TipoEstudio][] = [
  [/MAMOGRAF/, "mamografia"],
  [/DENSITOMETR/, "densitometria"],
  [/ECOGRAF.*(RENAL|RINON|URINARI)/, "ecografia_renal"],
  [/ECOGRAF.*(GINECO|TRANSVAGINAL|PELVI)/, "ecografia_ginecologica"],
  [/ECOGRAF.*TIROI/, "ecografia_tiroidea"],
  [/ECOGRAF.*ABDOM/, "ecografia_abdominal"],
  [/(RADIOGRAF|RX).*TORAX/, "radiografia_torax"],
  [/(TOMOGRAF|TAC|TC )/, "tomografia"],
  [/(RESONANCIA|RMN|RM )/, "resonancia"],
  [/^OTRO/, "otro"],
];

/** Lleva el texto libre del tipo de estudio al código interno. */
export function normalizarTipoEstudio(s: string | undefined | null): TipoEstudio | null {
  const t = normalizarTexto(s) + " ";
  for (const [re, tipo] of SINONIMOS_ESTUDIO) if (re.test(t)) return tipo;
  return null;
}

/** Palabras normalizadas, para comparar textos. */
export function palabras(s: string | undefined | null): string[] {
  return normalizarTexto(s).split(" ").filter(Boolean);
}

/** Recorta un fragmento alrededor de una posición, para mostrar como evidencia. */
export function fragmento(texto: string, inicio: number, fin: number, margen = 40): string {
  const a = Math.max(0, inicio - margen);
  const b = Math.min(texto.length, fin + margen);
  return (a > 0 ? "…" : "") + texto.slice(a, b).trim() + (b < texto.length ? "…" : "");
}

const NEGADORES = /\b(sin|no se (observan?|identifican?|visualizan?|detectan?|evidencian?)|ausencia de|descarta|negativ[oa] para)\b[^.;:]{0,90}$/i;

/**
 * Indica si un término aparece en el texto sin estar negado
 * ("sin nódulos" o "no se observan calcificaciones" no cuentan).
 */
export function mencionAfirmativa(texto: string | undefined, termino: RegExp): RegExpExecArray | null {
  if (!texto) return null;
  const re = new RegExp(termino.source, termino.flags.includes("g") ? termino.flags : termino.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const antes = texto.slice(Math.max(0, m.index - 150), m.index);
    const ultimaOracion = antes.split(/[.;\n]/).pop() ?? "";
    if (!NEGADORES.test(ultimaOracion)) return m;
  }
  return null;
}
