import { LogAuditoria } from "../audit/log";
import { reglasVigentes } from "../config/reglas";
import type { Alerta, EstadoAlerta, Informe, ResultadoInforme, TipoEstudio, Turno } from "../domain/types";
import { validarInforme } from "../engine/motor";
import { Azar, densitometria, ecografiaAbdominal, informeDesdeTurno, mamografia, MEDICOS, pacienteSintetico, seccionesPorTipo } from "./plantillas";

/**
 * Dataset SINTÉTICO de demostración: 90 días de operación simulada.
 * Los informes se generan con errores inyectados a tasas distintas por médico, se validan con el motor real
 * y luego se simula la respuesta del médico. Sirve para mostrar el panel de Calidad mientras no hay datos reales.
 */

export interface InformeDemo {
  informe: Informe;
  turno: Turno;
  resultado: ResultadoInforme;
  /** Alertas con el estado final luego de la acción simulada del médico. */
  alertas: Alerta[];
  firmado: boolean;
  segundosHastaFirma: number;
}

export interface MuestraAuditoria {
  alertaId: string;
  validacion: Alerta["validacion"];
  correcta: boolean;
  overrideApropiado?: boolean;
}

export interface Debito {
  mes: string; // aaaa-mm
  causaInforme: number;
  causaOtra: number;
  montoInforme: number;
}

export interface AccionCorrectiva {
  id: string;
  fecha: string;
  patron: string;
  accion: string;
  responsable: string;
  estado: "abierta" | "en_curso" | "cerrada";
}

export interface DatasetDemo {
  desde: string;
  hasta: string;
  informes: InformeDemo[];
  auditoria: MuestraAuditoria[];
  debitos: Debito[];
  acciones: AccionCorrectiva[];
  log: LogAuditoria;
  /** Fecha de la capacitación simulada, para anotar en los gráficos. */
  intervenciones: { fecha: string; texto: string }[];
}

const DIAS = 90;
const POR_DIA = 40;
const MEZCLA: TipoEstudio[] = ["mamografia", "mamografia", "densitometria", "ecografia_abdominal", "ecografia_abdominal", "ecografia_renal", "radiografia_torax", "radiografia_torax"];

/** Propensión a errores por médico (1 = promedio). Algunos médicos quedan fuera de los límites a propósito. */
function propension(medicoId: string): number {
  const n = Number(medicoId.slice(1));
  if (n === 7) return 3.2;
  if (n === 15) return 2.4;
  if (n === 3 || n === 19) return 0.4;
  return 0.8 + ((n * 37) % 10) / 20;
}

function inyectarError(az: Azar, t: Turno, informe: Informe, factor: number): Informe {
  const p = (base: number) => az.sig() < base * factor;
  const enc = { ...informe.encabezado };
  if (p(0.012)) enc.dni = enc.dni?.replace(/\d$/, (d) => String((Number(d) + 3) % 10));
  if (p(0.006)) enc.apellidoNombre = enc.apellidoNombre?.replace(/[aeiou](?=[^aeiou]*$)/i, "e");
  let s = { ...informe.secciones };
  if (p(0.02)) s = { ...s, conclusion: "" };
  if (p(0.015)) s = { ...s, tecnica: "xx" };
  if (t.tipoEstudio === "mamografia" && p(0.05)) s = { ...mamografia(az, "1"), conclusion: "Hallazgo sospechoso. BI-RADS 4." };
  if (t.tipoEstudio === "mamografia" && p(0.03)) s = { ...mamografia(az, "4"), conclusion: "Estudio sin hallazgos. BI-RADS 1." };
  if (t.tipoEstudio === "densitometria" && p(0.08)) s = densitometria(az, az.decimal(-3, -2.6), az.decimal(-2, -1.2), "Osteopenia.");
  if ((t.tipoEstudio === "ecografia_abdominal" || t.tipoEstudio === "ecografia_renal") && p(0.05)) s = ecografiaAbdominal(az, { placeholderVia: true });
  if ((t.tipoEstudio === "ecografia_abdominal" || t.tipoEstudio === "ecografia_renal") && p(0.025)) s = ecografiaAbdominal(az, { nefrectomiaDerecha: "sin_documentar" });
  return { ...informe, encabezado: enc, secciones: s };
}

