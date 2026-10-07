import { connection } from "next/server";
import { HISTORIAL_PROMPTS, promptDesdeFila, type ConfigPrompt, type FilaPrompt } from "@/lib/config/prompts";
import { diffLineas } from "@/lib/config/diff";
import { NOMBRE_VALIDACION } from "@/lib/domain/types";
import { Aviso, Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { ProbarPrompt } from "./probar";
import { AprobarBorrador, EditorPrompt } from "./editor";
import { descartar } from "./acciones";
import { descripcionProveedor } from "@/lib/engine/llm";
import { ACCESO, exigirUsuario } from "@/lib/auth/sesion";
import { hayBaseDeDatos } from "@/lib/db/cliente";
import { listarVersiones } from "@/lib/db/prompts";

const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }) : "—");

const TONO_ESTADO: Record<string, "ok" | "aviso" | "neutro" | "marca"> = { vigente: "ok", borrador: "aviso", retirada: "neutro", descartada: "neutro" };

function Diferencias({ antes, despues }: { antes: string; despues: string }) {
  const d = diffLineas(antes, despues);
  const cambios = d.filter((x) => x.tipo !== "igual").length;
  if (!cambios) return <p className="text-sm text-texto-2">El texto es igual al vigente.</p>;
  return (
    <div>
      <p className="mb-2 text-xs text-texto-2">
        <span className="rounded bg-ok-fondo px-1 text-ok">+ {d.filter((x) => x.tipo === "agregada").length} líneas nuevas</span>{" "}
        <span className="rounded bg-roja-fondo px-1 text-roja">− {d.filter((x) => x.tipo === "quitada").length} líneas quitadas</span>
      </p>
      <pre className="max-h-96 overflow-auto rounded bg-fondo p-3 font-mono text-xs leading-relaxed">
        {d.map((x, i) => (
          <div key={i} className={x.tipo === "agregada" ? "bg-ok-fondo text-ok" : x.tipo === "quitada" ? "bg-roja-fondo text-roja line-through" : "text-texto-2"}>
            {x.tipo === "agregada" ? "+ " : x.tipo === "quitada" ? "− " : "  "}{x.texto || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}

export default async function ConfiguracionPrompts() {
  await exigirUsuario(ACCESO.configuracion);
  await connection();
  const proveedor = descripcionProveedor();
  const conDb = hayBaseDeDatos();
  const secciones = await Promise.all(
    (["V3A", "V5"] as const).map(async (v) => {
      const filas: FilaPrompt[] = conDb ? await listarVersiones(v).catch(() => []) : [];
      const filaVigente = filas.find((f) => f.estado === "vigente");
      const codigo = HISTORIAL_PROMPTS.find((h) => h.validacion === v)!;
      const vigente: ConfigPrompt = filaVigente ? promptDesdeFila(filaVigente) : codigo;
      const borrador = filas.find((f) => f.estado === "borrador");
      return { v, filas, vigente, borrador, codigo, codigoVigente: !filaVigente };
    }),
  );

  return (
    <>
      <Encabezado
        titulo="Prompts de IA"
        bajada="Instrucciones que recibe el modelo en las validaciones con IA (V3A y V5). Se pueden editar: cada cambio queda como borrador, se prueba con el modelo real y recién después de aprobarlo se usa en los informes."
      />
      <div className="mb-6">
        <Aviso>
          {proveedor.tipo !== "simulador"
            ? `Modelo activo: ${proveedor.nombre} · ${proveedor.modelo}. Solo se envían las secciones clínicas del informe, nunca datos del paciente.`
            : "Modelo activo: simulador local (sin IA). Para probar borradores hace falta el modelo real (M06_LLM_PROVIDER=anthropic y ANTHROPIC_API_KEY en Vercel)."}
        </Aviso>
      </div>

      <div className="flex flex-col gap-12">
        {secciones.map(({ v, filas, vigente, borrador, codigo, codigoVigente }) => (
          <section key={v} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-borde pb-2">
              <h2 className="text-xl">{v} · {NOMBRE_VALIDACION[v]}</h2>
              <span className="flex items-center gap-2 text-sm text-texto-2">
                Vigente: <span className="font-mono text-xs">{vigente.version}</span>
                {borrador && <Etiqueta tono="aviso">Borrador {borrador.version} en curso</Etiqueta>}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Tarjeta titulo="Versión vigente">
                <dl className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Versión</dt><dd className="font-mono text-xs">{vigente.version}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Vigente desde</dt><dd>{vigente.vigenteDesde ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Autor</dt><dd className="text-right">{vigente.autor}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Aprobó</dt><dd className="text-right">{vigente.aprobadoPor ?? "—"}</dd></div>
                  <div className="mt-1 text-texto-2">Motivo: <span className="text-texto">{vigente.motivo}</span></div>
                </dl>
              </Tarjeta>
              <Tarjeta titulo="Modelo">
                <dl className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Proveedor</dt><dd className="text-right">{vigente.modelo.proveedor}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Modelo</dt><dd className="font-mono text-xs">{vigente.modelo.nombre}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-texto-2">Temperatura</dt><dd>{vigente.modelo.temperatura} (resultado reproducible)</dd></div>
                </dl>
              </Tarjeta>
              <Tarjeta titulo="Datos que se envían">
                <div className="flex flex-wrap gap-1.5">
                  {vigente.seccionesEnviadas.map((s) => <Etiqueta key={s} tono="marca">✓ {s}</Etiqueta>)}
                </div>
                <div className="mt-3 text-xs text-texto-2">Nunca se envían:</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {vigente.camposExcluidos.map((c) => <Etiqueta key={c}>✕ {c}</Etiqueta>)}
                </div>
              </Tarjeta>
            </div>

            <Tarjeta titulo={borrador ? `Instrucciones · editando ${borrador.version}` : "Instrucciones del sistema (vigentes)"}>
              <EditorPrompt
                key={borrador?.actualizado_en ?? vigente.version}
                validacion={v}
                textoInicial={borrador?.sistema ?? vigente.sistema}
                motivoInicial={borrador?.motivo}
                hayBorrador={!!borrador}
                habilitado={conDb}
              >
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-fondo p-3 font-mono text-xs leading-relaxed">{vigente.sistema}</pre>
              </EditorPrompt>
            </Tarjeta>

            {borrador && (
              <section className="rounded-xl border-2 border-amarilla/40 bg-superficie p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-lg">Borrador {borrador.version}</h3>
                  <span className="text-xs text-texto-2">
                    Creado por {borrador.autor} · {fecha(borrador.actualizado_en)} · basado en {borrador.base_version}
                  </span>
                </div>
                <p className="mt-1 text-sm">Motivo: {borrador.motivo}</p>

                <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  <li className="rounded-md bg-ok-fondo px-3 py-2 text-ok">1. Guardado ✓</li>
                  <li className={`rounded-md px-3 py-2 ${borrador.probado_en ? "bg-ok-fondo text-ok" : "bg-amarilla-fondo text-amarilla"}`}>
                    2. {borrador.probado_en ? `Probado ✓ (${borrador.probado_por}, ${fecha(borrador.probado_en)})` : "Falta probarlo con el modelo real"}
                  </li>
                  <li className="rounded-md bg-fondo px-3 py-2 text-texto-2">3. Aprobar y poner vigente</li>
                </ol>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Cambios respecto de {vigente.version}</h4>
                    <Diferencias antes={vigente.sistema} despues={borrador.sistema} />
                  </div>
                  <ProbarPrompt validacion={v} promptId={borrador.id} version={borrador.version} />
                </div>

                <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-borde pt-4">
                  <AprobarBorrador id={borrador.id} version={borrador.version} probado={!!borrador.probado_en} />
                  <form action={descartar}>
                    <input type="hidden" name="id" value={borrador.id} />
                    <button className="text-sm text-texto-2 underline hover:text-roja">Descartar borrador</button>
                  </form>
                </div>
                <p className="mt-3 text-xs text-texto-3">
                  Recomendación de Calidad: que apruebe una persona distinta de quien escribió el cambio, y probar también con los casos BI-RADS / de órganos del set de prueba.
                </p>
              </section>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <Tarjeta titulo="Plantilla de entrada">
                <pre className="overflow-auto whitespace-pre-wrap rounded bg-fondo p-3 font-mono text-xs leading-relaxed">{vigente.plantillaEntrada}</pre>
              </Tarjeta>
              <Tarjeta titulo="Salida esperada (validada con esquema)">
                <ul className="list-disc pl-5 text-sm text-texto-2">{vigente.esquemaSalidaDescripcion.map((l) => <li key={l}>{l}</li>)}</ul>
              </Tarjeta>
              <Tarjeta titulo="Regla de nivel (la aplica el código)">
                <ul className="list-disc pl-5 text-sm text-texto-2">{vigente.reglasNivel.map((l) => <li key={l}>{l}</li>)}</ul>
              </Tarjeta>
            </div>

            {!borrador && <ProbarPrompt validacion={v} />}

            <Tarjeta titulo="Historial de versiones">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-xs text-texto-2">
                    <tr><th className="py-1 font-medium">Versión</th><th className="py-1 font-medium">Estado</th><th className="py-1 font-medium">Autor</th><th className="py-1 font-medium">Probó</th><th className="py-1 font-medium">Aprobó</th><th className="py-1 font-medium">Motivo</th></tr>
                  </thead>
                  <tbody>
                    {filas.map((h) => (
                      <tr key={h.id} className="border-t border-borde align-top">
                        <td className="py-1.5 font-mono text-xs">{h.version}</td>
                        <td className="py-1.5"><Etiqueta tono={TONO_ESTADO[h.estado]}>{h.estado}</Etiqueta></td>
                        <td className="py-1.5 text-xs">{h.autor}<div className="text-texto-3">{fecha(h.creado_en)}</div></td>
                        <td className="py-1.5 text-xs">{h.probado_por ?? "—"}{h.probado_en && <div className="text-texto-3">{fecha(h.probado_en)}</div>}</td>
                        <td className="py-1.5 text-xs">{h.aprobado_por ?? "—"}{h.aprobado_en && <div className="text-texto-3">{fecha(h.aprobado_en)}</div>}</td>
                        <td className="py-1.5 text-texto-2">{h.motivo}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-borde align-top">
                      <td className="py-1.5 font-mono text-xs">{codigo.version}</td>
                      <td className="py-1.5"><Etiqueta tono={codigoVigente ? "ok" : "neutro"}>{codigoVigente ? "vigente" : "retirada"}</Etiqueta></td>
                      <td className="py-1.5 text-xs">{codigo.autor}<div className="text-texto-3">{codigo.fecha}</div></td>
                      <td className="py-1.5 text-xs">Set de prueba CA04</td>
                      <td className="py-1.5 text-xs">{codigo.aprobadoPor}</td>
                      <td className="py-1.5 text-texto-2">{codigo.motivo}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-texto-3">
                Las versiones no se borran. Cada alerta guarda la versión del prompt que la generó, así cualquier resultado se puede reconstruir.
              </p>
            </Tarjeta>
          </section>
        ))}
      </div>
    </>
  );
}
