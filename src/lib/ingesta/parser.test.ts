import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FIRMA_EN_IMAGEN, leerInforme, unirLineas } from "./parser";
import { textoDePdf } from "./pdf";

const fixture = (n: string) => new Uint8Array(readFileSync(path.join(import.meta.dirname, "../../../fixtures/pdf", n)));

describe("lectura de PDF con el formato de exportación de CDO", () => {
  it("une cortes de línea dentro de una oración", () => {
    expect(unirLineas("midiendo xx\nmm.\nBAZO: normal.")).toBe("midiendo xx mm.\nBAZO: normal.");
  });

  it("descarta el pie repetido en cada página", () => {
    const t = "Av. Córdoba 262 (e) - San Juan - 4933218\nHÍGADO: normal.\nAv. Córdoba 262 (e) - San Juan - 4933218";
    expect(unirLineas(t)).toBe("HÍGADO: normal.");
  });

  it("lee encabezado, secciones y cierre de una ecografía", async () => {
    const r = leerInforme(await textoDePdf(fixture("90000004.pdf")));
    expect(r.encabezado).toEqual({ apellidoNombre: "LOPEZ CARLOS ALBERTO", dni: "30555444", fechaNacimiento: "01/02/1980", tipoEstudio: "US ECOGRAFIA COMPLETA DE ABDOMEN" });
    expect(r.turnoId).toBe("90000004");
    expect(r.secciones.tecnica).toMatch(/^Ecografía abdominal con transductor/);
    expect(r.secciones.hallazgos).toContain("midiendo xx mm.");
    expect(r.secciones.hallazgos).toContain("Riñón derecho: sin medidas.");
    expect(r.secciones.hallazgos).not.toMatch(/Córdoba|Atte/);
    expect(r.secciones.conclusion).toBe("ECOGRAFÍA ABDOMINAL DENTRO DE PARÁMETROS NORMALES.");
    expect(r.medicoFirmante).toBe(FIRMA_EN_IMAGEN);
    expect(r.advertencias).toEqual([]);
  });

  it("no confunde «Referido Por» con el médico informante ni la fecha con el estudio", async () => {
    const r = leerInforme(await textoDePdf(fixture("90000001.pdf")));
    expect(r.encabezado.tipoEstudio).toBe("MG MAMOGRAFIA BILATERAL");
    expect(r.medicoFirmante).not.toMatch(/DERIVANTE/);
  });

  it("informe sin conclusión: no inventa contenido y lo advierte", async () => {
    const r = leerInforme(await textoDePdf(fixture("90000006.pdf")));
    expect(r.secciones.conclusion ?? "").toBe("");
    expect(r.advertencias.join(" ")).toMatch(/conclusion/);
  });
});