function accionMedico(az: Azar, a: Alerta, correccionPosible: boolean): { estado: EstadoAlerta; justificacion?: string; motivo?: string } {
  const r = az.sig();
  // Simulación de una alerta poco precisa en V3A: más overrides y marcas de "incorrecta".
  const fp = a.validacion === "V3A" ? 0.18 : a.validacion === "V2" ? 0.12 : 0.04;
  if (r < fp) return { estado: "marcada_incorrecta", motivo: az.elegir(["El hallazgo está justificado en el texto", "La categoría es correcta", "Es la descripción estándar del servicio"]) };
  if (a.nivel === "azul") return { estado: "revisada" };
  if (a.nivel === "amarilla") return az.sig() < 0.94 ? { estado: correccionPosible && az.sig() < 0.5 ? "resuelta" : "revisada" } : { estado: "pendiente" };
  if (a.nivel === "roja") return az.sig() < 0.85 ? { estado: "resuelta" } : { estado: "override", justificacion: "Datos verificados con el paciente en recepción; error en el turno." };
  return az.sig() < 0.72 ? { estado: "resuelta" } : { estado: "override", justificacion: az.elegir(["Revisado, se mantiene el criterio del informante", "Dato confirmado con estudio previo", "Paciente con antecedente informado verbalmente"]) };
}

let cache: Promise<DatasetDemo> | null = null;

export function datasetDemo(): Promise<DatasetDemo> {
  cache ??= construir();
  return cache;
}

