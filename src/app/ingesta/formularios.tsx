"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { sincronizarDrive, subirTurnos, subirUnPdf, type EstadoIngesta } from "./acciones";
import type { ResultadoProceso } from "@/lib/ingesta/procesar";
import type { Nivel } from "@/lib/domain/types";
import { InsigniaNivel } from "@/components/ui";

type Fila = { id: number; nombre: string; estado: "en_cola" | "procesando" | "listo"; inicio?: number; fin?: number; r?: ResultadoProceso };

const FRANJA: Record<Nivel, string> = { azul: "bg-azul", amarilla: "bg-amarilla", naranja: "bg-naranja", roja: "bg-roja" };
const NOMBRE_NIVEL: Record<Nivel, string> = { azul: "Informativa", amarilla: "Advertencia", naranja: "Crítica", roja: "Crítica de identidad" };

function Spinner() {
  return (
    <svg className="h-5 w-5 motion-safe:animate-spin text-marca" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Segundos transcurridos mientras se valida un informe (dato real, no una estimación). */
function Cronometro({ desde }: { desde: number }) {
  const [ahora, setAhora] = useState(desde);
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{Math.max(0, Math.round((ahora - desde) / 1000))} s</span>;
}

/** Tarjeta de cada informe: en espera, validando (con tiempo) o resultado con su nivel y acceso directo. */
export function FilaInforme({ f }: { f: Fila }) {
  const r = f.r;
  const nivel = (r?.nivelMaximo ?? null) as Nivel | null;
  const franja =
    f.estado !== "listo" ? "bg-borde" : r?.estado === "error" ? "bg-roja" : r?.estado === "ignorado" ? "bg-gris-claro" : nivel ? FRANJA[nivel] : "bg-ok";
  return (
    <li className={`relative overflow-hidden rounded-lg border bg-superficie pl-4 ${f.estado === "procesando" ? "border-marca shadow-sm" : "border-borde"}`}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${franja}`} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 pr-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{f.nombre}</div>
          <div className="mt-0.5 text-sm text-texto-2">
            {f.estado === "en_cola" && "En espera"}
            {f.estado === "procesando" && (
              <span className="text-marca-oscuro">
                Leyendo el PDF y ejecutando las validaciones… <Cronometro desde={f.inicio!} />
              </span>
            )}
            {r?.estado === "procesado" &&
              (r.alertas ? (
                <span className="flex flex-wrap items-center gap-2">
                  <InsigniaNivel nivel={nivel!} corto />
                  <span>{r.alertas === 1 ? "1 alerta para revisar" : `${r.alertas} alertas para revisar`} · nivel más alto: {NOMBRE_NIVEL[nivel!].toLowerCase()}</span>
                </span>
              ) : (
                <span className="font-medium text-ok">✓ Validado sin alertas</span>
              ))}
            {r?.estado === "ignorado" && "Este informe ya estaba cargado y no cambió."}
            {r?.estado === "error" && <span className="text-roja">No se pudo procesar: {r.error}</span>}
          </div>
          {r && r.advertencias.length > 0 && <div className="mt-1 text-xs text-texto-3">{r.advertencias.join(" · ")}</div>}
        </div>
        <div className="flex items-center gap-3">
          {f.estado === "procesando" && <Spinner />}
          {f.estado === "en_cola" && <span className="text-xs text-texto-3">#{f.id + 1}</span>}
          {f.fin && f.inicio && <span className="text-xs tabular-nums text-texto-3">{Math.max(1, Math.round((f.fin - f.inicio) / 1000))} s</span>}
          {r?.estado === "procesado" && (
            <Link href={`/medico/${r.informeId}`} className="rounded-md bg-marca px-3 py-1.5 text-sm font-medium text-white hover:bg-marca-oscuro">
              {r.alertas ? "Revisar alertas" : "Ver informe"}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

/** Arrastrar y soltar informes PDF. Se procesan de a uno para mostrar cada resultado apenas termina. */
export function ZonaDeCarga({ habilitado, esMedico }: { habilitado: boolean; esMedico: boolean }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [encima, setEncima] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const contador = useRef(0);

  async function procesar(lista: File[]) {
    if (ocupado) return;
    const pdfs = lista.filter((f) => /\.pdf$/i.test(f.name)).slice(0, 50);
    const descartados = lista.length - pdfs.length;
    setAviso(descartados ? `${descartados} archivo(s) no son PDF y no se cargaron.` : null);
    if (!pdfs.length) return;
    const nuevas: Fila[] = pdfs.map((f) => ({ id: contador.current++, nombre: f.name, estado: "en_cola" }));
    setFilas(nuevas);
    setOcupado(true);
    for (let i = 0; i < pdfs.length; i++) {
      const id = nuevas[i].id;
      const inicio = Date.now();
      setFilas((x) => x.map((f) => (f.id === id ? { ...f, estado: "procesando", inicio } : f)));
      const fd = new FormData();
      fd.set("pdf", pdfs[i]);
      let r: ResultadoProceso;
      try {
        r = await subirUnPdf(fd);
      } catch (e) {
        r = { archivo: pdfs[i].name, estado: "error", error: e instanceof Error ? e.message : "Error de conexión", advertencias: [] };
      }
      const fin = Date.now();
      setFilas((x) => x.map((f) => (f.id === id ? { ...f, estado: "listo", fin, r } : f)));
    }
    setOcupado(false);
  }

  const listos = filas.filter((f) => f.estado === "listo");
  const conAlertas = listos.filter((f) => f.r?.estado === "procesado" && f.r.alertas);
  const sinAlertas = listos.filter((f) => f.r?.estado === "procesado" && !f.r.alertas);
  const errores = listos.filter((f) => f.r?.estado === "error");
  const terminado = filas.length > 0 && !ocupado;
  const pct = filas.length ? Math.round((listos.length / filas.length) * 100) : 0;

  return (
    <section className="rounded-xl border border-borde bg-superficie p-5 md:p-6">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={!habilitado || ocupado}
        onClick={() => habilitado && !ocupado && input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && habilitado && !ocupado && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (habilitado && !ocupado) setEncima(true); }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => { e.preventDefault(); setEncima(false); if (habilitado && !ocupado) void procesar([...e.dataTransfer.files]); }}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 text-center transition-colors ${
          filas.length ? "py-6" : "min-h-52 py-10"
        } ${
          !habilitado || ocupado ? "cursor-not-allowed border-borde bg-fondo" : encima ? "cursor-copy border-marca bg-marca-suave" : "cursor-pointer border-gris-claro hover:border-marca hover:bg-fondo"
        }`}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={ocupado ? "text-texto-3" : "text-marca"} aria-hidden>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 17v-6m0 0-2.5 2.5M12 11l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-titulo text-lg">
          {ocupado ? "Validando informes…" : encima ? "Soltá los informes para validarlos" : "Arrastrá los informes PDF acá"}
        </span>
        <span className="text-sm text-texto-2">
          {ocupado ? "Podés seguir mirando esta pantalla; no la cierres hasta que termine." : (
            <>o <span className="font-medium text-marca underline">elegilos desde tu computadora</span> · hasta 4 MB por archivo</>
          )}
        </span>
        <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { void procesar([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>
      <p className="mt-3 text-sm text-texto-2">
        {esMedico ? "Los informes que subas quedan asignados a vos y aparecen en «Informes a firmar»." : "Sin turno cargado, el informe queda «sin médico asignado» hasta que lo asignes."} El PDF original no se modifica.
      </p>
      {aviso && <p className="mt-2 text-sm text-amarilla">{aviso}</p>}

      {filas.length > 0 && (
        <div className="mt-6" aria-live="polite">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base">
              {terminado ? "Validación terminada" : `Validando ${Math.min(listos.length + 1, filas.length)} de ${filas.length}`}
            </h2>
            <span className="text-sm tabular-nums text-texto-2">{listos.length} de {filas.length} listos</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fondo" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de la validación">
            <div className="h-full rounded-full bg-marca transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>

          {terminado && (
            <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 ${conAlertas.length ? "bg-naranja-fondo" : errores.length ? "bg-roja-fondo" : "bg-ok-fondo"}`}>
              <p className="text-sm">
                <b>{listos.length === 1 ? "1 informe procesado" : `${listos.length} informes procesados`}.</b>{" "}
                {[
                  conAlertas.length && `${conAlertas.length} con alertas para revisar antes de firmar`,
                  sinAlertas.length && `${sinAlertas.length} sin alertas`,
                  errores.length && `${errores.length} con error`,
                ].filter(Boolean).join(" · ")}
              </p>
              <Link href="/medico" className="rounded-md border border-marca bg-superficie px-3 py-1.5 text-sm font-medium text-marca hover:bg-marca hover:text-white">
                Ir a informes a firmar
              </Link>
            </div>
          )}

          <ul className="mt-4 flex flex-col gap-2">
            {filas.map((f) => <FilaInforme key={f.id} f={f} />)}
          </ul>
        </div>
      )}
    </section>
  );
}

function Resultado({ estado }: { estado: EstadoIngesta }) {
  if (!estado.mensaje && !estado.error) return null;
  return (
    <div className="mt-3 text-sm">
      {estado.error && <p className="text-roja">✗ {estado.error}</p>}
      {estado.mensaje && <p className="text-ok">✓ {estado.mensaje}</p>}
      {estado.resultados && estado.resultados.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {estado.resultados.map((r, i) => (
            <li key={i} className="rounded bg-fondo px-2 py-1 text-xs">
              <b>{r.archivo}</b> · {r.estado}
              {r.informeId && (
                <> · <Link href={`/medico/${r.informeId}`} className="text-marca underline">{r.informeId}</Link> · {r.alertas} alerta(s){r.nivelMaximo ? ` · máx. ${r.nivelMaximo}` : ""}</>
              )}
              {r.error && <> · {r.error}</>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Fuentes opcionales: planilla de turnos (simula Visual Medica para V4) y sincronización de Drive. Solo Calidad y Administración. */
export function FuentesOpcionales({ habilitado, drive }: { habilitado: boolean; drive: boolean }) {
  const [estadoTurnos, accionTurnos, subiendoTurnos] = useActionState(subirTurnos, {});
  const [estadoDrive, setEstadoDrive] = useState<EstadoIngesta>({});
  const [sincronizando, iniciar] = useTransition();
  const boton = "rounded-md bg-marca px-4 py-1.5 text-sm text-white hover:bg-marca-oscuro disabled:opacity-50";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-borde bg-superficie p-5">
        <h2 className="text-base">Datos de Visual Medica (simulados) · opcional</h2>
        <p className="mt-1 text-sm text-texto-2">
          Con la planilla de turnos, V4 verifica la identidad del paciente y el informe se asigna solo al médico del turno.
          Sin planilla, los informes se validan igual (V1, V2, V3, V5) y la identidad queda «sin verificar».
          En la etapa 2 estos datos vienen directo de Visual Medica. CSV: turno_id, apellido_nombre, dni, fecha_nacimiento, tipo_estudio, medico_id.
        </p>
        <form action={accionTurnos} className="mt-3 flex flex-col gap-2">
          <input type="file" name="csv" accept=".csv,text/csv" disabled={!habilitado} className="text-sm" />
          <button className={boton} disabled={!habilitado || subiendoTurnos}>{subiendoTurnos ? "Cargando…" : "Cargar turnos"}</button>
        </form>
        <Resultado estado={estadoTurnos} />
      </section>

      <section className="rounded-lg border border-borde bg-superficie p-5">
        <h2 className="text-base">Carpeta de Google Drive · opcional</h2>
        <p className="mt-1 text-sm text-texto-2">Para cargas masivas: lee los PDF nuevos o modificados de 01_Informes_a_validar. Solo lectura.</p>
        <button
          className={`${boton} mt-3`}
          disabled={!habilitado || !drive || sincronizando}
          onClick={() => iniciar(async () => setEstadoDrive(await sincronizarDrive()))}
        >
          {sincronizando ? "Sincronizando…" : "Sincronizar ahora"}
        </button>
        {!drive && <p className="mt-2 text-xs text-texto-3">Falta configurar la cuenta de servicio de Google en Vercel.</p>}
        <Resultado estado={estadoDrive} />
      </section>
    </div>
  );
}
