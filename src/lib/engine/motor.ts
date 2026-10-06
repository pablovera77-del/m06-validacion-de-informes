import { reglasVigentes, type ConfigReglas } from "../config/reglas";
import type { ContextoValidacion, Informe, ResultadoInforme } from "../domain/types";
import type { ProveedorLlm } from "./llm";
import { validarBirads, validarOrganos } from "./ia";
import { nivelMaximo } from "./util";
import { validarCampos } from "./v1-campos";
import { validarDuplicado } from "./v2-duplicado";
import { validarDensitometria } from "./v3b-densitometria";
import { validarIdentidad } from "./v4-identidad";

export interface OpcionesMotor {
  reglas?: ConfigReglas;
  proveedor?: ProveedorLlm;
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
    await validarBirads(informe, reglas, opts.proveedor),
    validarDensitometria(informe, reglas),
    validarIdentidad(informe, ctx, reglas),
    await validarOrganos(informe, reglas, opts.proveedor),
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
