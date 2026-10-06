"use server";

import { revalidatePath } from "next/cache";
import { ACCESO, exigirUsuario } from "@/lib/auth/sesion";
import { hayBaseDeDatos } from "@/lib/db/cliente";
import { guardarTurnos, registrarEvento } from "@/lib/db/repositorio";
import { descargar, driveConfigurado, listarPdfs, planillaTurnosCsv } from "@/lib/ingesta/drive";
import { leerTurnosCsv, procesarPdf, type ResultadoProceso } from "@/lib/ingesta/procesar";

export interface EstadoIngesta {
  mensaje?: string;
  error?: string;
  resultados?: ResultadoProceso[];
}

export async function subirPdfs(_: EstadoIngesta, form: FormData): Promise<EstadoIngesta> {
  if (!hayBaseDeDatos()) return { error: "La base de datos no está configurada." };
  const { email: ACTOR } = await exigirUsuario(ACCESO.ingesta);
  const archivos = form.getAll("pdf").filter((f): f is File => f instanceof File && f.size > 0);
  if (!archivos.length) return { error: "Elegí al menos un PDF." };
  const resultados: ResultadoProceso[] = [];
  for (const f of archivos.slice(0, 20)) {
    if (f.type && f.type !== "application/pdf") {
      resultados.push({ archivo: f.name, estado: "error", error: "No es un PDF", advertencias: [] });
      continue;
    }
    if (f.size > 4 * 1024 * 1024) {
      resultados.push({ archivo: f.name, estado: "error", error: "Supera 4 MB", advertencias: [] });
      continue;
    }
    resultados.push(await procesarPdf({ datos: new Uint8Array(await f.arrayBuffer()), nombre: f.name, origen: "carga_manual", actor: ACTOR }));
  }
  revalidatePath("/ingesta");
  revalidatePath("/medico");
  return { mensaje: `${resultados.filter((r) => r.estado === "procesado").length} de ${resultados.length} procesados`, resultados };
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
