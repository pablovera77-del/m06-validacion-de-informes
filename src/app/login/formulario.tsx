"use client";

import { useActionState } from "react";
import { ingresar } from "./acciones";

export function FormularioLogin({ volver }: { volver?: string }) {
  const [estado, accion, enviando] = useActionState(ingresar, {});
  const campo = "w-full rounded-md border border-borde bg-superficie px-3 py-2 text-sm focus:border-marca focus:outline-none";
  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="volver" value={volver ?? ""} />
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" autoComplete="username" required className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contraseña
        <input name="clave" type="password" autoComplete="current-password" required className={campo} />
      </label>
      {estado.error && <p className="text-sm text-roja">{estado.error}</p>}
      <button disabled={enviando} className="mt-1 rounded-md bg-marca px-4 py-2 font-medium text-white hover:bg-marca-oscuro disabled:opacity-50">
        {enviando ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
