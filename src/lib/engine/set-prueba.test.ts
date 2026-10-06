import { describe, expect, it } from "vitest";
import { ejecutarSetPrueba } from "./ejecutar-pruebas";

describe("Set de prueba de referencia (CA01–CA08)", async () => {
  const informe = await ejecutarSetPrueba();
  for (const r of informe.casos) {
    it(`${r.caso.id} · ${r.caso.descripcion}`, () => {
      expect(r.estado).not.toBe("no_ejecutada");
      expect(r.nivelObtenido, r.titulos.join(" | ")).toBe(r.caso.esperado.nivel);
    });
  }
  it("CA01: tiene al menos 20 casos de identidad", () => {
    expect(informe.casos.filter((c) => c.caso.criterio === "CA01").length).toBeGreaterThanOrEqual(20);
  });
  it("CA04: tiene al menos 10 casos BI-RADS", () => {
    expect(informe.casos.filter((c) => c.caso.criterio === "CA04").length).toBeGreaterThanOrEqual(10);
  });
});
