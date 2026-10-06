import type { EncabezadoPaciente, SeccionesClinicas } from "../domain/types";

/**
 * Lectura del texto de un informe PDF: encabezado del paciente, secciones clínicas y firma.
 * Las etiquetas son configurables porque el formato real de los PDF de CDO está PENDIENTE de validación:
 * con un par de informes anonimizados se ajustan estas listas sin tocar el motor.
 */

export const ETIQUETAS = {
  paciente: ["Paciente", "Apellido y nombre", "Nombre y apellido", "Nombre"],
  dni: ["DNI", "D\\.N\\.I\\.?", "Documento", "Nro\\.? de documento"],
  fechaNacimiento: ["Fecha de nacimiento", "F\\. ?de nac\\.?", "Nacimiento", "Fecha nac\\.?"],
  estudio: ["Estudio", "Tipo de estudio", "Práctica", "Prestación"],
  turno: ["Turno N°", "Turno Nº", "Turno", "N° de turno", "Orden"],
  fecha: ["Fecha del estudio", "Fecha"],
} as const;

export const TITULOS_SECCION: Record<keyof SeccionesClinicas, string[]> = {
  tecnica: ["TÉCNICA", "TECNICA", "Técnica utilizada", "PROCEDIMIENTO", "MÉTODO"],
  hallazgos: ["HALLAZGOS", "INFORME", "DESCRIPCIÓN", "DESCRIPCION", "RESULTADOS"],
  conclusion: ["CONCLUSIÓN", "CONCLUSION", "IMPRESIÓN DIAGNÓSTICA", "IMPRESION DIAGNOSTICA", "DIAGNÓSTICO", "DIAGNOSTICO"],
};

const FIRMA = /^.{0,80}\b(M\.? ?P\.?|M\.? ?N\.?|Matr[íi]cula)\s*(N[°º]\s*)?\d{2,6}.*$/im;
const PIE = /^(Informe sint[ée]tico|P[áa]gina \d|Este informe|Documento firmado).*$/im;

export interface InformeLeido {
  encabezado: EncabezadoPaciente;
  turnoId?: string;
  fechaEstudio?: string;
  secciones: SeccionesClinicas;
  medicoFirmante?: string;
  /** Problemas de lectura: se muestran al médico y a Calidad, nunca se ocultan. */
  advertencias: string[];
}

/** Une los cortes de línea del PDF que parten una oración ("midiendo xx\nmm."). */
export function unirLineas(texto: string): string {
  const lineas = texto.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const out: string[] = [];
  for (const l of lineas) {
    if (!l) continue;
    const prev = out.at(-1);
    const empiezaEtiqueta = /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ° .]{1,40}:/.test(l);
    if (prev !== undefined && !/[.:;]$/.test(prev) && !empiezaEtiqueta) out[out.length - 1] = `${prev} ${l}`;
    else out.push(l);
  }
  return out.join("\n");
}

function alternativas(xs: readonly string[]): string {
  return xs.map((x) => x.replace(/ /g, "\\s+")).join("|");
}

/** Valor de un campo del encabezado: lo que sigue a la etiqueta hasta la próxima etiqueta conocida o fin de línea. */
function campo(texto: string, etiquetas: readonly string[]): string | undefined {
  const todas = Object.values(ETIQUETAS).flat();
  const re = new RegExp(`(?:^|\\s)(?:${alternativas(etiquetas)})\\s*[:.]\\s*(.+)$`, "im");
  const m = re.exec(texto);
  if (!m) return undefined;
  let v = m[1];
  const corte = new RegExp(`\\s(?:${alternativas(todas)})\\s*:`, "i").exec(v);
  if (corte) v = v.slice(0, corte.index);
  return v.trim() || undefined;
}

export function leerInforme(textoPdf: string): InformeLeido {
  const advertencias: string[] = [];
  const texto = unirLineas(textoPdf);

  // Posición de cada título de sección.
  const posiciones = (Object.keys(TITULOS_SECCION) as (keyof SeccionesClinicas)[])
    .map((s) => {
      const re = new RegExp(`^\\s*(?:${alternativas(TITULOS_SECCION[s])})\\s*:?\\s*`, "m");
      const m = re.exec(texto);
      return m ? { s, inicio: m.index, finTitulo: m.index + m[0].length } : null;
    })
    .filter((x): x is { s: keyof SeccionesClinicas; inicio: number; finTitulo: number } => !!x)
    .sort((a, b) => a.inicio - b.inicio);

  const inicioCuerpo = posiciones[0]?.inicio ?? texto.length;
  const cabecera = texto.slice(0, inicioCuerpo);
  const firma = FIRMA.exec(texto.slice(inicioCuerpo));
  const pie = PIE.exec(texto.slice(inicioCuerpo));
  const finCuerpo = Math.min(
    firma ? inicioCuerpo + firma.index : texto.length,
    pie ? inicioCuerpo + pie.index : texto.length,
  );

  const secciones: SeccionesClinicas = {};
  posiciones.forEach((p, i) => {
    const fin = Math.min(posiciones[i + 1]?.inicio ?? finCuerpo, finCuerpo);
    secciones[p.s] = texto.slice(p.finTitulo, Math.max(p.finTitulo, fin)).trim();
  });
  for (const s of Object.keys(TITULOS_SECCION) as (keyof SeccionesClinicas)[])
    if (!posiciones.some((p) => p.s === s)) advertencias.push(`No se encontró el título de la sección «${s}» en el PDF`);

  const encabezado: EncabezadoPaciente = {
    apellidoNombre: campo(cabecera, ETIQUETAS.paciente),
    dni: campo(cabecera, ETIQUETAS.dni),
    fechaNacimiento: campo(cabecera, ETIQUETAS.fechaNacimiento),
    tipoEstudio: campo(cabecera, ETIQUETAS.estudio),
  };
  for (const [k, v] of Object.entries(encabezado)) if (!v) advertencias.push(`No se pudo leer «${k}» en el encabezado`);

  return {
    encabezado,
    turnoId: campo(cabecera, ETIQUETAS.turno)?.split(/\s/)[0],
    fechaEstudio: campo(cabecera, ETIQUETAS.fecha),
    secciones,
    medicoFirmante: firma?.[0].trim(),
    advertencias,
  };
}
