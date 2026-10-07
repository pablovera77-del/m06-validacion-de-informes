import { afterEach, describe, expect, it, vi } from "vitest";
import { CASOS_PRUEBA } from "../data/casos-prueba";
import { validarInforme } from "./motor";

/** Protección de costos: los datos sintéticos nunca deben llamar al modelo de pago, aunque esté configurado. */
describe("uso del modelo de IA", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("con la API de Anthropic configurada, la demo y el set de prueba usan el simulador", async () => {
    vi.stubEnv("M06_LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "clave-de-prueba-invalida");
    const caso = CASOS_PRUEBA.find((c) => c.informe.tipoEstudio === "mamografia")!;
    const r = await validarInforme(caso.informe, { turno: caso.turno, historial: caso.historial });
    const v3a = r.resultados.find((x) => x.validacion === "V3A")!;
    expect(v3a.estado).toBe("ejecutada");
    expect(v3a.traza?.proveedor).toBe("Simulador local (sin IA)");
  });
});
