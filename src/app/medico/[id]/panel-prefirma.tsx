"use client";

import { useState } from "react";
import type { Alerta } from "@/lib/domain/types";
import { NOMBRE_VALIDACION } from "@/lib/domain/types";
import { InsigniaNivel, estiloNivel } from "@/components/ui";

type Accion = { revisada?: boolean; justificacion?: string; incorrecta?: string };

const ORDEN = { roja: 0, naranja: 1, amarilla: 2, azul: 3 } as const;

export function PanelPrefirma({ informeId, alertas, incompleto, firmado: yaFirmado = false }: { informeId: string; alertas: Alerta[]; incompleto: boolean; firmado?: boolean }) {
  const [acciones, setAcciones] = useState<Record<string, Accion>>({});
  const [firmado, setFirmado] = useState<null | { registro: string }>(yaFirmado ? { registro: "Firmado anteriormente." } : null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const ordenadas = [...alertas].sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel]);

  const set = (id: string, a: Accion) => setAcciones((s) => ({ ...s, [id]: { ...s[id], ...a } }));
  const pendiente = (a: Alerta) => {
    const ac = acciones[a.id] ?? {};
    if (ac.incorrecta?.trim()) return false;
    if (a.nivel === "amarilla") return !ac.revisada;
    if (a.nivel === "roja") return !(ac.justificacion && ac.justificacion.trim().length >= 10);
    return false;
  };
  const faltan = ordenadas.filter(pendiente);

  async function firmar() {
    const res = await fetch("/api/acciones", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ informeId, acciones: ordenadas.map((a) => ({ alertaId: a.id, validacion: a.validacion, nivel: a.nivel, ...acciones[a.id] })) }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setError(j.error ?? "No se pudo registrar la firma");
    setFirmado({ registro: j.hash ? `Registrado en el log (entrada ${j.secuencia}, hash ${String(j.hash).slice(0, 12)}…)` : "Registrado" });
  }

  return (
    <section className="rounded-lg border border-borde bg-superficie">
      <header className="border-b border-borde px-5 py-4">
        <h2 className="text-base">Revisión antes de firmar</h2>
        <p className="mt-1 text-xs text-texto-2">
          {alertas.length === 0 ? "No se detectaron alertas." : `${alertas.length} alerta${alertas.length > 1 ? "s" : ""}. Ninguna bloquea la firma.`}
        </p>
      </header>

      {incompleto && (
        <div className="mx-5 mt-4 rounded-md border border-amarilla/40 bg-amarilla-fondo px-3 py-2 text-xs">
          Alguna validación no pudo ejecutarse. Esto no significa que el informe esté correcto.
        </div>
      )}

      <ul className="flex flex-col gap-3 p-5">
        {ordenadas.map((a) => {
          const e = estiloNivel(a.nivel);
          const ac = acciones[a.id] ?? {};
          return (
            <li key={a.id} className={`rounded-md border-l-4 ${e.borde} border border-borde bg-superficie p-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <InsigniaNivel nivel={a.nivel} corto />
                <span className="text-xs text-texto-2">{a.validacion} · {NOMBRE_VALIDACION[a.validacion]}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{a.titulo}</p>
              <p className="mt-1 text-sm text-texto-2">{a.detalle}</p>
              {a.evidencia.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {a.evidencia.map((ev, i) => (
                    <blockquote key={i} className="rounded bg-fondo px-2 py-1 text-xs">
                      <span className="mr-1 uppercase tracking-wide text-texto-3">{ev.seccion}:</span>
                      {ev.fragmento}
                    </blockquote>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2 text-sm">
                {a.nivel === "amarilla" && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!ac.revisada} onChange={(ev) => set(a.id, { revisada: ev.target.checked })} className="size-4 accent-[var(--marca)]" />
                    Revisé esta alerta
                  </label>
                )}
                {(a.nivel === "roja" || a.nivel === "naranja") && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-texto-2">
                      {a.nivel === "roja" ? "Si firmás sin corregir, escribí la justificación (obligatoria)" : "Justificación si firmás sin corregir (opcional)"}
                    </span>
                    <textarea
                      rows={2}
                      value={ac.justificacion ?? ""}
                      onChange={(ev) => set(a.id, { justificacion: ev.target.value })}
                      className="rounded border border-borde px-2 py-1 text-sm"
                    />
                  </label>
                )}
                {abierta === a.id ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-texto-2">¿Por qué la alerta es incorrecta?</span>
                    <input value={ac.incorrecta ?? ""} onChange={(ev) => set(a.id, { incorrecta: ev.target.value })} className="rounded border border-borde px-2 py-1 text-sm" />
                  </label>
                ) : (
                  <button type="button" onClick={() => setAbierta(a.id)} className="self-start text-xs text-texto-2 underline hover:text-marca">
                    Marcar como alerta incorrecta
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="border-t border-borde px-5 py-4">
        {firmado ? (
          <p className="text-sm text-ok">✓ Informe firmado. {firmado.registro}</p>
        ) : (
          <>
            {faltan.length > 0 && (
              <p className="mb-2 text-xs text-texto-2">
                Para firmar: {faltan.map((a) => (a.nivel === "amarilla" ? "tildá «Revisé»" : "escribí la justificación")).filter((v, i, xs) => xs.indexOf(v) === i).join(" y ")} en las alertas señaladas.
              </p>
            )}
            {error && <p className="mb-2 text-sm text-roja">{error}</p>}
            <button
              type="button"
              disabled={faltan.length > 0}
              onClick={firmar}
              className="w-full rounded-md bg-marca px-4 py-2 font-medium text-white hover:bg-marca-oscuro disabled:cursor-not-allowed disabled:opacity-50"
            >
              Firmar informe
            </button>
            <p className="mt-2 text-[11px] text-texto-3">Demo: la firma real ocurre en el sistema de origen. Acá solo se registra la decisión en el log.</p>
          </>
        )}
      </footer>
    </section>
  );
}
