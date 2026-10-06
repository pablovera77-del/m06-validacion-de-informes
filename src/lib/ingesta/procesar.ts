import "server-only";
import { normalizarTipoEstudio } from "../domain/normalize";
import type { Informe, ResultadoInforme, Turno } from "../domain/types";
import { validarInforme } from "../engine/motor";
import { sha256 } from "../engine/util";
import { exigirDb } from "../db/cliente";
import {
  archivoYaProcesado,
  guardarInformeValidado,
  historialMedico,
  informeVigenteDelTurno,
  obtenerTurno,
  registrarArchivo,
  registrarEvento,
} from "../db/repositorio";
import { leerInforme } from "./parser";
import { textoDePdf } from "./pdf";

export interface ResultadoProceso {
  archivo: string;
  estado: "procesado" | "error" | "ignorado";
  informeId?: string;
  version?: number;
  nivelMaximo?: string | null;
  alertas?: number;
  advertencias: string[];
  error?: string;
}

/**
 * Procesa un informe PDF: lee el texto, identifica el turno, valida y guarda el resultado.
 * Si el turno ya tenía un informe, el nuevo es una versión corregida (HU27): se vinculan y las alertas
 * anteriores que ya no aparecen quedan como «resueltas».
 * Nunca modifica el archivo original.
 */
