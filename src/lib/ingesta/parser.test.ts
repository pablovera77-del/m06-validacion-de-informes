import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { leerInforme, unirLineas } from "./parser";
import { textoDePdf } from "./pdf";

const fixture = (n: string) => new Uint8Array(readFileSync(path.join(__dirname, "../../../fixtures/pdf", n)));

describe("lectura de PDF", () => {
  it("une cortes de línea dentro de una oración", () => {
    expect(unirLineas("midiendo xx\nmm.\nBAZO: normal.")).toBe("midiendo xx mm.\nBAZO: normal.");
  });

  it("lee encabezado, secciones y firma de una ecografía", async () => {
    const r = leerInforme(await textoDePdf(fixture("T-900004_ecografia_abdominal.pdf")));
    expect(r.encabezado).toEqual({ apellidoNombre: "LÓPEZ, Carlos", dni: "30.555.444", fechaNacimiento: "01/02/1980", tipoEstudio: "Ecografía abdominal" });
    expect(r.turnoId).toBe("T-900004");
    expect(r.secciones.tecnica).toMatch(/^Ecografía abdominal con transductor/);
    expect(r.secciones.hallazgos).toContain("midiendo xx mm.");
    expect(r.secciones.hallazgos).toContain("Riñón derecho: sin medidas.");
    expect(r.secciones.conclusion).toBe("Ecografía abdominal dentro de parámetros normales.");
    expect(r.medicoFirmante).toMatch(/M\.P\. 1011/);
    expect(r.advertencias).toEqual([]);
  });

  it("detecta conclusión vacía sin inventar contenido", async () => {
    const r = leerInforme(await textoDePdf(fixture("T-900006_radiografia_torax.pdf")));
    expect(r.secciones.conclusion ?? "").toBe("");
    expect(r.secciones.hallazgos).toMatch(/Campos pulmonares/);
  });
});