async function construir(): Promise<DatasetDemo> {
  const az = new Azar(4242);
  const reglas = reglasVigentes();
  const log = new LogAuditoria();
  const hasta = new Date("2026-10-05T00:00:00.000Z");
  const desde = new Date(hasta.getTime() - (DIAS - 1) * 86400000);
  const historial = new Map<string, Informe[]>();
  const informes: InformeDemo[] = [];
  let k = 0;

  for (let d = 0; d < DIAS; d++) {
    const dia = new Date(desde.getTime() + d * 86400000);
    if (dia.getUTCDay() === 0) continue; // domingos sin actividad
    // Mejora luego de la capacitación del día 45.
    const tendencia = d < 45 ? 1.25 : 0.75;
    const n = dia.getUTCDay() === 6 ? Math.round(POR_DIA * 0.4) : POR_DIA;
    for (let i = 0; i < n; i++) {
      k++;
      const medico = az.elegir(MEDICOS);
      const tipo = az.elegir(MEZCLA);
      const turno: Turno = { id: `T-${String(k).padStart(6, "0")}`, tipoEstudio: tipo, medicoId: medico.id, ...pacienteSintetico(az) };
      const fecha = new Date(dia.getTime() + (8 * 3600 + az.entero(0, 10 * 3600)) * 1000).toISOString();
      let informe = informeDesdeTurno({ id: `INF-${turno.id}`, turno, fecha, secciones: seccionesPorTipo(az, tipo), medicoNombre: medico.nombre });
      informe = inyectarError(az, turno, informe, propension(medico.id) * tendencia);
      // Copia de un informe previo (V2) con baja frecuencia.
      const clave = `${medico.id}|${tipo}`;
      const previos = historial.get(clave) ?? [];
      if (previos.length && az.sig() < 0.015 * propension(medico.id) * tendencia) {
        informe = { ...informe, secciones: { ...informe.secciones, hallazgos: previos[0].secciones.hallazgos, conclusion: previos[0].secciones.conclusion } };
      }
      const resultado = await validarInforme(informe, { turno, historial: previos }, { reglas, ahora: new Date(fecha) });
      historial.set(clave, [informe, ...previos].slice(0, 10));

      log.registrar({ fecha, tipo: "validacion_ejecutada", actor: "motor", informeId: informe.id, datos: { versionReglas: reglas.version, alertas: resultado.alertas.length } });
      for (const r of resultado.resultados.filter((x) => x.estado === "no_ejecutada"))
        log.registrar({ fecha, tipo: "validacion_no_ejecutada", actor: "motor", informeId: informe.id, datos: { validacion: r.validacion, motivo: r.motivo } });

      const alertas = resultado.alertas.map((a) => {
        log.registrar({ fecha, tipo: "alerta_generada", actor: "motor", informeId: informe.id, datos: { alertaId: a.id, validacion: a.validacion, nivel: a.nivel, versionPrompt: a.versionPrompt ?? null } });
        const acc = accionMedico(az, a, a.validacion !== "V4" || a.nivel !== "azul");
        const tipoEv = acc.estado === "override" ? "alerta_override" : acc.estado === "marcada_incorrecta" ? "alerta_marcada_incorrecta" : acc.estado === "resuelta" ? "informe_corregido" : acc.estado === "revisada" ? "alerta_revisada" : null;
        if (tipoEv) log.registrar({ fecha, tipo: tipoEv, actor: medico.id, informeId: informe.id, datos: { alertaId: a.id, justificacion: acc.justificacion ?? null, motivo: acc.motivo ?? null } });
        return { ...a, estado: acc.estado, justificacion: acc.justificacion, motivoIncorrecta: acc.motivo };
      });
      const segundos = alertas.length ? az.entero(15, 40) + alertas.length * az.entero(20, 75) : az.entero(5, 25);
      log.registrar({ fecha, tipo: "informe_firmado", actor: medico.id, informeId: informe.id, datos: { segundosDesdeValidacion: segundos } });
      informes.push({ informe, turno, resultado, alertas, firmado: true, segundosHastaFirma: segundos });
    }
  }

  // Auditoría por muestreo de Calidad (HU17): 10% de las alertas.
  const auditoria: MuestraAuditoria[] = [];
  for (const x of informes)
    for (const a of x.alertas) {
      if (az.sig() > 0.1) continue;
      const pFalso = a.validacion === "V3A" ? 0.3 : a.validacion === "V2" ? 0.2 : a.validacion === "V5" ? 0.12 : 0.04;
      const correcta = a.estado === "marcada_incorrecta" ? az.sig() < 0.3 : az.sig() > pFalso;
      auditoria.push({ alertaId: a.id, validacion: a.validacion, correcta, overrideApropiado: a.estado === "override" ? az.sig() < 0.85 : undefined });
      log.registrar({ fecha: x.informe.fecha, tipo: "auditoria_muestra", actor: "Calidad", informeId: x.informe.id, datos: { alertaId: a.id, correcta } });
    }

  const meses = [...new Set(informes.map((x) => x.informe.fecha.slice(0, 7)))].sort();
  const debitos: Debito[] = meses.map((mes, i) => {
    const causaInforme = Math.max(0, Math.round(14 - i * 4 + az.entero(-2, 2)));
    return { mes, causaInforme, causaOtra: az.entero(18, 26), montoInforme: causaInforme * az.entero(38000, 52000) };
  });

  return {
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    informes,
    auditoria,
    debitos,
    acciones: [
      { id: "AC-001", fecha: "2026-08-21", patron: "V3B: conclusión de densitometría no coincide con T-score (Médico 07)", accion: "Capacitación sobre criterio de clasificación y uso de la plantilla de conclusión", responsable: "Ma. Julia Napoli", estado: "cerrada" },
      { id: "AC-002", fecha: "2026-09-02", patron: "V5: medidas 'xx mm' en ecografía abdominal", accion: "Revisar plantillas de dictado para que no tengan valores por defecto", responsable: "Noelia Sancasani", estado: "en_curso" },
      { id: "AC-003", fecha: "2026-09-28", patron: "V3A: 18% de alertas marcadas como incorrectas", accion: "Revisar el prompt V3A con el Dr. Orellano y ampliar el set de prueba", responsable: "Pablo Vera", estado: "abierta" },
    ],
    log,
    intervenciones: [{ fecha: new Date(desde.getTime() + 45 * 86400000).toISOString().slice(0, 10), texto: "Capacitación AC-001" }],
  };
}
