"use client";

import Link from "next/link";
import { useActionState, useTransition, useState } from "react";
import { sincronizarDrive, subirPdfs, subirTurnos, type EstadoIngesta } from "./acciones";

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
              {r.advertencias.length > 0 && <div className="text-texto-2">Lectura: {r.advertencias.join(" · ")}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FormulariosIngesta({ habilitado, drive }: { habilitado: boolean; drive: boolean }) {
  const [estadoPdf, accionPdf, subiendo] = useActionState(subirPdfs, {});
  const [estadoTurnos, accionTurnos, subiendoTurnos] = useActionState(subirTurnos, {});
  const [estadoDrive, setEstadoDrive] = useState<EstadoIngesta>({});
  const [sincronizando, iniciar] = useTransition();
  const boton = "rounded-md bg-marca px-4 py-1.5 text-sm text-white hover:bg-marca-oscuro disabled:opacity-50";

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <section className="rounded-lg border border-borde bg-superficie p-5">
        <h2 className="text-base">1 · Planilla de turnos</h2>
        <p className="mt-1 text-sm text-texto-2">Simula los turnos de Visual Medica. CSV con columnas turno_id, apellido_nombre, dni, fecha_nacimiento, tipo_estudio, medico_id.</p>
        <form action={accionTurnos} className="mt-3 flex flex-col gap-2">
          <input type="file" name="csv" accept=".csv,text/csv" disabled={!habilitado} className="text-sm" />
          <button className={boton} disabled={!habilitado || subiendoTurnos}>{subiendoTurnos ? "Cargando…" : "Cargar turnos"}</button>
        </form>
        <Resultado estado={estadoTurnos} />
      </section>

      <section className="rounded-lg border border-borde bg-superficie p-5">
        <h2 className="text-base">2 · Subir informes PDF</h2>
        <p className="mt-1 text-sm text-texto-2">Hasta 20 archivos por envío, 4 MB en total. El número de turno se toma del PDF o del nombre del archivo («Estudio ID», por ejemplo 62425201.pdf).</p>
        <form action={accionPdf} className="mt-3 flex flex-col gap-2">
          <input type="file" name="pdf" accept="application/pdf" multiple disabled={!habilitado} className="text-sm" />
          <button className={boton} disabled={!habilitado || subiendo}>{subiendo ? "Procesando…" : "Validar informes"}</button>
        </form>
        <Resultado estado={estadoPdf} />
      </section>

      <section className="rounded-lg border border-borde bg-superficie p-5">
        <h2 className="text-base">3 · Sincronizar Google Drive</h2>
        <p className="mt-1 text-sm text-texto-2">Lee la planilla de turnos y los PDF nuevos o modificados de la carpeta 01_Informes_a_validar. Solo lectura.</p>
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
