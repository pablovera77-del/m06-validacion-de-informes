"use client";

import { useActionState, useState, type ReactNode } from "react";
import { aprobar, guardar } from "./acciones";

/** Editor del texto de instrucciones. Guarda siempre como borrador: nunca cambia la versión vigente directamente. */
export function EditorPrompt({ validacion, textoInicial, motivoInicial = "", hayBorrador, habilitado, children }: {
  validacion: "V3A" | "V5";
  /** Vista de solo lectura que se muestra mientras no se edita. */
  children: ReactNode;
  textoInicial: string;
  motivoInicial?: string;
  hayBorrador: boolean;
  habilitado: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, guardando] = useActionState(guardar, {});
  const [texto, setTexto] = useState(textoInicial);
  const cambio = texto.trim() !== textoInicial.trim();

  if (!abierto)
    return (
      <div className="flex flex-col gap-3">
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!habilitado}
          onClick={() => setAbierto(true)}
          className="rounded-md bg-marca px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-oscuro disabled:opacity-50"
        >
          {hayBorrador ? "Seguir editando el borrador" : "Editar instrucciones"}
        </button>
        {estado.ok && <span className="text-sm text-ok">✓ {estado.ok}</span>}
        {!habilitado && <span className="text-xs text-texto-3">Requiere la base de datos configurada.</span>}
      </div>
      </div>
    );

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="validacion" value={validacion} />
      <label className="flex flex-col gap-1 text-sm">
        Instrucciones del sistema
        <textarea
          name="sistema"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={22}
          spellCheck
          className="rounded-md border border-borde bg-superficie p-3 font-mono text-xs leading-relaxed focus:border-marca focus:outline-none"
        />
        <span className="text-xs text-texto-3">{texto.length.toLocaleString("es-AR")} caracteres · el formato de respuesta (esquema) y la regla de nivel no se editan acá: los aplica el código.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Motivo del cambio
        <input name="motivo" defaultValue={motivoInicial} required minLength={5} maxLength={500} placeholder="Ej.: reducir falsos positivos en BI-RADS 2 con quistes simples" className="rounded-md border border-borde px-3 py-1.5 text-sm focus:border-marca focus:outline-none" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={guardando || (!cambio && !hayBorrador)} className="rounded-md bg-marca px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-oscuro disabled:opacity-50">
          {guardando ? "Guardando…" : "Guardar borrador"}
        </button>
        <button type="button" onClick={() => { setTexto(textoInicial); setAbierto(false); }} className="text-sm text-texto-2 underline">Cancelar</button>
        {estado.error && <span className="text-sm text-roja">{estado.error}</span>}
        {estado.ok && <span className="text-sm text-ok">✓ {estado.ok}</span>}
      </div>
    </form>
  );
}

export function AprobarBorrador({ id, version, probado }: { id: string; version: string; probado: boolean }) {
  const [estado, accion, enviando] = useActionState(aprobar, {});
  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirmo" value="si" disabled={!probado} className="mt-0.5 accent-[var(--marca)]" />
        <span>Revisé los cambios y el resultado de la prueba. Apruebo que {version} reemplace a la versión vigente.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={!probado || enviando} className="rounded-md bg-marca px-4 py-1.5 text-sm font-medium text-white hover:bg-marca-oscuro disabled:opacity-50">
          {enviando ? "Aprobando…" : "Aprobar y poner vigente"}
        </button>
        {!probado && <span className="text-xs text-texto-3">Se habilita después de probar el borrador con el modelo real.</span>}
        {estado.error && <span className="text-sm text-roja">{estado.error}</span>}
        {estado.ok && <span className="text-sm text-ok">✓ {estado.ok}</span>}
      </div>
    </form>
  );
}
