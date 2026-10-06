"use client";

import { useState } from "react";

const EJEMPLOS = {
  V3A: {
    hallazgos: "Mamas de densidad tipo B. Nódulo de 12 mm de márgenes irregulares en cuadrante superoexterno de mama derecha.",
    conclusion: "Estudio mamográfico sin hallazgos. BI-RADS 1.",
  },
  V5: {
    hallazgos: "VESÍCULA BILIAR: De forma ovoidea, pared conservada de xx mm de espesor.\nRiñón derecho: sin medidas.\nRiñón izquierdo: diámetro longitudinal 108 mm.",
    conclusion: "Ecografía abdominal dentro de parámetros normales.",
  },
};

/** "Probar con un caso": ejecuta el prompt vigente sobre un texto, sin registrar nada en el log real. */
export function ProbarPrompt({ validacion }: { validacion: "V3A" | "V5" }) {
  const [hallazgos, setHallazgos] = useState(EJEMPLOS[validacion].hallazgos);
  const [conclusion, setConclusion] = useState(EJEMPLOS[validacion].conclusion);
  const [res, setRes] = useState<null | { entrada: string; salida: unknown; alertas: { nivel: string; titulo: string }[]; proveedor: string }>(null);
  const [cargando, setCargando] = useState(false);

  async function probar() {
    setCargando(true);
    const r = await fetch("/api/probar-prompt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ validacion, hallazgos, conclusion }),
    });
    setRes(await r.json());
    setCargando(false);
  }

  return (
    <section className="rounded-lg border border-borde bg-superficie p-5">
      <h2 className="mb-3 text-base">Probar con un caso</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-texto-2">Hallazgos
            <textarea rows={4} value={hallazgos} onChange={(e) => setHallazgos(e.target.value)} className="rounded border border-borde p-2 text-sm text-texto" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-texto-2">Conclusión
            <textarea rows={2} value={conclusion} onChange={(e) => setConclusion(e.target.value)} className="rounded border border-borde p-2 text-sm text-texto" />
          </label>
          <button onClick={probar} disabled={cargando} className="self-start rounded-md bg-marca px-4 py-1.5 text-sm text-white hover:bg-marca-oscuro disabled:opacity-50">
            {cargando ? "Ejecutando…" : "Ejecutar prompt vigente"}
          </button>
          <p className="text-xs text-texto-3">No se usa ningún dato de paciente y no se registra en el log de producción.</p>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          {res ? (
            <>
              <div>
                <div className="mb-1 text-xs text-texto-2">Texto enviado al modelo ({res.proveedor})</div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-fondo p-2 font-mono text-xs">{res.entrada}</pre>
              </div>
              <div>
                <div className="mb-1 text-xs text-texto-2">Respuesta del modelo</div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-fondo p-2 font-mono text-xs">{JSON.stringify(res.salida, null, 2)}</pre>
              </div>
              <div>
                <div className="mb-1 text-xs text-texto-2">Alertas resultantes</div>
                {res.alertas.length ? (
                  <ul className="list-disc pl-5">{res.alertas.map((a, i) => <li key={i}><b>{a.nivel}</b>: {a.titulo}</li>)}</ul>
                ) : (
                  <p className="text-texto-2">Sin alertas.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-texto-2">Ejecutá el prompt para ver el texto enviado, la respuesta y la alerta que generaría.</p>
          )}
        </div>
      </div>
    </section>
  );
}
