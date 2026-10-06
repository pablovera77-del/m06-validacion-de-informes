import { connection } from "next/server";
import Link from "next/link";
import { bandejaMedico } from "@/lib/data/bandeja";
import { NOMBRE_ESTUDIO } from "@/lib/domain/types";
import { validarInforme } from "@/lib/engine/motor";
import { Encabezado, InsigniaNivel, Etiqueta, Tarjeta } from "@/components/ui";
import { hayBaseDeDatos } from "@/lib/db/cliente";
import { listarInformes, resumenAlertas } from "@/lib/db/repositorio";

export default async function BandejaMedico() {
  await connection(); // siempre en el momento: lee la base de datos
  const casos = bandejaMedico();
  const filas = await Promise.all(
    casos.map(async (c) => ({ c, r: await validarInforme(c.informe, { turno: c.turno, historial: c.historial }) })),
  );
  const reales = hayBaseDeDatos() ? await listarInformes({ estado: "pendiente_firma", limite: 100 }).catch(() => []) : [];
  const resumen = await resumenAlertas(reales.map((r) => r.id)).catch(() => new Map());
  return (
    <>
      {reales.length > 0 && (
        <Tarjeta titulo="Informes ingresados pendientes de firma" className="mb-8">
          <ul className="flex flex-col divide-y divide-borde text-sm">
            {reales.map((i) => {
              const r = resumen.get(i.id);
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span><span className="font-mono text-xs text-texto-2">{i.turnoId}{i.version > 1 ? ` · v${i.version}` : ""}</span> {i.encabezado.apellidoNombre ?? "—"} · {NOMBRE_ESTUDIO[i.tipoEstudio]}</span>
                  <span className="flex items-center gap-2">
                    {r?.nivelMaximo ? <InsigniaNivel nivel={r.nivelMaximo} corto /> : <Etiqueta tono="ok">✓ Sin alertas</Etiqueta>}
                    {r?.incompleto && <Etiqueta tono="aviso">Validación incompleta</Etiqueta>}
                    <Link href={`/medico/${i.id}`} className="rounded-md border border-marca px-3 py-1 text-marca hover:bg-marca hover:text-white">Abrir</Link>
                  </span>
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      )}
      <Encabezado
        titulo={reales.length ? "Casos de demostración" : "Informes pendientes de firma"}
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
