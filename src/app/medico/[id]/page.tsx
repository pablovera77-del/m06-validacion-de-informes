import Link from "next/link";
import { notFound } from "next/navigation";
import { casoPorInforme } from "@/lib/data/bandeja";
import { NOMBRE_ESTUDIO, NOMBRE_VALIDACION } from "@/lib/domain/types";
import { validarInforme } from "@/lib/engine/motor";
import { hayBaseDeDatos } from "@/lib/db/cliente";
import { obtenerInformeConAlertas } from "@/lib/db/repositorio";
import type { ResultadoValidacion } from "@/lib/domain/types";
import { Etiqueta, Tarjeta } from "@/components/ui";
import { PanelPrefirma } from "./panel-prefirma";
import { ACCESO, exigirUsuario, puedeVerInforme } from "@/lib/auth/sesion";
import { SIN_ASIGNAR } from "@/lib/ingesta/constantes";
import { listarMedicos } from "@/lib/db/usuarios";
import { asignar } from "./acciones";

export default async function VistaPrefirma({ params }: PageProps<"/medico/[id]">) {
  const u = await exigirUsuario(ACCESO.medico);
  const { id } = await params;
  const caso = casoPorInforme(decodeURIComponent(id));
  let r: { alertas: import("@/lib/domain/types").Alerta[]; incompleto: boolean; versionReglas: string; resultados: Pick<ResultadoValidacion, "validacion" | "estado" | "alertas" | "traza" | "motivo">[] };
  let informe;
  let firmado = false;
  if (caso) {
    informe = caso.informe;
    r = await validarInforme(informe, { turno: caso.turno, historial: caso.historial });
  } else {
    const real = hayBaseDeDatos() ? await obtenerInformeConAlertas(decodeURIComponent(id)) : undefined;
    if (!real || !puedeVerInforme(u, real.informe.medicoId)) notFound();
    informe = real.informe;
    firmado = real.informe.estado === "firmado";
    const res = (real.validacion?.resultados ?? []) as { validacion: ResultadoValidacion["validacion"]; estado: ResultadoValidacion["estado"]; alertas: number; traza?: ResultadoValidacion["traza"]; motivo?: string | null }[];
    r = {
      alertas: real.alertas,
      incompleto: !!real.validacion?.incompleto,
      versionReglas: real.validacion?.version_reglas ?? "",
      resultados: res.map((x) => ({ validacion: x.validacion, estado: x.estado, traza: x.traza ?? undefined, motivo: x.motivo ?? undefined, alertas: real.alertas.filter((a) => a.validacion === x.validacion) })),
    };
  }

  // Calidad y Administración pueden asignar o reasignar el médico de un informe real (no en los casos de demostración).
  const asignable = !caso && !firmado && (ACCESO.asignarMedico as readonly string[]).includes(u.rol);
  const medicos = asignable ? await listarMedicos().catch(() => []) : [];

  const seccion = (titulo: string, texto?: string) => (
    <div>
      <h3 className="mb-1 text-xs uppercase tracking-wide text-texto-2">{titulo}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed">{texto?.trim() ? texto : <span className="italic text-texto-3">(vacío)</span>}</p>
    </div>
  );

  return (
    <>
      <Link href="/medico" className="text-sm text-marca hover:underline">← Volver a la bandeja</Link>
      <div className="mt-3 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Tarjeta titulo={`Informe · ${NOMBRE_ESTUDIO[informe.tipoEstudio]}`} accion={<span className="font-mono text-xs text-texto-2">{informe.turnoId}</span>}>
          <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2 rounded-md bg-fondo p-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-texto-2">Paciente</dt><dd>{informe.encabezado.apellidoNombre || "—"}</dd></div>
            <div><dt className="text-xs text-texto-2">DNI</dt><dd>{informe.encabezado.dni || "—"}</dd></div>
            <div><dt className="text-xs text-texto-2">Nacimiento</dt><dd>{informe.encabezado.fechaNacimiento || "—"}</dd></div>
            <div><dt className="text-xs text-texto-2">Estudio</dt><dd>{informe.encabezado.tipoEstudio || "—"}</dd></div>
          </dl>
          <div className="flex flex-col gap-4">
            {seccion("Técnica", informe.secciones.tecnica)}
            {seccion("Hallazgos", informe.secciones.hallazgos)}
            {seccion("Conclusión", informe.secciones.conclusion)}
            {seccion("Médico firmante", informe.medicoFirmante)}
          </div>
          <p className="mt-6 border-t border-borde pt-3 text-xs text-texto-3">
            El sistema solo lee el informe: no lo modifica. La corrección se hace en el sistema de origen y el informe se vuelve a validar.
          </p>
        </Tarjeta>

        <div className="flex flex-col gap-4">
          {asignable && (
            <Tarjeta titulo="Médico informante">
              {informe.medicoId === SIN_ASIGNAR ? (
                <p className="mb-2 text-sm text-texto-2">Este informe llegó sin turno y no tiene médico asignado. Asignalo para que aparezca en su bandeja.</p>
              ) : (
                <p className="mb-2 text-sm text-texto-2">Asignado a <span className="font-mono">{informe.medicoId}</span>.</p>
              )}
              <form action={asignar} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="informeId" value={informe.id} />
                <select name="medicoId" defaultValue={informe.medicoId === SIN_ASIGNAR ? "" : informe.medicoId} required className="rounded-md border border-borde bg-superficie px-2 py-1.5 text-sm">
                  <option value="" disabled>Elegí el médico…</option>
                  {medicos.map((m) => <option key={m.medicoId} value={m.medicoId}>{m.medicoId} · {m.nombre}</option>)}
                </select>
                <button className="rounded-md bg-marca px-3 py-1.5 text-sm text-white hover:bg-marca-oscuro">{informe.medicoId === SIN_ASIGNAR ? "Asignar" : "Reasignar"}</button>
              </form>
            </Tarjeta>
          )}
          <PanelPrefirma informeId={informe.id} alertas={r.alertas} incompleto={r.incompleto} firmado={firmado} soloLectura={!(ACCESO.firmar as readonly string[]).includes(u.rol)} />
          <Tarjeta titulo="Validaciones ejecutadas">
            <ul className="flex flex-col gap-1.5 text-sm">
              {r.resultados.map((v) => (
                <li key={v.validacion} className="flex items-start justify-between gap-3">
                  <span><span className="font-mono text-xs text-texto-2">{v.validacion}</span> {NOMBRE_VALIDACION[v.validacion]}</span>
                  {v.estado === "ejecutada" ? (
                    <Etiqueta tono={v.alertas.length ? "neutro" : "ok"}>{v.alertas.length ? `${v.alertas.length} alerta${v.alertas.length > 1 ? "s" : ""}` : "OK"}</Etiqueta>
                  ) : v.estado === "no_aplica" ? (
                    <span title={v.motivo}><Etiqueta>{v.validacion === "V4" ? "Identidad sin verificar" : "No aplica"}</Etiqueta></span>
                  ) : (
                    <Etiqueta tono="aviso" >No ejecutada</Etiqueta>
                  )}
                </li>
              ))}
            </ul>
            {r.resultados.some((v) => v.traza) && (
              <div className="mt-4 border-t border-borde pt-3 text-xs text-texto-2">
                {r.resultados.filter((v) => v.traza).map((v) => (
                  <p key={v.validacion}>
                    {v.validacion}: {v.traza!.proveedor} · prompt {v.traza!.versionPrompt} · secciones enviadas: {v.traza!.seccionesEnviadas.join(", ")} · sin datos identificatorios
                  </p>
                ))}
              </div>
            )}
            {r.resultados.some((v) => v.validacion === "V4" && v.estado === "no_aplica") && (
              <p className="mt-3 text-xs text-texto-2">V4: no hay turno de referencia de Visual Medica, así que no se cruzaron nombre, DNI y fecha de nacimiento. Verificalos a mano antes de firmar.</p>
            )}
            <p className="mt-3 text-xs text-texto-3">Reglas {r.versionReglas}</p>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
