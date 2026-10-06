import { verificarCadena } from "@/lib/audit/log";
import { ACCESO, usuarioApi } from "@/lib/auth/sesion";
import { datasetDemo } from "@/lib/data/demo";
import { hayBaseDeDatos } from "@/lib/db/cliente";
import { leerLog } from "@/lib/db/repositorio";
import { datasetReal } from "@/lib/db/panel";
import { NOMBRE_ESTUDIO, NOMBRE_VALIDACION } from "@/lib/domain/types";

/** CSV con separador ";" y BOM, para que Excel (configuración regional AR) lo abra con tildes y columnas correctas. */
function csv(filas: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + filas.map((f) => f.map(esc).join(";")).join("\r\n");
}

/**
 * GET /api/exportar?tipo=alertas&mes=2026-09  → reporte mensual de alertas (HU13)
 * GET /api/exportar?tipo=log                  → log de auditoría con verificación de cadena (HU22)
 * Los reportes no incluyen nombre, DNI ni fecha de nacimiento del paciente.
 */
export async function GET(req: Request) {
  const u = await usuarioApi(ACCESO.calidad);
  if (u instanceof Response) return u;
  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo") ?? "alertas";
  const real = hayBaseDeDatos() && url.searchParams.get("fuente") !== "demo";

  if (tipo === "log") {
    const entradas = real ? await leerLog(50000) : (await datasetDemo()).log.listar();
    const v = verificarCadena(entradas);
    const filas = [
      [`Verificación de cadena: ${v.integro ? "ÍNTEGRA" : "ALTERADA"}`, `Entradas verificadas: ${v.entradasVerificadas}`, `Generado: ${new Date().toISOString()}`],
      ["Secuencia", "Fecha", "Evento", "Actor", "Informe", "Datos", "Hash anterior", "Hash"],
      ...entradas.map((e) => [e.secuencia, e.fecha, e.tipo, e.actor, e.informeId, JSON.stringify(e.datos), e.hashAnterior, e.hash]),
    ];
    return new Response(csv(filas), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="m06-log-auditoria.csv"` } });
  }

  const mes = url.searchParams.get("mes") ?? new Date().toISOString().slice(0, 7);
  const [y, m] = mes.split("-").map(Number);
  const finMes = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const ds = real ? await datasetReal(`${mes}-01`, finMes) : await datasetDemo();
  const filas: (string | number | undefined)[][] = [
    ["Fecha", "Turno", "Médico", "Tipo de estudio", "Validación", "Nivel", "Alerta", "Estado", "Justificación / motivo", "Versión reglas", "Versión prompt"],
  ];
  for (const x of ds.informes.filter((i) => i.informe.fecha.startsWith(mes)))
    for (const a of x.alertas)
      filas.push([
        x.informe.fecha.slice(0, 16).replace("T", " "),
        x.informe.turnoId,
        x.informe.medicoId,
        NOMBRE_ESTUDIO[x.informe.tipoEstudio],
        `${a.validacion} ${NOMBRE_VALIDACION[a.validacion]}`,
        a.nivel,
        a.titulo,
        a.estado,
        a.justificacion ?? a.motivoIncorrecta,
        a.versionReglas,
        a.versionPrompt,
      ]);
  return new Response(csv(filas), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="m06-alertas-${mes}.csv"` } });
}
