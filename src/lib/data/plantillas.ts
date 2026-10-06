import type { Informe, Medico, SeccionesClinicas, TipoEstudio, Turno } from "../domain/types";
import { NOMBRE_ESTUDIO } from "../domain/types";

/**
 * Generador de informes SINTÉTICOS. Ningún dato corresponde a pacientes reales.
 * Los textos imitan la estructura de informes de diagnóstico por imágenes para probar las validaciones.
 */

export class Azar {
  private s: number;
  constructor(semilla: number) {
    this.s = semilla >>> 0 || 1;
  }
  sig(): number {
    // mulberry32
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  entero(min: number, max: number): number {
    return min + Math.floor(this.sig() * (max - min + 1));
  }
  elegir<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.sig() * xs.length)];
  }
  decimal(min: number, max: number, dec = 1): number {
    return Number((min + this.sig() * (max - min)).toFixed(dec));
  }
}

const NOMBRES = ["María", "Lucía", "Ana", "Sofía", "Carmen", "Laura", "Graciela", "Silvia", "Juan", "Carlos", "José", "Miguel", "Raúl", "Jorge", "Patricia", "Inés", "Rosa", "Andrea", "Mónica", "Beatriz"];
const APELLIDOS = ["Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "Sánchez", "Romero", "Sosa", "Torres", "Álvarez", "Ruiz", "Ramírez", "Flores", "Acosta", "Benítez", "Medina", "Herrera", "Suárez", "Aguirre", "Giménez", "Molina", "Castro", "Ortiz", "Rojas"];

export const MEDICOS: Medico[] = Array.from({ length: 21 }, (_, i) => ({
  id: `M${String(i + 1).padStart(2, "0")}`,
  nombre: `Médico ${String(i + 1).padStart(2, "0")}`,
}));

export function pacienteSintetico(az: Azar): Omit<Turno, "id" | "tipoEstudio" | "medicoId"> {
  const nombre = `${az.elegir(APELLIDOS).toUpperCase()}, ${az.elegir(NOMBRES)}`;
  const dni = String(az.entero(14_000_000, 45_999_999));
  const fecha = `${String(az.entero(1, 28)).padStart(2, "0")}/${String(az.entero(1, 12)).padStart(2, "0")}/${az.entero(1945, 2000)}`;
  return { apellidoNombre: nombre, dni: dni.replace(/(\d+)(\d{3})(\d{3})$/, "$1.$2.$3"), fechaNacimiento: fecha };
}

// ---------- Textos por tipo de estudio ----------

export function mamografia(az: Azar, birads: "0" | "1" | "2" | "4" | "5" = "1"): SeccionesClinicas {
  const densidad = az.elegir(["tipo A (predominantemente grasas)", "tipo B (densidades fibroglandulares dispersas)", "tipo C (heterogéneamente densas)"]);
  const base = `Mamas de densidad ${densidad}. Piel y complejo areola-pezón sin alteraciones. Regiones axilares sin adenomegalias.`;
  const tecnica = "Mamografía digital bilateral en proyecciones cráneo-caudal y medio-lateral oblicua.";
  switch (birads) {
    case "0":
      return { tecnica, hallazgos: `${base} Asimetría focal en cuadrante superoexterno de mama ${az.elegir(["derecha", "izquierda"])} que requiere caracterización.`, conclusion: "Estudio incompleto. BI-RADS 0. Se sugiere complementar con ecografía mamaria y proyecciones focalizadas." };
    case "1":
      return { tecnica, hallazgos: `${base} No se observan nódulos, distorsiones de la arquitectura ni microcalcificaciones sospechosas.`, conclusion: "Estudio mamográfico sin hallazgos. BI-RADS 1." };
    case "2":
      return { tecnica, hallazgos: `${base} Calcificaciones groseras de tipo vascular en mama ${az.elegir(["derecha", "izquierda"])}. Ganglio intramamario de aspecto habitual.`, conclusion: "Hallazgos benignos. BI-RADS 2. Control anual." };
    case "4":
      return { tecnica, hallazgos: `${base} Nódulo de ${az.entero(8, 18)} mm de márgenes irregulares en cuadrante superoexterno de mama ${az.elegir(["derecha", "izquierda"])}.`, conclusion: "Hallazgo sospechoso. BI-RADS 4. Se sugiere estudio histológico." };
    case "5":
      return { tecnica, hallazgos: `${base} Nódulo espiculado de ${az.entero(15, 30)} mm con microcalcificaciones pleomórficas agrupadas.`, conclusion: "Hallazgo altamente sugestivo de malignidad. BI-RADS 5." };
  }
}

export function densitometria(az: Azar, tLumbar: number, tCadera: number, conclusion?: string): SeccionesClinicas {
  const fmt = (n: number) => n.toFixed(1).replace(".", ",");
  const peor = Math.min(tLumbar, tCadera);
  const auto = peor >= -1 ? "Densidad mineral ósea dentro de parámetros normales." : peor <= -2.5 ? "Osteoporosis." : "Osteopenia.";
  return {
    tecnica: "Densitometría ósea por absorciometría dual de rayos X (DXA) de columna lumbar y cadera izquierda.",
    hallazgos: `Columna lumbar L1-L4: DMO ${az.decimal(0.7, 1.2, 3).toString().replace(".", ",")} g/cm². T-score ${fmt(tLumbar)}. Z-score ${fmt(tLumbar + 0.6)}. Cuello femoral izquierdo: DMO ${az.decimal(0.6, 1.0, 3).toString().replace(".", ",")} g/cm². T-score ${fmt(tCadera)}.`,
    conclusion: conclusion ?? auto,
  };
}

export interface OpcionesEcoAbdominal {
  placeholderVia?: boolean;
  placeholderRinones?: boolean;
  colecistectomizada?: "documentada" | "sin_documentar";
  nefrectomiaDerecha?: "documentada" | "sin_documentar";
  rinonNoEvaluable?: boolean;
}

export function ecografiaAbdominal(az: Azar, o: OpcionesEcoAbdominal = {}): SeccionesClinicas {
  const via = o.placeholderVia ? "xx" : String(az.entero(3, 6));
  const vesicula =
    o.colecistectomizada === "documentada"
      ? "VESÍCULA BILIAR: Ausente por antecedente de colecistectomía (colecistectomizada)."
      : o.colecistectomizada === "sin_documentar"
        ? ""
        : `VESÍCULA BILIAR: De forma ovoidea, pared conservada de ${az.entero(2, 3)} mm de espesor. De contenido líquido homogéneo, alitiásica.`;
  const rd =
    o.nefrectomiaDerecha === "documentada"
      ? "Riñón derecho: ausente, antecedente de nefrectomía derecha."
      : o.nefrectomiaDerecha === "sin_documentar"
        ? "Riñón derecho: sin medidas."
        : o.rinonNoEvaluable
          ? "Riñón derecho: no pudo ser medido adecuadamente por interposición gaseosa."
          : `Riñón derecho: diámetro longitudinal ${o.placeholderRinones ? "xx" : az.entero(95, 120)} mm.`;
  const ri = `Riñón izquierdo: diámetro longitudinal ${o.placeholderRinones ? "xx" : az.entero(95, 120)} mm.`;
  return {
    tecnica: "Ecografía abdominal con transductor convexo multifrecuencia, en ayunas.",
    hallazgos: [
      `HÍGADO: De tamaño normal, ecoestructura homogénea, sin lesiones focales. Lóbulo derecho de ${az.entero(120, 150)} mm.`,
      `VÍA BILIAR: La vía biliar intrahepática y el hepatocolédoco se observan de calibre normal midiendo ${via} mm.`,
      vesicula,
      "PÁNCREAS: Visualizado en cabeza y cuerpo, sin alteraciones.",
      `BAZO: Homogéneo, de ${az.entero(90, 115)} mm.`,
      "RIÑÓN DERECHO E IZQUIERDO: Sin alteraciones morfológicas de significación.",
      rd,
      ri,
      "Aorta abdominal de trayecto y calibre conservado.",
    ]
      .filter(Boolean)
      .join("\n"),
    conclusion: "Ecografía abdominal dentro de parámetros normales.",
  };
}

export function radiografiaTorax(az: Azar): SeccionesClinicas {
  return {
    tecnica: "Radiografía de tórax en proyección frente, en bipedestación.",
    hallazgos: `Campos pulmonares sin infiltrados ni consolidaciones. Senos costofrénicos libres. Silueta cardíaca de tamaño normal con índice cardiotorácico de 0,${az.entero(42, 49)}. Mediastino centrado.`,
    conclusion: "Radiografía de tórax sin alteraciones significativas.",
  };
}

export function seccionesPorTipo(az: Azar, tipo: TipoEstudio): SeccionesClinicas {
  switch (tipo) {
    case "mamografia":
      return mamografia(az, az.elegir(["1", "1", "1", "2", "2", "0", "4"] as const));
    case "densitometria": {
      const t1 = az.decimal(-3.2, 0.8), t2 = az.decimal(-3.0, 0.8);
      return densitometria(az, t1, t2);
    }
    case "ecografia_abdominal":
    case "ecografia_renal":
      return ecografiaAbdominal(az);
    default:
      return radiografiaTorax(az);
  }
}

/** Arma un informe a partir de un turno, copiando el encabezado tal cual (sin errores). */
export function informeDesdeTurno(p: {
  id: string;
  turno: Turno;
  fecha: string;
  secciones: SeccionesClinicas;
  medicoNombre?: string;
  encabezado?: Partial<Informe["encabezado"]>;
  sinFirma?: boolean;
}): Informe {
  return {
    id: p.id,
    turnoId: p.turno.id,
    version: 1,
    tipoEstudio: p.turno.tipoEstudio,
    medicoId: p.turno.medicoId,
    medicoFirmante: p.sinFirma ? "" : `${p.medicoNombre ?? p.turno.medicoId} - M.P. ${1000 + Number(p.turno.medicoId.slice(1))}`,
    fecha: p.fecha,
    encabezado: {
      apellidoNombre: p.turno.apellidoNombre,
      dni: p.turno.dni,
      fechaNacimiento: p.turno.fechaNacimiento,
      tipoEstudio: NOMBRE_ESTUDIO[p.turno.tipoEstudio],
      ...p.encabezado,
    },
    secciones: p.secciones,
    origen: "sintetico",
  };
}
