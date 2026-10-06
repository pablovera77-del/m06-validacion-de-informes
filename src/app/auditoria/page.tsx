import { verificarCadena } from "@/lib/audit/log";
import { datasetDemo } from "@/lib/data/demo";
import { hayBaseDeDatos } from "@/lib/db/cliente";
import { leerLog } from "@/lib/db/repositorio";
import { Encabezado, Etiqueta, Tarjeta, fmtNum } from "@/components/ui";

const NOMBRE_EVENTO: Record<string, string> = {
  validacion_ejecutada: "Validación ejecutada",
  alerta_generada: "Alerta generada",
  validacion_no_ejecutada: "Validación no ejecutada",
  alerta_revisada: "Alerta revisada",
  alerta_override: "Override con justificación",
  alerta_marcada_incorrecta: "Marcada como incorrecta",
  informe_firmado: "Informe firmado",
  informe_corregido: "Informe corregido",
  auditoria_muestra: "Auditoría por muestreo",
  configuracion_cambiada: "Cambio de configuración",
};

export default async function Auditoria({ searchParams }: PageProps<"/auditoria">) {
  const sp = await searchParams;
  const real = hayBaseDeDatos() && sp.fuente !== "demo";
  const entradas = real ? await leerLog(20000) : (await datasetDemo()).log.listar();
  const v = verificarCadena(entradas);
  const tipo = typeof sp.tipo === "string" ? sp.tipo : "";
  const visibles = entradas.filter((e) => !tipo || e.tipo === tipo).slice(-200).reverse();
  const conteo = Object.entries(entradas.reduce<Record<string, number>>((m, e) => ({ ...m, [e.tipo]: (m[e.tipo] ?? 0) + 1 }), {}));

  return (
    <>
      <Encabezado
        titulo="Log de auditoría"
        bajada="Registro de solo agregado. Cada entrada guarda el hash de la anterior: si alguien modifica o borra una entrada, la verificación lo detecta (Ley 26.529, art. 13). No contiene nombre, DNI ni fecha de nacimiento de pacientes."
      >
        <a href={`/api/exportar?tipo=log&fuente=${real ? "real" : "demo"}`} className="rounded-md border border-marca px-3 py-1.5 text-sm text-marca hover:bg-marca hover:text-white">Exportar con verificación (CSV)</a>
      </Encabezado>

      <div className="mb-6 grid gap-4 md:grid-cols-[320px_1fr]">
        <Tarjeta>
          <div className="text-xs uppercase tracking-wide text-texto-2">Verificación de integridad</div>
          <div className={`mt-1 font-titulo text-3xl ${v.integro ? "text-ok" : "text-roja"}`}>{v.integro ? "✓ Íntegro" : "✗ Alterado"}</div>
          <p className="mt-1 text-sm text-texto-2">{fmtNum(v.entradasVerificadas)} entradas verificadas{v.primeraFalla ? `. Falla en la entrada ${v.primeraFalla.secuencia}: ${v.primeraFalla.motivo}` : ""}</p>
          <p className="mt-2 break-all font-mono text-[11px] text-texto-3">Último hash: {entradas.at(-1)?.hash}</p>
        </Tarjeta>
        <Tarjeta titulo="Eventos registrados">
          <div className="flex flex-wrap gap-2">
            {hayBaseDeDatos() && (
              <a href={real ? "/auditoria?fuente=demo" : "/auditoria"}><Etiqueta tono="aviso">{real ? "Ver log de demostración" : "Ver log real"}</Etiqueta></a>
            )}
            <a href={real ? "/auditoria" : "/auditoria?fuente=demo"}><Etiqueta tono={tipo ? "neutro" : "marca"}>Todos · {fmtNum(entradas.length)}</Etiqueta></a>
            {conteo.map(([t, n]) => (
              <a key={t} href={`/auditoria?tipo=${t}${real ? "" : "&fuente=demo"}`}><Etiqueta tono={tipo === t ? "marca" : "neutro"}>{NOMBRE_EVENTO[t] ?? t} · {fmtNum(n)}</Etiqueta></a>
            ))}
          </div>
        </Tarjeta>
      </div>

      <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-2">
            <tr><th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">Fecha</th><th className="px-3 py-2 font-medium">Evento</th><th className="px-3 py-2 font-medium">Actor</th><th className="px-3 py-2 font-medium">Informe</th><th className="px-3 py-2 font-medium">Datos</th><th className="px-3 py-2 font-medium">Hash</th></tr>
          </thead>
          <tbody>
            {visibles.map((e) => (
              <tr key={e.secuencia} className="border-b border-borde align-top last:border-0">
                <td className="px-3 py-1.5 tabular-nums text-texto-2">{e.secuencia}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{e.fecha.slice(0, 16).replace("T", " ")}</td>
                <td className="px-3 py-1.5">{NOMBRE_EVENTO[e.tipo] ?? e.tipo}</td>
                <td className="px-3 py-1.5">{e.actor}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{e.informeId}</td>
                <td className="max-w-xs truncate px-3 py-1.5 font-mono text-xs text-texto-2" title={JSON.stringify(e.datos)}>{JSON.stringify(e.datos)}</td>
                <td className="px-3 py-1.5 font-mono text-xs text-texto-3">{e.hash.slice(0, 10)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-texto-3">Se muestran las últimas 200 entradas. {real ? "Log persistente en la base de datos: la tabla rechaza modificaciones y borrados." : "Log de demostración en memoria del servidor."}</p>
    </>
  );
}
