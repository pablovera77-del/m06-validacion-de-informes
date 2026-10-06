import { createHash } from "node:crypto";
import type { Alerta, CodigoValidacion, Evidencia, Nivel } from "../domain/types";

const ORDEN: Record<Nivel, number> = { azul: 1, amarilla: 2, naranja: 3, roja: 4 };

export function nivelMaximo(niveles: Nivel[]): Nivel | null {
  return niveles.reduce<Nivel | null>((max, n) => (!max || ORDEN[n] > ORDEN[max] ? n : max), null);
}

export function compararNivel(a: Nivel, b: Nivel): number {
  return ORDEN[a] - ORDEN[b];
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Crea una alerta con id determinístico (mismo informe + misma detección → mismo id). */
export function crearAlerta(params: {
  informeId: string;
  validacion: CodigoValidacion;
  nivel: Nivel;
  titulo: string;
  detalle: string;
  evidencia?: Evidencia[];
  versionReglas: string;
  versionPrompt?: string;
  clave?: string;
}): Alerta {
  const id = sha256(`${params.informeId}|${params.validacion}|${params.clave ?? params.titulo}`).slice(0, 16);
  return {
    id,
    informeId: params.informeId,
    validacion: params.validacion,
    nivel: params.nivel,
    titulo: params.titulo,
    detalle: params.detalle,
    evidencia: params.evidencia ?? [],
    versionReglas: params.versionReglas,
    versionPrompt: params.versionPrompt,
    estado: "pendiente",
  };
}
