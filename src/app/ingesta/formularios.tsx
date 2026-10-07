"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { sincronizarDrive, subirTurnos, subirUnPdf, type EstadoIngesta } from "./acciones";
import type { ResultadoProceso } from "@/lib/ingesta/procesar";

type Fila = { nombre: string; estado: "en_cola" | "procesando" | "listo"; r?: ResultadoProceso };

/** Arrastrar y soltar informes PDF. Se procesan de a uno para mostrar cada resultado apenas termina. */
export function ZonaDeCarga({ habilitado, esMedico }: { habilitado: boolean; esMedico: boolean }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [encima, setEncima] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function procesar(lista: File[]) {
    const pdfs = lista.filter((f) => /\.pdf$/i.test(f.name)).slice(0, 50);
    const otros = lista.length - pdfs.length;
    if (!pdfs.length) {
      setFilas((x) => [{ nombre: `${otros} archivo(s)`, estado: "listo", r: { archivo: "", estado: "error", error: "Solo se aceptan PDF", advertencias: [] } }, ...x]);
      return;
    }
    const base = filas.length;
    setFilas((x) => [...x, ...pdfs.map((f) => ({ nombre: f.name, estado: "en_cola" as const }))]);
    setOcupado(true);
    for (let i = 0; i < pdfs.length; i++) {
      setFilas((x) => x.map((f, j) => (j === base + i ? { ...f, estado: "procesando" } : f)));
      const fd = new FormData();
      fd.set("pdf", pdfs[i]);
      let r: ResultadoProceso;
      try {
        r = await subirUnPdf(fd);
      } catch (e) {
        r = { archivo: pdfs[i].name, estado: "error", error: e instanceof Error ? e.message : "Error de conexión", advertencias: [] };
      }
      setFilas((x) => x.map((f, j) => (j === base + i ? { ...f, estado: "listo", r } : f)));
    }
    setOcupado(false);
  }

  return (
    <section className="rounded-lg border border-borde bg-superficie p-5">
      <h2 className="text-base">Subir informes PDF</h2>
      <p className="mt-1 text-sm text-texto-2">
        Arrastrá uno o varios informes exportados de Visual Medica. Cada uno se valida en segundos.
        {esMedico ? " Los informes que subas quedan asignados a vos." : " Si el informe no tiene turno cargado, queda «sin médico asignado» hasta que lo asignes."}
      </p>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={!habilitado}
        onClick={() => habilitado && input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && habilitado && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (habilitado) setEncima(true); }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => { e.preventDefault(); setEncima(false); if (habilitado) void procesar([...e.dataTransfer.files]); }}
        className={`mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
          !habilitado ? "cursor-not-allowed border-borde opacity-50" : encima ? "border-marca bg-marca-suave" : "border-borde hover:border-marca hover:bg-fondo"
        }`}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-marca" aria-hidden>
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-medium">{encima ? "Soltá los PDF acá" : "Arrastrá los PDF acá o hacé clic para elegirlos"}</span>
        <span className="text-xs text-texto-3">Hasta 4 MB por archivo · el PDF original no se modifica</span>
        <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { void procesar([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>

      {filas.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5" aria-live="polite">
          {filas.map((f, i) => (
            <li key={i} className="rounded-md bg-fondo px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{f.nombre}</span>
                {f.estado === "en_cola" && <span className="text-xs text-texto-3">En espera</span>}
                {f.estado === "procesando" && <span className="text-xs text-marca">Validando…</span>}
                {f.r?.estado === "procesado" && (
                  <span className="flex items-center gap-2 text-xs">
                    <span>{f.r.alertas ? `${f.r.alertas} alerta(s) · máx. ${f.r.nivelMaximo}` : "✓ Sin alertas"}</span>
                    <Link href={`/medico/${f.r.informeId}`} className="rounded border border-marca px-2 py-0.5 text-marca hover:bg-marca hover:text-white">Abrir</Link>
                  </span>
                )}
                {f.r?.estado === "ignorado" && <span className="text-xs text-texto-2">Ya estaba cargado (sin cambios)</span>}
                {f.r?.estado === "error" && <span className="text-xs text-roja">✗ {f.r.error}</span>}
              </div>
              {f.r && f.r.advertencias.length > 0 && <div className="mt-0.5 text-xs text-texto-2">{f.r.advertencias.join(" · ")}</div>}
            </li>
          ))}
        </ul>
      )}
      {ocupado && <p className="mt-2 text-xs text-texto-3">No cierres esta pantalla hasta que terminen.</p>}
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
