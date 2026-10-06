import "server-only";
import { calcularHash, HASH_INICIAL, type EntradaLog, type TipoEvento } from "../audit/log";
import type { Alerta, EstadoAlerta, Informe, Nivel, ResultadoInforme, TipoEstudio, Turno } from "../domain/types";
import { exigirDb } from "./cliente";

/** Acceso a datos persistidos en Supabase. Todas las funciones corren solo en el servidor. */

// ---------- Log de auditoría (solo agregado, cadena de hash) ----------

interface FilaLog {
  secuencia: number;
  fecha: string;
  tipo: string;
  actor: string;
  informe_id: string | null;
  datos: Record<string, unknown>;
  hash_anterior: string;
  hash: string;
}

const aEntrada = (f: FilaLog): EntradaLog => ({
  secuencia: Number(f.secuencia),
  fecha: f.fecha,
  tipo: f.tipo as TipoEvento,
  actor: f.actor,
  informeId: f.informe_id ?? undefined,
  datos: f.datos ?? {},
  hashAnterior: f.hash_anterior,
  hash: f.hash,
});

/**
 * Agrega una entrada al log. La base valida que encadene con la última (trigger); si otro proceso
 * escribió en el medio, se reintenta con la nueva última entrada.
 */
export async function registrarEvento(e: { tipo: TipoEvento; actor: string; informeId?: string; datos?: Record<string, unknown>; fecha?: string }): Promise<EntradaLog> {
  const sb = exigirDb();
  for (let intento = 0; intento < 6; intento++) {
    const { data: ultima, error: e1 } = await sb.from("m06_log").select("secuencia, hash").order("secuencia", { ascending: false }).limit(1).maybeSingle();
    if (e1) throw e1;
    const base = {
      secuencia: (ultima ? Number(ultima.secuencia) : 0) + 1,
      fecha: e.fecha ?? new Date().toISOString(),
      tipo: e.tipo,
      actor: e.actor,
      informeId: e.informeId,
      datos: e.datos ?? {},
      hashAnterior: ultima?.hash ?? HASH_INICIAL,
    };
    const entrada: EntradaLog = { ...base, hash: calcularHash(base) };
    const { error } = await sb.from("m06_log").insert({
      secuencia: entrada.secuencia,
      fecha: entrada.fecha,
      tipo: entrada.tipo,
      actor: entrada.actor,
      informe_id: entrada.informeId ?? null,
      datos: entrada.datos,
      hash_anterior: entrada.hashAnterior,
      hash: entrada.hash,
    });
    if (!error) return entrada;
    if (!["40001", "23505"].includes(error.code ?? "")) throw error;
    await new Promise((r) => setTimeout(r, 50 * (intento + 1)));
  }
  throw new Error("No se pudo registrar el evento en el log tras varios intentos");
}

export async function leerLog(limite = 5000): Promise<EntradaLog[]> {
  const sb = exigirDb();
  const filas: FilaLog[] = [];
  for (let desde = 0; desde < limite; desde += 1000) {
    const { data, error } = await sb.from("m06_log").select("*").order("secuencia").range(desde, Math.min(desde + 999, limite - 1));
    if (error) throw error;
    filas.push(...(data as FilaLog[]));
    if (!data || data.length < 1000) break;
  }
  return filas.map(aEntrada);
}

// ---------- Turnos ----------

export async function guardarTurnos(turnos: Turno[], origen: string) {
  if (!turnos.length) return 0;
  const { error } = await exigirDb()
    .from("m06_turnos")
    .upsert(turnos.map((t) => ({ id: t.id, apellido_nombre: t.apellidoNombre, dni: t.dni, fecha_nacimiento: t.fechaNacimiento, tipo_estudio: t.tipoEstudio, medico_id: t.medicoId, origen, actualizado_en: new Date().toISOString() })));
  if (error) throw error;
  return turnos.length;
}

