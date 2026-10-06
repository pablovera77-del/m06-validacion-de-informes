import { CASOS_PRUEBA, DESCRIPCION_CRITERIO, type CasoPrueba, type Criterio } from "../data/casos-prueba";
import type { ConfigReglas } from "../config/reglas";
import { reglasVigentes } from "../config/reglas";
import { promptVigente } from "../config/prompts";
import type { Nivel, ResultadoValidacion } from "../domain/types";
import type { ProveedorLlm } from "./llm";
import { validarInforme } from "./motor";
import { nivelMaximo } from "./util";

export interface ResultadoCaso {
  caso: CasoPrueba;
  nivelObtenido: Nivel | null;
  estado: ResultadoValidacion["estado"];
  aprobado: boolean;
  titulos: string[];
}

export interface InformeValidacion {
  fecha: string;
  versionReglas: string;
  versionPrompts: string[];
  proveedor: string;
  total: number;
  aprobados: number;
  porCriterio: { criterio: Criterio; descripcion: string; total: number; aprobados: number }[];
  casos: ResultadoCaso[];
}

/** Ejecuta el set de prueba de referencia contra una versión de reglas (HU19). */
export async function ejecutarSetPrueba(opts: { reglas?: ConfigReglas; proveedor?: ProveedorLlm } = {}): Promise<InformeValidacion> {
  const reglas = opts.reglas ?? reglasVigentes();
  const casos: ResultadoCaso[] = [];
  let proveedor = "Simulador local (sin IA)";
  for (const caso of CASOS_PRUEBA) {
    const r = await validarInforme(caso.informe, { turno: caso.turno, historial: caso.historial }, { reglas, proveedor: opts.proveedor });
    const rv = r.resultados.find((x) => x.validacion === caso.esperado.validacion)!;
    if (rv.traza) proveedor = rv.traza.proveedor;
    const nivelObtenido = nivelMaximo(rv.alertas.map((a) => a.nivel));
    casos.push({
      caso,
      nivelObtenido,
      estado: rv.estado,
      aprobado: rv.estado !== "no_ejecutada" && nivelObtenido === caso.esperado.nivel,
      titulos: rv.alertas.map((a) => a.titulo),
    });
  }
  const criterios = [...new Set(CASOS_PRUEBA.map((c) => c.criterio))];
  return {
    fecha: new Date().toISOString(),
    versionReglas: reglas.version,
    versionPrompts: [promptVigente("V3A").version, promptVigente("V5").version],
    proveedor,
    total: casos.length,
    aprobados: casos.filter((c) => c.aprobado).length,
    porCriterio: criterios.map((criterio) => {
      const cs = casos.filter((c) => c.caso.criterio === criterio);
      return { criterio, descripcion: DESCRIPCION_CRITERIO[criterio], total: cs.length, aprobados: cs.filter((c) => c.aprobado).length };
    }),
    casos,
  };
}
