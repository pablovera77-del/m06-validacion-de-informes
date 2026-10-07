"use server";

import { revalidatePath } from "next/cache";
import { ACCESO, exigirUsuario } from "@/lib/auth/sesion";
import { hayBaseDeDatos } from "@/lib/db/cliente";
import { guardarTurnos, registrarEvento } from "@/lib/db/repositorio";
import { descargar, driveConfigurado, listarPdfs, planillaTurnosCsv } from "@/lib/ingesta/drive";
import { leerTurnosCsv, procesarPdf, type ResultadoProceso } from "@/lib/ingesta/procesar";

const MAX_PDF = 4 * 1024 * 1024;

/**
 * Sube y valida UN informe PDF. La pantalla de arrastrar y soltar la llama una vez por archivo,
 * así cada informe muestra su resultado apenas termina y no se supera el límite de tamaño por solicitud.
 */
export async function subirUnPdf(form: FormData): Promise<ResultadoProceso> {
  const f = form.get("pdf");
  const nombre = f instanceof File ? f.name : "archivo";
  if (!hayBaseDeDatos()) return { archivo: nombre, estado: "error", error: "La base de datos no está configurada.", advertencias: [] };
  const u = await exigirUsuario(ACCESO.subirInformes);
  if (!(f instanceof File) || !f.size) return { archivo: nombre, estado: "error", error: "Archivo vacío", advertencias: [] };
  if ((f.type && f.type !== "application/pdf") || !/\.pdf$/i.test(f.name)) return { archivo: nombre, estado: "error", error: "No es un PDF", advertencias: [] };
  if (f.size > MAX_PDF) return { archivo: nombre, estado: "error", error: "Supera 4 MB", advertencias: [] };
  const r = await procesarPdf({
    datos: new Uint8Array(await f.arrayBuffer()),
    nombre: f.name,
    origen: "carga_manual",
    actor: u.email,
    medicoQueSube: u.rol === "medico" ? (u.medicoId ?? undefined) : undefined,
  });
  revalidatePath("/ingesta");
  revalidatePath("/medico");
  return r;
}

export interface EstadoIngesta {
  mensaje?: string;
  error?: string;
  resultados?: ResultadoProceso[];
}

export async function subirTurnos(_: EstadoIngesta, form: FormData): Promise<EstadoIngesta> {
  if (!hayBaseDeDatos()) return { error: "La base de datos no está configurada." };
  const { email: ACTOR } = await exigirUsuario(ACCESO.ingesta);
  const f = form.get("csv");
  if (!(f instanceof File) || !f.size) return { error: "Elegí el archivo CSV de turnos." };
  const { turnos, errores } = leerTurnosCsv(await f.text());
  if (!turnos.length) return { error: errores.join(" · ") || "Sin turnos" };
  const n = await guardarTurnos(turnos, "carga_manual");
  await registrarEvento({ tipo: "configuracion_cambiada", actor: ACTOR, datos: { tabla: "m06_turnos", turnos: n, origen: "carga_manual" } });
  revalidatePath("/ingesta");
  return { mensaje: `${n} turnos cargados${errores.length ? ` · ${errores.length} filas con error` : ""}` };
}

export async function sincronizarDrive(): Promise<EstadoIngesta> {
  if (!hayBaseDeDatos()) return { error: "La base de datos no está configurada." };
  const { email: ACTOR } = await exigirUsuario(ACCESO.ingesta);
  if (!driveConfigurado()) return { error: "Google Drive no está configurado (falta la cuenta de servicio)." };
  try {
    const csv = await planillaTurnosCsv();
    let nTurnos = 0;
    if (csv) {
      const { turnos } = leerTurnosCsv(csv);
      nTurnos = await guardarTurnos(turnos, "drive");
    }
    const pdfs = await listarPdfs();
    const resultados: ResultadoProceso[] = [];
    for (const a of pdfs.slice(0, 50)) {
      resultados.push(await procesarPdf({ datos: await descargar(a.id), nombre: a.name, origen: "drive", idArchivo: a.id, modificadoEn: a.modifiedTime, actor: `sincronizacion-drive:${ACTOR}` }));
    }
    revalidatePath("/ingesta");
    revalidatePath("/medico");
    const nuevos = resultados.filter((r) => r.estado === "procesado").length;
    return { mensaje: `Drive: ${nTurnos} turnos actualizados · ${pdfs.length} PDF encontrados · ${nuevos} procesados`, resultados };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
