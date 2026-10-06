// Tipos de dominio del M06. Todo el motor trabaja sobre estas estructuras,
// sin importar si el informe viene de Google Drive (etapa 1) o de la API
// del sistema de gestión de imágenes (etapa 2).

export const TIPOS_ESTUDIO = [
  "mamografia",
  "densitometria",
  "ecografia_abdominal",
  "ecografia_renal",
  "ecografia_ginecologica",
  "radiografia_torax",
  "tomografia",
  "resonancia",
] as const;
export type TipoEstudio = (typeof TIPOS_ESTUDIO)[number];

export const NOMBRE_ESTUDIO: Record<TipoEstudio, string> = {
  mamografia: "Mamografía",
  densitometria: "Densitometría ósea",
  ecografia_abdominal: "Ecografía abdominal",
  ecografia_renal: "Ecografía renal",
  ecografia_ginecologica: "Ecografía ginecológica",
  radiografia_torax: "Radiografía de tórax",
  tomografia: "Tomografía",
  resonancia: "Resonancia magnética",
};

/** Secciones clínicas del informe. Son lo único que puede enviarse a un modelo de IA. */
export interface SeccionesClinicas {
  tecnica?: string;
  hallazgos?: string;
  conclusion?: string;
}
export type NombreSeccion = keyof SeccionesClinicas | "encabezado" | "firma";

/** Datos identificatorios del encabezado. Nunca salen del motor determinístico. */
export interface EncabezadoPaciente {
  apellidoNombre?: string;
  dni?: string;
  fechaNacimiento?: string;
  tipoEstudio?: string;
}

export interface Informe {
  id: string;
  /** Identificador del turno en el sistema de origen (Visual Medica). */
  turnoId: string;
  /** Versión del informe: una corrección genera una versión nueva (HU27). */
  version: number;
  informeAnteriorId?: string;
  tipoEstudio: TipoEstudio;
  medicoId: string;
  medicoFirmante?: string;
  fecha: string; // ISO
  encabezado: EncabezadoPaciente;
  secciones: SeccionesClinicas;
  origen: "drive" | "api" | "sintetico";
  archivo?: string;
}

/** Registro del turno en el sistema de origen. */
export interface Turno {
  id: string;
  apellidoNombre: string;
  dni: string;
  fechaNacimiento: string;
  tipoEstudio: TipoEstudio;
  medicoId: string;
}

export interface Medico {
  id: string;
  nombre: string;
}

export const VALIDACIONES = ["V1", "V2", "V3A", "V3B", "V4", "V5"] as const;
export type CodigoValidacion = (typeof VALIDACIONES)[number];

export const NOMBRE_VALIDACION: Record<CodigoValidacion, string> = {
  V1: "Campos obligatorios",
  V2: "Contenido duplicado",
  V3A: "Consistencia BI-RADS",
  V3B: "Consistencia densitometría",
  V4: "Identidad del paciente",
  V5: "Órgano ausente / medidas",
};

export const NIVELES = ["azul", "amarilla", "naranja", "roja"] as const;
export type Nivel = (typeof NIVELES)[number];

export const NOMBRE_NIVEL: Record<Nivel, string> = {
  azul: "Informativa",
  amarilla: "Advertencia",
  naranja: "Crítica",
  roja: "Bloqueante (con override)",
};

export interface Evidencia {
  seccion: NombreSeccion;
  fragmento: string;
}

export type EstadoAlerta =
  | "pendiente"
  | "revisada" // tildó "revisado" (amarilla) o tomó conocimiento
  | "override" // firmó igual con justificación (roja / naranja)
  | "marcada_incorrecta" // el médico indica falso positivo (HU16)
  | "resuelta"; // se corrigió el informe y la nueva versión ya no la genera

export interface Alerta {
  id: string;
  informeId: string;
  validacion: CodigoValidacion;
  nivel: Nivel;
  /** Qué detectó, en una línea. */
  titulo: string;
  /** Por qué es un problema y qué revisar. */
  detalle: string;
  /** Dónde: secciones y fragmentos textuales. */
  evidencia: Evidencia[];
  /** Versión de reglas y, si aplica, de prompt que la produjo (HU18). */
  versionReglas: string;
  versionPrompt?: string;
  estado: EstadoAlerta;
  justificacion?: string;
  motivoIncorrecta?: string;
}

export type EstadoEjecucion = "ejecutada" | "no_ejecutada" | "no_aplica";

/** Traza de lo enviado a un modelo de IA (HU23). */
export interface TrazaLlm {
  proveedor: string;
  modelo: string;
  versionPrompt: string;
  seccionesEnviadas: (keyof SeccionesClinicas)[];
  camposIdentificatoriosEnviados: false;
  hashEntrada: string;
  duracionMs: number;
}

export interface ResultadoValidacion {
  validacion: CodigoValidacion;
  estado: EstadoEjecucion;
  motivo?: string;
  alertas: Alerta[];
  traza?: TrazaLlm;
}

export interface ResultadoInforme {
  informeId: string;
  fecha: string;
  versionReglas: string;
  resultados: ResultadoValidacion[];
  alertas: Alerta[];
  /** Nivel más alto encontrado, o null si no hay alertas. */
  nivelMaximo: Nivel | null;
  /** true si alguna validación aplicable no pudo ejecutarse (HU21). */
  incompleto: boolean;
}

/** Contexto que el motor necesita además del informe. */
export interface ContextoValidacion {
  turno?: Turno;
  /** Informes previos del mismo médico y tipo de estudio, más reciente primero. */
  historial: Informe[];
}
