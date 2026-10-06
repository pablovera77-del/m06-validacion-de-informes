"use client";

import { useActionState } from "react";
import { cargarAccion, cargarDebito, type Estado } from "./acciones";

const campo = "rounded border border-borde px-2 py-1 text-sm";
const boton = "self-start rounded-md bg-marca px-4 py-1.5 text-sm text-white hover:bg-marca-oscuro disabled:opacity-50";

function Mensaje({ e }: { e: Estado }) {
  if (e.ok) return <p className="text-sm text-ok">✓ {e.ok}</p>;
  if (e.error) return <p className="text-sm text-roja">✗ {e.error}</p>;
  return null;
}

export function FormDebito() {
  const [estado, accion, pendiente] = useActionState(cargarDebito, {});
  return (
    <form action={accion} className="grid gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs text-texto-2">Mes<input name="mes" type="month" required className={campo} /></label>
      <label className="flex flex-col gap-1 text-xs text-texto-2">Causa
        <select name="causa" className={campo}><option value="informe">Error en el informe</option><option value="otra">Otra causa</option></select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-texto-2">Cantidad<input name="cantidad" type="number" min={0} required className={campo} /></label>
      <label className="flex flex-col gap-1 text-xs text-texto-2">Monto ($)<input name="monto" type="number" min={0} step="0.01" required className={campo} /></label>
      <label className="flex flex-col gap-1 text-xs text-texto-2">Financiador<input name="financiador" className={campo} /></label>
      <label className="flex flex-col gap-1 text-xs text-texto-2">Nota<input name="nota" className={campo} /></label>
      <button className={boton} disabled={pendiente}>Registrar débito</button>
      <Mensaje e={estado} />
    </form>
  );
}

export function FormAccion() {
  const [estado, accion, pendiente] = useActionState(cargarAccion, {});
  return (
    <form action={accion} className="grid gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs text-texto-2">Código<input name="id" placeholder="AC-004" required className={campo} /></label>
      <label className="flex flex-col gap-1 text-xs text-texto-2">Fecha<input name="fecha" type="date" required className={campo} /></label>
      <label className="col-span-full flex flex-col gap-1 text-xs text-texto-2">Patrón detectado<input name="patron" required className={campo} /></label>
      <label className="col-span-full flex flex-col gap-1 text-xs text-texto-2">Acción<input name="accion" required className={campo} /></label>
      <label className="flex flex-col gap-1 text-xs text-texto-2">Responsable<input name="responsable" required className={campo} /></label>
      <label className="flex flex-col gap-1 text-xs text-texto-2">Estado
        <select name="estado" className={campo}><option value="abierta">Abierta</option><option value="en_curso">En curso</option><option value="cerrada">Cerrada</option></select>
      </label>
      <button className={boton} disabled={pendiente}>Guardar acción</button>
      <Mensaje e={estado} />
    </form>
  );
}
