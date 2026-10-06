import { ejecutarSetPrueba } from "@/lib/engine/ejecutar-pruebas";
import { NOMBRE_VALIDACION } from "@/lib/domain/types";
import { Encabezado, Etiqueta, InsigniaNivel, Tarjeta } from "@/components/ui";

export default async function SetDePrueba() {
  const r = await ejecutarSetPrueba();
  const ok = r.aprobados === r.total;
  return (
    <>
      <Encabezado
        titulo="Set de prueba de referencia"
        bajada="Se ejecuta contra cada versión de reglas y prompts antes de ponerla en uso (ISO 9001:2015, 7.1.5 y 8.5.1). El resultado es la evidencia de verificación."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-[280px_1fr]">
        <Tarjeta>
          <div className="text-xs uppercase tracking-wide text-texto-2">Resultado</div>
          <div className={`mt-1 font-titulo text-4xl ${ok ? "text-ok" : "text-roja"}`}>{r.aprobados}/{r.total}</div>
          <div className="mt-1 text-sm">{ok ? "✓ Todos los casos aprobados" : "✗ Hay casos que no aprueban"}</div>
          <dl className="mt-4 flex flex-col gap-1 text-xs text-texto-2">
            <div>Reglas: <span className="font-mono">{r.versionReglas}</span></div>
            <div>Prompts: <span className="font-mono">{r.versionPrompts.join(", ")}</span></div>
            <div>Proveedor IA: {r.proveedor}</div>
            <div>Ejecutado: {new Date(r.fecha).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</div>
          </dl>
        </Tarjeta>
        <Tarjeta titulo="Por criterio de aceptación">
          <ul className="flex flex-col gap-2 text-sm">
            {r.porCriterio.map((c) => (
              <li key={c.criterio} className="flex items-start justify-between gap-3">
                <span><span className="font-mono text-xs text-texto-2">{c.criterio}</span> {c.descripcion}</span>
                <Etiqueta tono={c.aprobados === c.total ? "ok" : "aviso"}>{c.aprobados}/{c.total}</Etiqueta>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
      <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-2">
            <tr>
              <th className="px-4 py-2 font-medium">Caso</th>
              <th className="px-4 py-2 font-medium">Descripción</th>
              <th className="px-4 py-2 font-medium">Validación</th>
              <th className="px-4 py-2 font-medium">Esperado</th>
              <th className="px-4 py-2 font-medium">Obtenido</th>
              <th className="px-4 py-2 font-medium">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {r.casos.map((c) => (
              <tr key={c.caso.id} className="border-b border-borde last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{c.caso.id}</td>
                <td className="px-4 py-2">{c.caso.descripcion}{c.titulos.length > 0 && <div className="text-xs text-texto-2">{c.titulos.join(" · ")}</div>}</td>
                <td className="px-4 py-2 text-texto-2">{c.caso.esperado.validacion} · {NOMBRE_VALIDACION[c.caso.esperado.validacion]}</td>
                <td className="px-4 py-2">{c.caso.esperado.nivel ? <InsigniaNivel nivel={c.caso.esperado.nivel} corto /> : <span className="text-texto-2">Sin alerta</span>}</td>
                <td className="px-4 py-2">{c.nivelObtenido ? <InsigniaNivel nivel={c.nivelObtenido} corto /> : <span className="text-texto-2">Sin alerta</span>}</td>
                <td className="px-4 py-2">{c.aprobado ? <Etiqueta tono="ok">✓ Aprueba</Etiqueta> : <Etiqueta tono="aviso">✗ No aprueba</Etiqueta>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
