import Link from "next/link";
import { notFound } from "next/navigation";
import { casoPorInforme } from "@/lib/data/bandeja";
import { NOMBRE_ESTUDIO, NOMBRE_VALIDACION } from "@/lib/domain/types";
import { validarInforme } from "@/lib/engine/motor";
import { Etiqueta, Tarjeta } from "@/components/ui";
import { PanelPrefirma } from "./panel-prefirma";

export default async function VistaPrefirma({ params }: PageProps<"/medico/[id]">) {
  const { id } = await params;
  const caso = casoPorInforme(id);
  if (!caso) notFound();
  const { informe, turno } = caso;
  const r = await validarInforme(informe, { turno, historial: caso.historial });

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
          <PanelPrefirma informeId={informe.id} alertas={r.alertas} incompleto={r.incompleto} />
          <Tarjeta titulo="Validaciones ejecutadas">
            <ul className="flex flex-col gap-1.5 text-sm">
              {r.resultados.map((v) => (
                <li key={v.validacion} className="flex items-start justify-between gap-3">
                  <span><span className="font-mono text-xs text-texto-2">{v.validacion}</span> {NOMBRE_VALIDACION[v.validacion]}</span>
                  {v.estado === "ejecutada" ? (
                    <Etiqueta tono={v.alertas.length ? "neutro" : "ok"}>{v.alertas.length ? `${v.alertas.length} alerta${v.alertas.length > 1 ? "s" : ""}` : "OK"}</Etiqueta>
                  ) : v.estado === "no_aplica" ? (
                    <Etiqueta>No aplica</Etiqueta>
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
            <p className="mt-3 text-xs text-texto-3">Reglas {r.versionReglas}</p>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
