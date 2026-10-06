import { HISTORIAL_PROMPTS, type ConfigPrompt } from "@/lib/config/prompts";
import { NOMBRE_VALIDACION } from "@/lib/domain/types";
import { Aviso, Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { ProbarPrompt } from "./probar";
import { descripcionProveedor } from "@/lib/engine/llm";
import { ACCESO, exigirUsuario } from "@/lib/auth/sesion";

const ESTADOS = ["borrador", "en_revision", "aprobada", "vigente", "retirada"] as const;

function FlujoEstados({ actual }: { actual: ConfigPrompt["estado"] }) {
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs">
      {ESTADOS.map((e, i) => (
        <li key={e} className="flex items-center gap-1">
          <span className={`rounded-full border px-2 py-0.5 ${e === actual ? "border-marca bg-marca text-white" : "border-borde text-texto-2"}`}>{e.replace("_", " ")}</span>
          {i < ESTADOS.length - 1 && <span aria-hidden className="text-texto-3">→</span>}
        </li>
      ))}
    </ol>
  );
}

export default async function ConfiguracionPrompts() {
  await exigirUsuario(ACCESO.configuracion);
  const vigentes = HISTORIAL_PROMPTS.filter((p) => p.estado === "vigente");
  const proveedor = descripcionProveedor();
  return (
    <>
      <Encabezado
        titulo="Prompts de IA"
        bajada="Texto exacto que recibe el modelo en cada validación con IA (V3A y V5), con su versión, aprobación, datos que se envían y cómo se transforma la respuesta en una alerta."
      />
      <div className="mb-6">
        <Aviso>
          {proveedor.tipo !== "simulador"
            ? `Proveedor activo: ${proveedor.nombre} · modelo ${proveedor.modelo}. Las validaciones V3A y V5 usan el modelo real; solo se envían las secciones clínicas.`
            : "Proveedor activo: Simulador local (sin IA). Aplica las mismas reglas con expresiones regulares para poder probar sin conexión al modelo. Para usar el modelo real se configuran en Vercel M06_LLM_PROVIDER=anthropic y ANTHROPIC_API_KEY."}
        </Aviso>
      </div>

      <div className="flex flex-col gap-8">
        {vigentes.map((p) => (
          <section key={p.version} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-xl">{p.validacion} · {NOMBRE_VALIDACION[p.validacion]}</h2>
              <FlujoEstados actual={p.estado} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Tarjeta titulo="Versión">
                <dl className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Versión</dt><dd className="font-mono text-xs">{p.version}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Vigente desde</dt><dd>{p.vigenteDesde}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Autor</dt><dd className="text-right">{p.autor}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Aprobó</dt><dd className="text-right">{p.aprobadoPor}</dd></div>
                  <div className="mt-1 text-texto-2">Motivo: <span className="text-texto">{p.motivo}</span></div>
                </dl>
              </Tarjeta>
              <Tarjeta titulo="Modelo">
                <dl className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Proveedor</dt><dd>{p.modelo.proveedor}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Modelo</dt><dd className="font-mono text-xs">{p.modelo.nombre}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Temperatura</dt><dd>{p.modelo.temperatura} (resultado reproducible)</dd></div>
                </dl>
              </Tarjeta>
              <Tarjeta titulo="Datos que se envían">
                <div className="flex flex-wrap gap-1.5">
                  {p.seccionesEnviadas.map((s) => <Etiqueta key={s} tono="marca">✓ {s}</Etiqueta>)}
                </div>
                <div className="mt-3 text-xs text-texto-2">Nunca se envían:</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {p.camposExcluidos.map((c) => <Etiqueta key={c}>✕ {c}</Etiqueta>)}
                </div>
              </Tarjeta>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Tarjeta titulo="Instrucciones del sistema">
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-fondo p-3 font-mono text-xs leading-relaxed">{p.sistema}</pre>
              </Tarjeta>
              <div className="flex flex-col gap-4">
                <Tarjeta titulo="Plantilla de entrada">
                  <pre className="overflow-auto whitespace-pre-wrap rounded bg-fondo p-3 font-mono text-xs leading-relaxed">{p.plantillaEntrada}</pre>
                </Tarjeta>
                <Tarjeta titulo="Salida esperada (validada con esquema)">
                  <ul className="list-disc pl-5 text-sm text-texto-2">{p.esquemaSalidaDescripcion.map((l) => <li key={l}>{l}</li>)}</ul>
                </Tarjeta>
                <Tarjeta titulo="Regla de nivel (la aplica el código, no el modelo)">
                  <ul className="list-disc pl-5 text-sm text-texto-2">{p.reglasNivel.map((l) => <li key={l}>{l}</li>)}</ul>
                </Tarjeta>
              </div>
            </div>

            <ProbarPrompt validacion={p.validacion} />

            <Tarjeta titulo="Historial de versiones">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-texto-2"><tr><th className="py-1 font-medium">Versión</th><th className="py-1 font-medium">Estado</th><th className="py-1 font-medium">Fecha</th><th className="py-1 font-medium">Motivo</th></tr></thead>
                <tbody>
                  {HISTORIAL_PROMPTS.filter((h) => h.validacion === p.validacion).map((h) => (
                    <tr key={h.version} className="border-t border-borde"><td className="py-1.5 font-mono text-xs">{h.version}</td><td>{h.estado}</td><td>{h.fecha}</td><td className="text-texto-2">{h.motivo}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-texto-3">
                Flujo de cambio: borrador → ejecutar set de prueba → aprobación de Calidad → vigente. La versión anterior queda retirada pero consultable, y cada alerta conserva la versión que la generó.
                En esta etapa los prompts se versionan en el repositorio (cada cambio es un commit revisado); la edición desde esta pantalla llega con la base de datos.
              </p>
            </Tarjeta>
          </section>
        ))}
      </div>
    </>
  );
}
