import "server-only";
import type { AccionCorrectiva, Debito, InformeDemo, MuestraAuditoria } from "../data/demo";
import type { Alerta, Turno } from "../domain/types";
import { NOMBRE_ESTUDIO } from "../domain/types";
import { aAlerta, datosPanel } from "./repositorio";

/** Lleva los datos reales de la base a la misma forma que usa el panel con datos sintéticos. */
export async function datasetReal(desde: string, hasta: string) {
  const d = await datosPanel(desde, hasta);
  const alertasPorInforme = new Map<string, Alerta[]>();
  for (const f of d.alertas) {
    const a = aAlerta(f);
    alertasPorInforme.set(a.informeId, [...(alertasPorInforme.get(a.informeId) ?? []), a]);
  }
  const incompletos = new Set(d.validaciones.filter((v) => v.incompleto).map((v) => v.informe_id));
  const informes: InformeDemo[] = d.informes.map((inf) => {
    const alertas = alertasPorInforme.get(inf.id) ?? [];
    const turno: Turno = { id: inf.turnoId, apellidoNombre: "", dni: "", fechaNacimiento: "", tipoEstudio: inf.tipoEstudio, medicoId: inf.medicoId };
    return {
      informe: inf,
      turno,
      resultado: { informeId: inf.id, fecha: inf.fecha, versionReglas: "", resultados: [], alertas, nivelMaximo: null, incompleto: incompletos.has(inf.id) },
      alertas,
      firmado: inf.estado === "firmado",
      segundosHastaFirma: 0,
    };
  });
  const idPorFila = new Map(d.alertas.map((f) => [f.id, f.id]));
  const auditoria: MuestraAuditoria[] = d.auditoria
    .filter((m: { alerta_id: string }) => idPorFila.has(m.alerta_id))
    .map((m: { alerta_id: string; validacion: Alerta["validacion"]; correcta: boolean; override_apropiado: boolean | null }) => ({
      alertaId: m.alerta_id, validacion: m.validacion, correcta: m.correcta, overrideApropiado: m.override_apropiado ?? undefined,
    }));
  const porMes = new Map<string, Debito>();
  for (const x of d.debitos as { mes: string; causa: string; cantidad: number; monto: number }[]) {
    const g = porMes.get(x.mes) ?? { mes: x.mes, causaInforme: 0, causaOtra: 0, montoInforme: 0 };
    if (x.causa === "informe") { g.causaInforme += x.cantidad; g.montoInforme += Number(x.monto); } else g.causaOtra += x.cantidad;
    porMes.set(x.mes, g);
  }
  const acciones: AccionCorrectiva[] = (d.acciones as AccionCorrectiva[]).map((a) => ({ id: a.id, fecha: String(a.fecha), patron: a.patron, accion: a.accion, responsable: a.responsable, estado: a.estado }));
  return {
    desde,
    hasta,
    informes,
    auditoria,
    debitos: [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
    acciones,
    intervenciones: [] as { fecha: string; texto: string }[],
    tipos: [...new Set(d.informes.map((i) => NOMBRE_ESTUDIO[i.tipoEstudio]))],
  };
}
