import { sha256 } from "../engine/util";

/**
 * Log de auditoría de solo agregado con cadena de hash (HU9, HU22).
 * Cada entrada guarda el hash de la anterior: modificar o borrar una entrada rompe la cadena
 * y la verificación lo detecta (Ley 26.529 art. 13: integridad e inalterabilidad).
 */

export type TipoEvento =
  | "validacion_ejecutada"
  | "alerta_generada"
  | "validacion_no_ejecutada"
  | "alerta_revisada"
  | "alerta_override"
  | "alerta_marcada_incorrecta"
  | "informe_firmado"
  | "informe_corregido"
  | "auditoria_muestra"
  | "configuracion_cambiada"
  | "sesion_iniciada"
  | "usuario_creado"
  | "usuario_modificado"
  | "informe_asignado"
  | "prompt_borrador_guardado"
  | "prompt_probado"
  | "prompt_activado"
  | "prompt_descartado";

export interface EntradaLog {
  secuencia: number;
  fecha: string;
  tipo: TipoEvento;
  actor: string;
  informeId?: string;
  datos: Record<string, unknown>;
  hashAnterior: string;
  hash: string;
}

export const HASH_INICIAL = "0".repeat(64);

/** JSON con claves ordenadas: la base de datos puede devolver las claves de un objeto en otro orden. */
export function jsonCanonico(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(jsonCanonico).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${jsonCanonico(o[k])}`).join(",")}}`;
}

export function calcularHash(e: Omit<EntradaLog, "hash">): string {
  return sha256(jsonCanonico([e.secuencia, e.fecha, e.tipo, e.actor, e.informeId ?? null, e.datos, e.hashAnterior]));
}

export class LogAuditoria {
  private entradas: EntradaLog[] = [];

  registrar(e: { fecha: string; tipo: TipoEvento; actor: string; informeId?: string; datos?: Record<string, unknown> }): EntradaLog {
    const anterior = this.entradas.at(-1);
    const base = {
      secuencia: (anterior?.secuencia ?? 0) + 1,
      fecha: e.fecha,
      tipo: e.tipo,
      actor: e.actor,
      informeId: e.informeId,
      datos: e.datos ?? {},
      hashAnterior: anterior?.hash ?? HASH_INICIAL,
    };
    const entrada: EntradaLog = Object.freeze({ ...base, hash: calcularHash(base) });
    this.entradas.push(entrada);
    return entrada;
  }

  listar(): readonly EntradaLog[] {
    return this.entradas;
  }
}

export interface ResultadoVerificacion {
  integro: boolean;
  entradasVerificadas: number;
  primeraFalla?: { secuencia: number; motivo: string };
}

/** Recalcula la cadena completa. Sirve para el auditor y para la exportación (HU22). */
export function verificarCadena(entradas: readonly EntradaLog[]): ResultadoVerificacion {
  let anterior = HASH_INICIAL;
  for (let i = 0; i < entradas.length; i++) {
    const e = entradas[i];
    if (e.secuencia !== i + 1) return { integro: false, entradasVerificadas: i, primeraFalla: { secuencia: e.secuencia, motivo: "Secuencia faltante o desordenada" } };
    if (e.hashAnterior !== anterior) return { integro: false, entradasVerificadas: i, primeraFalla: { secuencia: e.secuencia, motivo: "El hash anterior no coincide: se borró o alteró una entrada previa" } };
    const { hash, ...resto } = e;
    if (calcularHash(resto) !== hash) return { integro: false, entradasVerificadas: i, primeraFalla: { secuencia: e.secuencia, motivo: "El contenido de la entrada fue modificado" } };
    anterior = hash;
  }
  return { integro: true, entradasVerificadas: entradas.length };
}
