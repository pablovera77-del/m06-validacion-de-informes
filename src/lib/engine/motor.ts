import { reglasVigentes, type ConfigReglas } from "../config/reglas";
import type { ContextoValidacion, Informe, ResultadoInforme } from "../domain/types";
import { proveedorConfigurado, type ProveedorLlm } from "./llm";

/** Proveedor real solo si se pide explícitamente; undefined → simulador local. */
function proveedorSegun(usarIa?: boolean): ProveedorLlm | undefined {
  return usarIa ? (proveedorConfigurado() ?? undefined) : undefined;
}
import { validarBirads, validarOrganos } from "./ia";
import { nivelMaximo } from "./util";
import { validarCampos } from "./v1-campos";
import { validarDuplicado } from "./v2-duplicado";
import { validarDensitometria } from "./v3b-densitometria";
import { validarIdentidad } from "./v4-identidad";

export interface OpcionesMotor {
  reglas?: ConfigReglas;
  proveedor?: ProveedorLlm;
  /**
   * true = usar el modelo de IA configurado (solo informes reales: ingesta y API).
   * Por defecto se usa el simulador local: los datos sintéticos de la demo y el set de prueba
   * nunca consumen la API de pago.
   */
  usarIa?: boolean;
  ahora?: Date;
}

/**
 * Ejecuta las validaciones sobre un informe. Solo lee: no modifica el informe ni bloquea la firma.
 * Cada validación es independiente; si una falla, las demás se ejecutan igual.
 */
export async function validarInforme(informe: Informe, ctx: ContextoValidacion, opts: OpcionesMotor = {}): Promise<ResultadoInforme> {
  const reglas = opts.reglas ?? reglasVigentes();
  const resultados = [
    validarCampos(informe, reglas),
    validarDuplicado(informe, ctx, reglas),
    await validarBirads(informe, reglas, opts.proveedor ?? proveedorSegun(opts.usarIa)),
    validarDensitometria(informe, reglas),
    validarIdentidad(informe, ctx, reglas),
    await validarOrganos(informe, reglas, opts.proveedor ?? proveedorSegun(opts.usarIa)),
  ];
  const alertas = resultados.flatMap((r) => r.alertas);
  return {
    informeId: informe.id,
    fecha: (opts.ahora ?? new Date()).toISOString(),
    versionReglas: reglas.version,
    resultados,
    alertas,
    nivelMaximo: nivelMaximo(alertas.map((a) => a.nivel)),
    incompleto: resultados.some((r) => r.estado === "no_ejecutada"),
  };
}