export async function obtenerTurno(id: string): Promise<Turno | undefined> {
  const { data, error } = await exigirDb().from("m06_turnos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, apellidoNombre: data.apellido_nombre, dni: data.dni, fechaNacimiento: data.fecha_nacimiento, tipoEstudio: data.tipo_estudio, medicoId: data.medico_id } : undefined;
}

// ---------- Informes, validaciones y alertas ----------

interface FilaInforme {
  id: string; turno_id: string; version: number; informe_anterior_id: string | null; tipo_estudio: TipoEstudio; medico_id: string;
  medico_firmante: string | null; fecha: string; encabezado: Informe["encabezado"]; secciones: Informe["secciones"]; origen: Informe["origen"];
  archivo: string | null; estado: string; firmado_en: string | null;
}

export const aInforme = (f: FilaInforme): Informe & { estado: string } => ({
  id: f.id, turnoId: f.turno_id, version: f.version, informeAnteriorId: f.informe_anterior_id ?? undefined, tipoEstudio: f.tipo_estudio,
  medicoId: f.medico_id, medicoFirmante: f.medico_firmante ?? undefined, fecha: f.fecha, encabezado: f.encabezado ?? {}, secciones: f.secciones ?? {},
  origen: f.origen, archivo: f.archivo ?? undefined, estado: f.estado,
});

/** Últimos informes del mismo médico y tipo de estudio (para V2). */
export async function historialMedico(medicoId: string, tipo: TipoEstudio, excluirTurno: string, cantidad = 10): Promise<Informe[]> {
  const { data, error } = await exigirDb()
    .from("m06_informes").select("*").eq("medico_id", medicoId).eq("tipo_estudio", tipo).neq("turno_id", excluirTurno).neq("estado", "reemplazado")
    .order("fecha", { ascending: false }).limit(cantidad);
  if (error) throw error;
  return (data as FilaInforme[]).map(aInforme);
}

/** Versión vigente del informe para un turno (si existe), para vincular correcciones (HU27). */
export async function informeVigenteDelTurno(turnoId: string): Promise<(Informe & { estado: string }) | undefined> {
  const { data, error } = await exigirDb().from("m06_informes").select("*").eq("turno_id", turnoId).neq("estado", "reemplazado").order("version", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? aInforme(data as FilaInforme) : undefined;
}

export async function guardarInformeValidado(informe: Informe, r: ResultadoInforme, extra: { archivoDriveId?: string; hashArchivo?: string }) {
  const sb = exigirDb();
  if (informe.informeAnteriorId) {
    const { error } = await sb.from("m06_informes").update({ estado: "reemplazado" }).eq("id", informe.informeAnteriorId);
    if (error) throw error;
  }
  const { error: e1 } = await sb.from("m06_informes").upsert({
    id: informe.id, turno_id: informe.turnoId, version: informe.version, informe_anterior_id: informe.informeAnteriorId ?? null,
    tipo_estudio: informe.tipoEstudio, medico_id: informe.medicoId, medico_firmante: informe.medicoFirmante ?? null, fecha: informe.fecha,
    encabezado: informe.encabezado, secciones: informe.secciones, origen: informe.origen, archivo: informe.archivo ?? null,
    archivo_drive_id: extra.archivoDriveId ?? null, hash_archivo: extra.hashArchivo ?? null,
  });
  if (e1) throw e1;
  const { data: val, error: e2 } = await sb.from("m06_validaciones").insert({
    informe_id: informe.id, fecha: r.fecha, version_reglas: r.versionReglas,
    versiones_prompt: [...new Set(r.resultados.map((x) => x.traza?.versionPrompt).filter(Boolean))],
    // Las trazas no contienen datos del paciente: solo secciones enviadas y hash de la entrada.
    resultados: r.resultados.map((x) => ({ validacion: x.validacion, estado: x.estado, motivo: x.motivo ?? null, alertas: x.alertas.length, traza: x.traza ?? null })),
    nivel_maximo: r.nivelMaximo, incompleto: r.incompleto,
  }).select("id").single();
  if (e2) throw e2;
  if (r.alertas.length) {
    const { error: e3 } = await sb.from("m06_alertas").insert(
      r.alertas.map((a) => ({
        alerta_clave: a.id, validacion_id: val.id, informe_id: informe.id, validacion: a.validacion, nivel: a.nivel, titulo: a.titulo,
        detalle: a.detalle, evidencia: a.evidencia, version_reglas: a.versionReglas, version_prompt: a.versionPrompt ?? null,
      })),
    );
    if (e3) throw e3;
  }
  return val.id as string;
}

export interface FilaAlerta {
  id: string; alerta_clave: string; informe_id: string; validacion: Alerta["validacion"]; nivel: Nivel; titulo: string; detalle: string;
  evidencia: Alerta["evidencia"]; version_reglas: string; version_prompt: string | null; estado: EstadoAlerta; justificacion: string | null;
  motivo_incorrecta: string | null; validacion_id: string; actualizado_en: string;
}

export const aAlerta = (f: FilaAlerta): Alerta => ({
  id: f.id, informeId: f.informe_id, validacion: f.validacion, nivel: f.nivel, titulo: f.titulo, detalle: f.detalle, evidencia: f.evidencia ?? [],
  versionReglas: f.version_reglas, versionPrompt: f.version_prompt ?? undefined, estado: f.estado, justificacion: f.justificacion ?? undefined,
  motivoIncorrecta: f.motivo_incorrecta ?? undefined,
});

export async function obtenerInformeConAlertas(id: string) {
  const sb = exigirDb();
  const { data: inf, error } = await sb.from("m06_informes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!inf) return undefined;
  const { data: val } = await sb.from("m06_validaciones").select("*").eq("informe_id", id).order("fecha", { ascending: false }).limit(1).maybeSingle();
  const { data: alertas } = val ? await sb.from("m06_alertas").select("*").eq("validacion_id", val.id) : { data: [] };
  return { informe: aInforme(inf as FilaInforme), validacion: val, alertas: ((alertas ?? []) as FilaAlerta[]).map(aAlerta) };
}

export async function listarInformes(opts: { estado?: string; limite?: number } = {}) {
  let q = exigirDb().from("m06_informes").select("*").neq("estado", "reemplazado").order("creado_en", { ascending: false }).limit(opts.limite ?? 200);
  if (opts.estado) q = q.eq("estado", opts.estado);
  const { data, error } = await q;
  if (error) throw error;
  return (data as FilaInforme[]).map(aInforme);
}

export async function resumenAlertas(informeIds: string[]) {
  if (!informeIds.length) return new Map<string, { nivelMaximo: Nivel | null; cantidad: number; incompleto: boolean }>();
  const sb = exigirDb();
  const { data, error } = await sb.from("m06_validaciones").select("informe_id, nivel_maximo, incompleto, fecha, resultados").in("informe_id", informeIds).order("fecha", { ascending: false });
  if (error) throw error;
  const m = new Map<string, { nivelMaximo: Nivel | null; cantidad: number; incompleto: boolean }>();
  for (const v of data ?? []) {
    if (m.has(v.informe_id)) continue;
    const cantidad = (v.resultados as { alertas: number }[]).reduce((s, x) => s + (x.alertas ?? 0), 0);
    m.set(v.informe_id, { nivelMaximo: v.nivel_maximo, cantidad, incompleto: v.incompleto });
  }
  return m;
}

/** Registra la decisión del médico sobre cada alerta y la firma (simulada en la etapa 1). */
export async function registrarDecisiones(informeId: string, actor: string, decisiones: { alertaId: string; estado: EstadoAlerta; justificacion?: string; motivo?: string }[]) {
  const sb = exigirDb();
  for (const d of decisiones) {
    const { error } = await sb.from("m06_alertas").update({
      estado: d.estado, justificacion: d.justificacion ?? null, motivo_incorrecta: d.motivo ?? null, actualizado_por: actor, actualizado_en: new Date().toISOString(),
    }).eq("id", d.alertaId).eq("informe_id", informeId);
    if (error) throw error;
    const tipo: TipoEvento = d.estado === "override" ? "alerta_override" : d.estado === "marcada_incorrecta" ? "alerta_marcada_incorrecta" : "alerta_revisada";
    await registrarEvento({ tipo, actor, informeId, datos: { alertaId: d.alertaId, justificacion: d.justificacion ?? null, motivo: d.motivo ?? null } });
  }
  const { error } = await sb.from("m06_informes").update({ estado: "firmado", firmado_en: new Date().toISOString() }).eq("id", informeId);
  if (error) throw error;
  return registrarEvento({ tipo: "informe_firmado", actor, informeId, datos: { alertas: decisiones.length } });
}

// ---------- Archivos procesados ----------

export async function archivoYaProcesado(id: string, modificadoEn?: string) {
  const { data } = await exigirDb().from("m06_archivos").select("modificado_en, estado").eq("id", id).maybeSingle();
  if (!data) return false;
  return data.estado === "procesado" && (!modificadoEn || new Date(data.modificado_en).getTime() >= new Date(modificadoEn).getTime());
}

export async function registrarArchivo(a: { id: string; nombre: string; origen: "drive" | "carga_manual"; modificadoEn?: string; informeId?: string; estado: "procesado" | "error" | "ignorado"; error?: string }) {
  const { error } = await exigirDb().from("m06_archivos").upsert({
    id: a.id, nombre: a.nombre, origen: a.origen, modificado_en: a.modificadoEn ?? null, informe_id: a.informeId ?? null, estado: a.estado, error: a.error ?? null, procesado_en: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function listarArchivos(limite = 100) {
  const { data, error } = await exigirDb().from("m06_archivos").select("*").order("procesado_en", { ascending: false }).limit(limite);
  if (error) throw error;
  return data as { id: string; nombre: string; origen: string; informe_id: string | null; estado: string; error: string | null; procesado_en: string }[];
}

// ---------- Datos para el panel de Calidad ----------

export async function datosPanel(desde: string, hasta: string) {
  const sb = exigirDb();
  const { data: informes, error } = await sb.from("m06_informes").select("*").neq("estado", "reemplazado").gte("fecha", desde).lte("fecha", `${hasta}T23:59:59.999Z`).limit(20000);
  if (error) throw error;
  const ids = (informes as FilaInforme[]).map((i) => i.id);
  const alertas: FilaAlerta[] = [];
  const validaciones: { informe_id: string; incompleto: boolean; fecha: string; id: string }[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const lote = ids.slice(i, i + 300);
    const { data: v } = await sb.from("m06_validaciones").select("id, informe_id, incompleto, fecha").in("informe_id", lote).order("fecha", { ascending: false });
    validaciones.push(...(v ?? []));
  }
  const ultimaVal = new Map<string, string>();
  for (const v of validaciones) if (!ultimaVal.has(v.informe_id)) ultimaVal.set(v.informe_id, v.id);
  const valIds = [...ultimaVal.values()];
  for (let i = 0; i < valIds.length; i += 300) {
    const { data: a } = await sb.from("m06_alertas").select("*").in("validacion_id", valIds.slice(i, i + 300));
    alertas.push(...((a ?? []) as FilaAlerta[]));
  }
  const { data: auditoria } = await sb.from("m06_auditoria_muestra").select("alerta_id, validacion, correcta, override_apropiado");
  const { data: debitos } = await sb.from("m06_debitos").select("*");
  const { data: acciones } = await sb.from("m06_acciones_correctivas").select("*").order("fecha", { ascending: false });
  return { informes: (informes as FilaInforme[]).map(aInforme), validaciones, alertas, auditoria: auditoria ?? [], debitos: debitos ?? [], acciones: acciones ?? [] };
}

export async function guardarDebito(d: { mes: string; causa: "informe" | "otra"; cantidad: number; monto: number; financiador?: string; nota?: string }, actor: string) {
  const { error } = await exigirDb().from("m06_debitos").insert({ ...d, cargado_por: actor });
  if (error) throw error;
  await registrarEvento({ tipo: "configuracion_cambiada", actor, datos: { tabla: "m06_debitos", ...d } });
}

export async function guardarAccionCorrectiva(a: { id: string; fecha: string; patron: string; accion: string; responsable: string; estado: "abierta" | "en_curso" | "cerrada"; cierre?: string }, actor: string) {
  const { error } = await exigirDb().from("m06_acciones_correctivas").upsert({ ...a, actualizado_en: new Date().toISOString() });
  if (error) throw error;
  await registrarEvento({ tipo: "configuracion_cambiada", actor, datos: { tabla: "m06_acciones_correctivas", ...a } });
}

export async function guardarMuestraAuditoria(m: { alertaId: string; validacion: string; correcta: boolean; overrideApropiado?: boolean; comentario?: string }, auditor: string) {
  const { error } = await exigirDb().from("m06_auditoria_muestra").insert({ alerta_id: m.alertaId, validacion: m.validacion, correcta: m.correcta, override_apropiado: m.overrideApropiado ?? null, comentario: m.comentario ?? null, auditor });
  if (error) throw error;
  await registrarEvento({ tipo: "auditoria_muestra", actor: auditor, datos: { alertaId: m.alertaId, correcta: m.correcta } });
}
