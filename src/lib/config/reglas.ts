import type { Nivel, TipoEstudio } from "../domain/types";

/**
 * Configuración versionada de reglas (HU18).
 * Cada cambio crea una versión nueva; la vigente es la última con estado "vigente".
 * Los valores marcados como SUPUESTO están pendientes de validación con Calidad / equipo médico.
 */

export type EstadoVersion = "borrador" | "en_revision" | "aprobada" | "vigente" | "retirada";

export interface MetadatosVersion {
  version: string;
  estado: EstadoVersion;
  autor: string;
  aprobadoPor?: string;
  fecha: string;
  vigenteDesde?: string;
  motivo: string;
}

export type CampoObligatorio = "tecnica" | "hallazgos" | "conclusion" | "medicoFirmante";

export interface ConfigReglas extends MetadatosVersion {
  v1: {
    /** Matriz por tipo de estudio. PENDIENTE de aprobación médica: hoy todos los campos para todos. */
    matriz: Record<TipoEstudio, CampoObligatorio[]>;
    /** Nivel por campo faltante. SUPUESTO. */
    nivelPorCampo: Record<CampoObligatorio, Nivel>;
    /** Menos caracteres útiles que esto se considera vacío. */
    minCaracteres: number;
  };
  v2: {
    umbralAdvertencia: number; // ≥ → amarilla
    umbralCritico: number; // ≥ → naranja
    cantidadHistorial: number;
    /** Secciones más cortas que esto no se comparan: frases estándar ("Estudio normal") serían falsos positivos. */
    minPalabras: number;
    tamanoNgrama: number;
    /**
     * SUPUESTO para reducir falsos positivos: si la sección tiene medidas y alguna cambió respecto del informe
     * anterior, el médico actualizó el contenido del paciente y no se alerta. Sin esto, todo informe normal
     * hecho con plantilla daría ≥70%.
     */
    ignorarSiMedidasCambian: boolean;
    /**
     * Textos estándar aprobados por el servicio (por ejemplo, la descripción de una mamografía normal).
     * Usar la plantilla aprobada es lo esperado y no se alerta. PENDIENTE: CDO debe aportar sus plantillas.
     */
    plantillasAprobadas: string[];
  };
  v3b: {
    limiteNormal: number; // T ≥ -1.0 normal
    limiteOsteoporosis: number; // T ≤ -2.5 osteoporosis
    nivelInconsistencia: Nivel;
  };
  v4: {
    nivelUnaDiscrepancia: Nivel;
    nivelVariasDiscrepancias: Nivel;
    nivelSinTurno: Nivel;
  };
  v5: {
    /** Órganos que se espera ver medidos por tipo de estudio. PENDIENTE de validación médica. */
    organos: Partial<Record<TipoEstudio, OrganoEsperado[]>>;
    nivelPlaceholder: Nivel;
    nivelFaltanteSinExplicacion: Nivel;
  };
  v3a: {
    /** SUPUESTO: nivel por resultado del modelo. */
    nivelInconsistente: Nivel;
    nivelIndeterminado: Nivel | null;
  };
}

export interface OrganoEsperado {
  id: string;
  nombre: string;
  /** Expresión para encontrar la mención del órgano en el texto. */
  patron: string;
  lateralidad?: "derecho" | "izquierdo";
  /** Si es true, sin medida numérica ni explicación se alerta. Si es false, alcanza con que esté descrito. */
  requiereMedida: boolean;
}

const TODOS: CampoObligatorio[] = ["tecnica", "hallazgos", "conclusion", "medicoFirmante"];

const ORGANOS_ABDOMEN: OrganoEsperado[] = [
  { id: "higado", nombre: "Hígado", patron: "h[ií]gado", requiereMedida: false },
  { id: "vesicula", nombre: "Vesícula biliar", patron: "ves[ií]cula", requiereMedida: true },
  { id: "via_biliar", nombre: "Vía biliar", patron: "v[ií]a biliar|hepatocol[ée]doco|col[ée]doco", requiereMedida: true },
  { id: "pancreas", nombre: "Páncreas", patron: "p[aá]ncreas", requiereMedida: false },
  { id: "bazo", nombre: "Bazo", patron: "bazo", requiereMedida: false },
  { id: "rinon_der", nombre: "Riñón derecho", patron: "ri[ñn][óo]n derecho", lateralidad: "derecho", requiereMedida: true },
  { id: "rinon_izq", nombre: "Riñón izquierdo", patron: "ri[ñn][óo]n izquierdo", lateralidad: "izquierdo", requiereMedida: true },
];

export const REGLAS_V1_0: ConfigReglas = {
  version: "reglas-1.0.0",
  estado: "vigente",
  autor: "Pablo Vera (consultor)",
  aprobadoPor: "Pendiente: Ma. Julia Napoli (Calidad)",
  fecha: "2026-10-06",
  vigenteDesde: "2026-10-06",
  motivo: "Versión inicial según especificación funcional M06 v1.1. Umbrales y matrices sujetos a validación.",
  v1: {
    matriz: {
      mamografia: TODOS,
      densitometria: TODOS,
      ecografia_abdominal: TODOS,
      ecografia_renal: TODOS,
      ecografia_ginecologica: TODOS,
      radiografia_torax: TODOS,
      tomografia: TODOS,
      resonancia: TODOS,
    },
    nivelPorCampo: { tecnica: "amarilla", hallazgos: "naranja", conclusion: "naranja", medicoFirmante: "naranja" },
    minCaracteres: 10,
  },
  v2: { umbralAdvertencia: 0.7, umbralCritico: 0.9, cantidadHistorial: 10, minPalabras: 12, tamanoNgrama: 3, ignorarSiMedidasCambian: true,
    plantillasAprobadas: [
      "Piel y complejo areola-pezón sin alteraciones. Regiones axilares sin adenomegalias. No se observan nódulos, distorsiones de la arquitectura ni microcalcificaciones sospechosas.",
    ],
  },
  v3b: { limiteNormal: -1.0, limiteOsteoporosis: -2.5, nivelInconsistencia: "naranja" },
  v4: { nivelUnaDiscrepancia: "naranja", nivelVariasDiscrepancias: "roja", nivelSinTurno: "naranja" },
  v5: {
    organos: {
      ecografia_abdominal: ORGANOS_ABDOMEN,
      ecografia_renal: ORGANOS_ABDOMEN.filter((o) => o.id.startsWith("rinon")),
      ecografia_ginecologica: [
        { id: "utero", nombre: "Útero", patron: "[úu]tero", requiereMedida: true },
        { id: "ovario_der", nombre: "Ovario derecho", patron: "ovario derecho", lateralidad: "derecho", requiereMedida: true },
        { id: "ovario_izq", nombre: "Ovario izquierdo", patron: "ovario izquierdo", lateralidad: "izquierdo", requiereMedida: true },
      ],
    },
    nivelPlaceholder: "naranja",
    nivelFaltanteSinExplicacion: "amarilla",
  },
  v3a: { nivelInconsistente: "naranja", nivelIndeterminado: "azul" },
};

/** Historial de versiones de reglas. La primera con estado "vigente" es la que se usa. */
export const HISTORIAL_REGLAS: ConfigReglas[] = [REGLAS_V1_0];

export function reglasVigentes(): ConfigReglas {
  const v = HISTORIAL_REGLAS.find((r) => r.estado === "vigente");
  if (!v) throw new Error("No hay una versión de reglas vigente");
  return v;
}
