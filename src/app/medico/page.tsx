import Link from "next/link";
import { bandejaMedico } from "@/lib/data/bandeja";
import { NOMBRE_ESTUDIO } from "@/lib/domain/types";
import { validarInforme } from "@/lib/engine/motor";
import { Encabezado, InsigniaNivel, Etiqueta } from "@/components/ui";

export default async function BandejaMedico() {
  const casos = bandejaMedico();
  const filas = await Promise.all(
    casos.map(async (c) => ({ c, r: await validarInforme(c.informe, { turno: c.turno, historial: c.historial }) })),
  );
  return (
    <>
      <Encabezado
        titulo="Informes pendientes de firma"
        bajada="Así vería el médico su bandeja: cada informe ya fue validado al abrirse. Las alertas no bloquean la firma; indican qué revisar antes de firmar."
      />
      <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-2">
            <tr>
              <th className="px-4 py-3 font-medium">Turno</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Estudio</th>
              <th className="px-4 py-3 font-medium">Estado de la validación</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filas.map(({ c, r }) => (
              <tr key={c.informe.id} className="border-b border-borde last:border-0 hover:bg-fondo">
                <td className="px-4 py-3 font-mono text-xs text-texto-2">{c.informe.turnoId}</td>
                <td className="px-4 py-3">{c.informe.encabezado.apellidoNombre}</td>
                <td className="px-4 py-3">{NOMBRE_ESTUDIO[c.informe.tipoEstudio]}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.nivelMaximo ? <InsigniaNivel nivel={r.nivelMaximo} corto /> : <Etiqueta tono="ok">✓ Sin alertas</Etiqueta>}
                    {r.alertas.length > 1 && <span className="text-xs text-texto-2">{r.alertas.length} alertas</span>}
                    {r.incompleto && <Etiqueta tono="aviso">Validación incompleta</Etiqueta>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/medico/${c.informe.id}`} className="rounded-md border border-marca px-3 py-1 text-marca hover:bg-marca hover:text-white">
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-texto-3">Pacientes y datos sintéticos generados para la demostración.</p>
    </>
  );
}
