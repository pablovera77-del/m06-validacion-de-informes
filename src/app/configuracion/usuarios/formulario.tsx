"use client";

import { useActionState, useState } from "react";
import { cambiarClave, guardarUsuario } from "./acciones";

export function FormularioUsuario() {
  const [estado, accion, guardando] = useActionState(guardarUsuario, {});
  const [rol, setRol] = useState("medico");
  const campo = "rounded-md border border-borde bg-superficie px-3 py-1.5 text-sm focus:border-marca focus:outline-none";
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">Email<input name="email" type="email" required className={campo} /></label>
      <label className="flex flex-col gap-1 text-sm">Nombre<input name="nombre" required className={campo} /></label>
      <label className="flex flex-col gap-1 text-sm">
        Rol
        <select name="rol" value={rol} onChange={(e) => setRol(e.target.value)} className={campo}>
          <option value="medico">Médico informante</option>
          <option value="calidad">Calidad</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Código de médico {rol !== "medico" && <span className="text-xs text-texto-3">(solo rol médico)</span>}
        <input name="medicoId" placeholder="M04" disabled={rol !== "medico"} className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Contraseña inicial <span className="text-xs text-texto-3">Mínimo 10 caracteres. Dejala vacía si la cuenta ya existe y solo querés cambiar el rol.</span>
        <input name="clave" type="password" autoComplete="new-password" className={campo} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={guardando} className="rounded-md bg-marca px-4 py-1.5 text-sm text-white hover:bg-marca-oscuro disabled:opacity-50">{guardando ? "Guardando…" : "Guardar usuario"}</button>
        {estado.ok && <span className="text-sm text-ok">✓ {estado.ok}</span>}
        {estado.error && <span className="text-sm text-roja">{estado.error}</span>}
      </div>
    </form>
  );
}

/** Establecer o cambiar la contraseña de un usuario ya habilitado (la escribe el administrador; no se muestra ni se guarda en la app). */
export function FormularioClave({ email, tieneCuenta }: { email: string; tieneCuenta: boolean }) {
  const [estado, accion, guardando] = useActionState(cambiarClave, {});
  const [abierto, setAbierto] = useState(false);
  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-xs text-marca underline">
        {tieneCuenta ? "Cambiar contraseña" : "Establecer contraseña"}
      </button>
    );
  return (
    <form action={accion} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="email" value={email} />
      <input name="clave" type="password" autoComplete="new-password" placeholder="mín. 10 caracteres" className="w-36 rounded border border-borde px-2 py-1 text-xs" />
      <button disabled={guardando} className="rounded bg-marca px-2 py-1 text-xs text-white disabled:opacity-50">{guardando ? "…" : "Guardar"}</button>
      {estado.ok && <span className="text-xs text-ok">✓</span>}
      {estado.error && <span className="text-xs text-roja">{estado.error}</span>}
    </form>
  );
}
