import type { CodigoValidacion, Informe, Nivel, Turno, TipoEstudio } from "../domain/types";
import {
  Azar,
  densitometria,
  ecografiaAbdominal,
  informeDesdeTurno,
  mamografia,
  pacienteSintetico,
  radiografiaTorax,
  seccionesPorTipo,
} from "./plantillas";

/**
 * Set de prueba de referencia (HU19), alineado a los criterios de aceptación CA01–CA08.
 * Cada caso declara qué validación debe alertar y con qué nivel, o que no debe alertar (falso positivo).
 * Se ejecuta en cada versión de reglas o prompts; el resultado queda como evidencia de verificación.
 */

export type Criterio = "CA01" | "CA02" | "CA03" | "CA04" | "CA07" | "CA08";

export const DESCRIPCION_CRITERIO: Record<Criterio, string> = {
  CA01: "V4 detecta errores de DNI y nombre en el 100% de los casos",
  CA02: "V1 no genera falsos positivos en informes completos, para cada tipo de estudio",
  CA03: "V2 alerta cuando la similitud es ≥ 70%",
  CA04: "V3A alerta en el 100% de los casos BI-RADS inconsistentes",
  CA07: "V3B alerta cuando la conclusión no coincide con el rango de T-score (propuesto)",
  CA08: "V5 alerta medidas faltantes sin explicación y no alerta ausencias documentadas (propuesto)",
};

export interface CasoPrueba {
  id: string;
  criterio: Criterio;
  descripcion: string;
  informe: Informe;
  turno?: Turno;
  historial: Informe[];
  esperado: { validacion: CodigoValidacion; nivel: Nivel | null };
}

const az = new Azar(20261006);
let n = 0;
const FECHA = "2026-10-01T10:00:00.000Z";

function nuevoTurno(tipo: TipoEstudio, medicoId = "M01"): Turno {
  n++;
  return { id: `T-PR-${String(n).padStart(4, "0")}`, tipoEstudio: tipo, medicoId, ...pacienteSintetico(az) };
}

function caso(
  criterio: Criterio,
  descripcion: string,
  esperado: CasoPrueba["esperado"],
  armar: (t: Turno) => Partial<Pick<CasoPrueba, "historial">> & { informe: Informe; turno?: Turno | null },
  tipo: TipoEstudio,
): CasoPrueba {
  const t = nuevoTurno(tipo);
  const r = armar(t);
  return {
    id: `${criterio}-${String(n).padStart(3, "0")}`,
    criterio,
    descripcion,
    informe: r.informe,
    turno: r.turno === null ? undefined : (r.turno ?? t),
    historial: r.historial ?? [],
    esperado,
  };
}

const inf = (t: Turno, secciones = seccionesPorTipo(az, t.tipoEstudio), extra: Partial<Parameters<typeof informeDesdeTurno>[0]> = {}) =>
  informeDesdeTurno({ id: `INF-${t.id}`, turno: t, fecha: FECHA, secciones, ...extra });

// ---------- CA01: identidad (20 casos) ----------
const errDni = (dni: string) => dni.replace(/\d(?=\D*$)/, (d) => String((Number(d) + 1) % 10));
const errNombre = (nom: string) => nom.replace(/([aeiou])(?!.*[aeiou])/i, "x");
const errFecha = (f: string) => f.replace(/^(\d{2})/, (d) => String(((Number(d) % 28) + 1)).padStart(2, "0"));

const ca01: CasoPrueba[] = [];
for (let i = 0; i < 6; i++)
  ca01.push(caso("CA01", "DNI con un dígito distinto", { validacion: "V4", nivel: "naranja" }, (t) => ({ informe: inf(t, undefined, { encabezado: { dni: errDni(t.dni) } }) }), "radiografia_torax"));
for (let i = 0; i < 5; i++)
  ca01.push(caso("CA01", "Nombre con una letra distinta", { validacion: "V4", nivel: "naranja" }, (t) => ({ informe: inf(t, undefined, { encabezado: { apellidoNombre: errNombre(t.apellidoNombre) } }) }), "mamografia"));
for (let i = 0; i < 4; i++)
  ca01.push(caso("CA01", "DNI y nombre distintos (otro paciente)", { validacion: "V4", nivel: "roja" }, (t) => ({ informe: inf(t, undefined, { encabezado: { dni: errDni(t.dni), apellidoNombre: errNombre(t.apellidoNombre) } }) }), "ecografia_abdominal"));