export async function procesarPdf(p: {
  datos: Uint8Array;
  nombre: string;
  origen: "drive" | "carga_manual";
  idArchivo?: string;
  modificadoEn?: string;
  actor: string;
}): Promise<ResultadoProceso> {
  const hashArchivo = sha256(Buffer.from(p.datos).toString("base64"));
  const idArchivo = p.idArchivo ?? `manual-${hashArchivo.slice(0, 24)}`;
  const base = { archivo: p.nombre, advertencias: [] as string[] };

  if (await archivoYaProcesado(idArchivo, p.modificadoEn)) return { ...base, estado: "ignorado", error: "Ya procesado (sin cambios)" };

  try {
    const texto = await textoDePdf(p.datos);
    if (texto.replace(/\s/g, "").length < 40) throw new Error("El PDF no tiene texto legible (¿escaneado?). La lectura por OCR está fuera de alcance de esta etapa.");
    const leido = leerInforme(texto);
    base.advertencias.push(...leido.advertencias);

    const turnoId = leido.turnoId ?? /(?:T-)?\d{6,}/i.exec(p.nombre)?.[0];
    if (!turnoId) throw new Error("No se encontró el número de turno ni en el PDF ni en el nombre del archivo");
    const turno: Turno | undefined = await obtenerTurno(turnoId);
    if (!turno) base.advertencias.push(`El turno ${turnoId} no está en la planilla de turnos: V4 alertará «turno no encontrado»`);
    const tipoEstudio = turno?.tipoEstudio ?? normalizarTipoEstudio(leido.encabezado.tipoEstudio);
    if (!tipoEstudio) throw new Error(`No se pudo determinar el tipo de estudio («${leido.encabezado.tipoEstudio ?? "vacío"}»)`);
    const medicoId = turno?.medicoId ?? "sin_asignar";

    const previo = await informeVigenteDelTurno(turnoId);
    const version = previo ? previo.version + 1 : 1;
    const informe: Informe = {
      id: `${turnoId}-v${version}`,
      turnoId,
      version,
      informeAnteriorId: previo?.id,
      tipoEstudio,
      medicoId,
      medicoFirmante: leido.medicoFirmante,
      fecha: p.modificadoEn ?? new Date().toISOString(),
      encabezado: leido.encabezado,
      secciones: leido.secciones,
      origen: p.origen,
      archivo: p.nombre,
    };

    const historial = await historialMedico(medicoId, tipoEstudio, turnoId);
    const r: ResultadoInforme = await validarInforme(informe, { turno, historial });
    await guardarInformeValidado(informe, r, { archivoDriveId: p.origen === "drive" ? idArchivo : undefined, hashArchivo });

    // Log sin datos identificatorios del paciente.
    await registrarEvento({ tipo: "validacion_ejecutada", actor: "motor", informeId: informe.id, datos: { versionReglas: r.versionReglas, alertas: r.alertas.length, archivo: p.nombre, advertenciasLectura: base.advertencias.length } });
    for (const a of r.alertas)
      await registrarEvento({ tipo: "alerta_generada", actor: "motor", informeId: informe.id, datos: { alertaClave: a.id, validacion: a.validacion, nivel: a.nivel, versionPrompt: a.versionPrompt ?? null } });
    for (const x of r.resultados.filter((y) => y.estado === "no_ejecutada"))
      await registrarEvento({ tipo: "validacion_no_ejecutada", actor: "motor", informeId: informe.id, datos: { validacion: x.validacion, motivo: x.motivo ?? null } });

    if (previo) {
      const nuevas = new Set(r.alertas.map((a) => a.id));
      const { data: anteriores } = await exigirDb().from("m06_alertas").select("id, alerta_clave, estado").eq("informe_id", previo.id);
      const resueltas = (anteriores ?? []).filter((a) => a.estado === "pendiente" && !nuevas.has(a.alerta_clave)).map((a) => a.id);
      if (resueltas.length) await exigirDb().from("m06_alertas").update({ estado: "resuelta", actualizado_por: "motor", actualizado_en: new Date().toISOString() }).in("id", resueltas);
      await registrarEvento({ tipo: "informe_corregido", actor: p.actor, informeId: informe.id, datos: { informeAnterior: previo.id, alertasResueltas: resueltas.length } });
    }

    await registrarArchivo({ id: idArchivo, nombre: p.nombre, origen: p.origen, modificadoEn: p.modificadoEn, informeId: informe.id, estado: "procesado", error: base.advertencias.join(" · ") || undefined });
    return { ...base, estado: "procesado", informeId: informe.id, version, nivelMaximo: r.nivelMaximo, alertas: r.alertas.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await registrarArchivo({ id: idArchivo, nombre: p.nombre, origen: p.origen, modificadoEn: p.modificadoEn, estado: "error", error }).catch(() => {});
    return { ...base, estado: "error", error };
  }
}

/** Lee una planilla de turnos en CSV (separador , o ;). Columnas: turno_id, apellido_nombre, dni, fecha_nacimiento, tipo_estudio, medico_id. */
export function leerTurnosCsv(texto: string): { turnos: Turno[]; errores: string[] } {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return { turnos: [], errores: ["Archivo vacío"] };
  const sep = lineas[0].includes(";") ? ";" : ",";
  const partir = (l: string) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === sep && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  };
  const cab = partir(lineas[0]).map((h) => h.toLowerCase());
  const idx = (n: string) => cab.indexOf(n);
  const req = ["turno_id", "apellido_nombre", "dni", "fecha_nacimiento", "tipo_estudio", "medico_id"];
  const faltan = req.filter((r) => idx(r) < 0);
  if (faltan.length) return { turnos: [], errores: [`Faltan columnas: ${faltan.join(", ")}`] };
  const turnos: Turno[] = [];
  const errores: string[] = [];
  lineas.slice(1).forEach((l, i) => {
    const c = partir(l);
    const tipo = normalizarTipoEstudio(c[idx("tipo_estudio")]) ?? (c[idx("tipo_estudio")] as Turno["tipoEstudio"]);
    if (!c[idx("turno_id")]) return void errores.push(`Fila ${i + 2}: sin turno_id`);
    turnos.push({ id: c[idx("turno_id")], apellidoNombre: c[idx("apellido_nombre")], dni: c[idx("dni")], fechaNacimiento: c[idx("fecha_nacimiento")], tipoEstudio: tipo, medicoId: c[idx("medico_id")] });
  });
  return { turnos, errores };
}