ca01.push(caso("CA01", "Fecha de nacimiento distinta", { validacion: "V4", nivel: "naranja" }, (t) => ({ informe: inf(t, undefined, { encabezado: { fechaNacimiento: errFecha(t.fechaNacimiento) } }) }), "densitometria"));
ca01.push(caso("CA01", "Tipo de estudio distinto al agendado", { validacion: "V4", nivel: "naranja" }, (t) => ({ informe: inf(t, undefined, { encabezado: { tipoEstudio: "Ecografía renal" } }) }), "radiografia_torax"));
ca01.push(caso("CA01", "Tres datos distintos", { validacion: "V4", nivel: "roja" }, (t) => ({ informe: inf(t, undefined, { encabezado: { dni: errDni(t.dni), fechaNacimiento: errFecha(t.fechaNacimiento), tipoEstudio: "Mamografía" } }) }), "radiografia_torax"));
ca01.push(caso("CA01", "Sin falso positivo: DNI sin puntos, nombre en otro orden y sin tildes", { validacion: "V4", nivel: null }, (t) => {
  const [ap, nom] = t.apellidoNombre.split(", ");
  return { informe: inf(t, undefined, { encabezado: { dni: t.dni.replace(/\./g, ""), apellidoNombre: `${nom} ${ap}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() } }) };
}, "mamografia"));
ca01.push(caso("CA01", "Sin falso positivo: fecha en formato aaaa-mm-dd", { validacion: "V4", nivel: null }, (t) => {
  const [d, m, y] = t.fechaNacimiento.split("/");
  return { informe: inf(t, undefined, { encabezado: { fechaNacimiento: `${y}-${m}-${d}` } }) };
}, "densitometria"));

// ---------- CA02: campos obligatorios ----------
const tiposCa02: TipoEstudio[] = ["mamografia", "densitometria", "ecografia_abdominal", "radiografia_torax"];
const ca02: CasoPrueba[] = tiposCa02.map((tipo) =>
  caso("CA02", `Informe completo de ${tipo}: no debe alertar V1`, { validacion: "V1", nivel: null }, (t) => ({ informe: inf(t) }), tipo),
);
ca02.push(caso("CA02", "Conclusión vacía", { validacion: "V1", nivel: "naranja" }, (t) => ({ informe: inf(t, { ...radiografiaTorax(az), conclusion: "" }) }), "radiografia_torax"));
ca02.push(caso("CA02", "Técnica solo con marcadores", { validacion: "V1", nivel: "amarilla" }, (t) => ({ informe: inf(t, { ...radiografiaTorax(az), tecnica: "xx" }) }), "radiografia_torax"));
ca02.push(caso("CA02", "Sin médico firmante", { validacion: "V1", nivel: "naranja" }, (t) => ({ informe: inf(t, undefined, { sinFirma: true }) }), "mamografia"));

// ---------- CA03: duplicados ----------
function historialDe(t: Turno, secciones: ReturnType<typeof seccionesPorTipo>, k: number): Informe[] {
  return Array.from({ length: k }, (_, i) => {
    const tt: Turno = { ...t, id: `${t.id}-H${i}`, ...pacienteSintetico(az) };
    return informeDesdeTurno({ id: `INF-${tt.id}`, turno: tt, fecha: `2026-09-${String(20 - i).padStart(2, "0")}T10:00:00.000Z`, secciones: i === 0 ? secciones : seccionesPorTipo(az, t.tipoEstudio) });
  });
}
const textoLargo = "Se observa imagen nodular hipoecoica de bordes definidos en lóbulo tiroideo derecho, con vascularización periférica al Doppler color, sin calcificaciones en su interior. Istmo de espesor conservado.";
const ca03: CasoPrueba[] = [
  caso("CA03", "Hallazgos copiados textualmente (100%)", { validacion: "V2", nivel: "naranja" }, (t) => {
    const s = { ...radiografiaTorax(az), hallazgos: textoLargo };
    return { informe: inf(t, s), historial: historialDe(t, s, 5) };
  }, "radiografia_torax"),
  caso("CA03", "Hallazgos copiados con un cambio menor (~75%)", { validacion: "V2", nivel: "amarilla" }, (t) => {
    const s = { ...radiografiaTorax(az), hallazgos: textoLargo };
    const mod = { ...s, hallazgos: textoLargo.replace("en lóbulo tiroideo derecho, con vascularización", "en lóbulo tiroideo izquierdo y adenopatía, con vascularización").replace("Istmo de espesor conservado", "Istmo engrosado") };
    return { informe: inf(t, mod), historial: historialDe(t, s, 5) };
  }, "radiografia_torax"),
  caso("CA03", "Sin falso positivo: informe normal con plantilla y medidas actualizadas", { validacion: "V2", nivel: null }, (t) => ({
    informe: inf(t, ecografiaAbdominal(az)),
    historial: historialDe(t, ecografiaAbdominal(az), 10),
  }), "ecografia_abdominal"),
  caso("CA03", "Sin falso positivo: conclusión estándar corta", { validacion: "V2", nivel: null }, (t) => {
    const s = radiografiaTorax(az);
    return { informe: inf(t, { ...s, hallazgos: textoLargo + " Paciente " + t.id }), historial: historialDe(t, { ...s, hallazgos: "Texto diferente sin relación alguna con el actual para descartar coincidencias en hallazgos." }, 3) };
  }, "radiografia_torax"),
];

// ---------- CA04: BI-RADS (10 casos) ----------
const ca04: CasoPrueba[] = [
  caso("CA04", "BI-RADS 0 sin estudio adicional", { validacion: "V3A", nivel: "naranja" }, (t) => ({ informe: inf(t, { ...mamografia(az, "0"), conclusion: "Estudio incompleto. BI-RADS 0." }) }), "mamografia"),
  caso("CA04", "BI-RADS 1 con nódulo descrito", { validacion: "V3A", nivel: "naranja" }, (t) => ({ informe: inf(t, { ...mamografia(az, "4"), conclusion: "Estudio mamográfico sin hallazgos. BI-RADS 1." }) }), "mamografia"),
  caso("CA04", "BI-RADS 1 con calcificaciones descritas", { validacion: "V3A", nivel: "naranja" }, (t) => ({ informe: inf(t, { ...mamografia(az, "2"), conclusion: "BI-RADS 1. Control anual." }) }), "mamografia"),
  caso("CA04", "BI-RADS 2 con nódulo espiculado", { validacion: "V3A", nivel: "naranja" }, (t) => ({ informe: inf(t, { ...mamografia(az, "5"), conclusion: "Hallazgos benignos. BI-RADS 2." }) }), "mamografia"),
  caso("CA04", "BI-RADS 4 con hallazgos normales", { validacion: "V3A", nivel: "naranja" }, (t) => ({ informe: inf(t, { ...mamografia(az, "1"), conclusion: "Hallazgo sospechoso. BI-RADS 4." }) }), "mamografia"),
  caso("CA04", "BI-RADS 5 con hallazgos normales", { validacion: "V3A", nivel: "naranja" }, (t) => ({ informe: inf(t, { ...mamografia(az, "1"), conclusion: "BI-RADS 5." }) }), "mamografia"),
  caso("CA04", "Consistente: BI-RADS 1 normal", { validacion: "V3A", nivel: null }, (t) => ({ informe: inf(t, mamografia(az, "1")) }), "mamografia"),
  caso("CA04", "Consistente: BI-RADS 0 con ecografía sugerida", { validacion: "V3A", nivel: null }, (t) => ({ informe: inf(t, mamografia(az, "0")) }), "mamografia"),
  caso("CA04", "Consistente: BI-RADS 2 benigno", { validacion: "V3A", nivel: null }, (t) => ({ informe: inf(t, mamografia(az, "2")) }), "mamografia"),
  caso("CA04", "Consistente: BI-RADS 4 con nódulo irregular", { validacion: "V3A", nivel: null }, (t) => ({ informe: inf(t, mamografia(az, "4")) }), "mamografia"),
];

// ---------- CA07: densitometría (incluye valores límite) ----------
const d = (desc: string, t1: number, t2: number, concl: string, nivel: Nivel | null) =>
  caso("CA07", desc, { validacion: "V3B", nivel }, (t) => ({ informe: inf(t, densitometria(az, t1, t2, concl)) }), "densitometria");
const ca07: CasoPrueba[] = [
  d("T -2,8 informado como osteopenia", -2.8, -1.9, "Osteopenia.", "naranja"),
  d("T -1,6 informado como normal", -1.6, -0.4, "Densidad mineral ósea dentro de parámetros normales.", "naranja"),
  d("T -0,5 informado como osteoporosis", -0.5, -0.2, "Osteoporosis.", "naranja"),
  d("Límite: T -2,5 es osteoporosis", -2.5, -1.2, "Osteoporosis.", null),
  d("Límite: T -1,0 es normal", -1.0, 0.3, "Densidad mineral ósea dentro de parámetros normales.", null),
  d("Usa el valor más bajo: cadera -2,6", -1.4, -2.6, "Osteoporosis en cuello femoral. Osteopenia lumbar.", null),
  d("Negación: 'sin osteoporosis' con T -1,8", -1.8, -1.2, "Osteopenia, sin criterios de osteoporosis.", null),
  d("Conclusión sin clasificación", -2.0, -1.5, "Se sugiere control en 2 años.", "naranja"),
];

// ---------- CA08: órgano ausente y medidas ----------
const e = (desc: string, o: Parameters<typeof ecografiaAbdominal>[1], nivel: Nivel | null) =>
  caso("CA08", desc, { validacion: "V5", nivel }, (t) => ({ informe: inf(t, ecografiaAbdominal(az, o)) }), "ecografia_abdominal");
const ca08: CasoPrueba[] = [
  e("Vía biliar con 'xx mm'", { placeholderVia: true }, "naranja"),
  e("Riñones con 'xx mm'", { placeholderRinones: true }, "naranja"),
  e("Riñón derecho 'sin medidas' sin explicación", { nefrectomiaDerecha: "sin_documentar" }, "amarilla"),
  e("Vesícula no mencionada ni documentada", { colecistectomizada: "sin_documentar" }, "amarilla"),
  e("Sin falso positivo: nefrectomía documentada", { nefrectomiaDerecha: "documentada" }, null),
  e("Sin falso positivo: colecistectomía documentada", { colecistectomizada: "documentada" }, null),
  e("Sin falso positivo: riñón no evaluable con explicación", { rinonNoEvaluable: true }, null),
  e("Sin falso positivo: informe completo", {}, null),
];

export const CASOS_PRUEBA: CasoPrueba[] = [...ca01, ...ca02, ...ca03, ...ca04, ...ca07, ...ca08];
