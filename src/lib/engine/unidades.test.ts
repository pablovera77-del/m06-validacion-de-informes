import { describe, expect, it } from "vitest";
import { normalizarDni, normalizarFecha, normalizarNombre, normalizarTipoEstudio, mencionAfirmativa } from "../domain/normalize";
import { clasificarT, extraerTScores } from "./v3b-densitometria";
import { similitud } from "./v2-duplicado";
import { reglasVigentes } from "../config/reglas";
import { LogAuditoria, verificarCadena } from "../audit/log";
import { armarEntrada, promptVigente } from "../config/prompts";

const reglas = reglasVigentes();

describe("normalización (V4)", () => {
  it("DNI con y sin puntos es el mismo", () => expect(normalizarDni("20.345.678")).toBe(normalizarDni("20345678")));
  it("nombre sin importar orden, tildes ni mayúsculas", () => expect(normalizarNombre("PÉREZ, Juan")).toBe(normalizarNombre("juan perez")));
  it("fechas en distintos formatos", () => {
    expect(normalizarFecha("05/03/1970")).toBe("1970-03-05");
    expect(normalizarFecha("1970-03-05")).toBe("1970-03-05");
    expect(normalizarFecha("5-3-70")).toBe("1970-03-05");
  });
  it("tipo de estudio libre", () => {
    expect(normalizarTipoEstudio("MAMOGRAFÍA BILATERAL")).toBe("mamografia");
    expect(normalizarTipoEstudio("Ecografía abdominal completa")).toBe("ecografia_abdominal");
    expect(normalizarTipoEstudio("Rx de tórax frente")).toBe("radiografia_torax");
  });
});

describe("V3B densitometría", () => {
  it("extrae T-score con coma y signo", () => expect(extraerTScores("T-score -2,7 y T score: -1.3").map((v) => v.valor)).toEqual([-2.7, -1.3]));
  it("límites según especificación", () => {
    expect(clasificarT(-1.0, reglas)).toBe("normal");
    expect(clasificarT(-1.01, reglas)).toBe("osteopenia");
    expect(clasificarT(-2.49, reglas)).toBe("osteopenia");
    expect(clasificarT(-2.5, reglas)).toBe("osteoporosis");
  });
});

describe("negación", () => {
  it("'sin nódulos' no es un hallazgo", () => expect(mencionAfirmativa("Sin nódulos ni calcificaciones.", /n[óo]dulo/i)).toBeNull());
  it("'nódulo de 12 mm' sí", () => expect(mencionAfirmativa("Nódulo de 12 mm.", /n[óo]dulo/i)).not.toBeNull());
});

describe("V2 similitud", () => {
  it("texto idéntico = 1", () => expect(similitud("uno dos tres cuatro cinco", "uno dos tres cuatro cinco")).toBe(1));
  it("texto distinto = 0", () => expect(similitud("uno dos tres cuatro", "cinco seis siete ocho")).toBe(0));
});

describe("log de auditoría (HU22)", () => {
  it("detecta alteración de una entrada", () => {
    const log = new LogAuditoria();
    log.registrar({ fecha: "2026-10-06", tipo: "alerta_generada", actor: "motor", datos: { nivel: "naranja" } });
    log.registrar({ fecha: "2026-10-06", tipo: "alerta_override", actor: "M01", datos: { justificacion: "ok" } });
    expect(verificarCadena(log.listar()).integro).toBe(true);
    const copia = log.listar().map((e) => ({ ...e }));
    copia[0] = { ...copia[0], datos: { nivel: "azul" } };
    const v = verificarCadena(copia);
    expect(v.integro).toBe(false);
    expect(v.primeraFalla?.secuencia).toBe(1);
  });
});

describe("privacidad del prompt (HU23)", () => {
  it("la plantilla de entrada no contiene datos identificatorios", () => {
    for (const v of ["V3A", "V5"] as const) {
      const p = promptVigente(v);
      expect(p.plantillaEntrada).not.toMatch(/dni|nacimiento|apellido|encabezado|turno/i);
      const entrada = armarEntrada(p, { tipoEstudio: "Mamografía", secciones: { hallazgos: "h", conclusion: "c", tecnica: "t" } });
      expect(entrada).toContain("h");
    }
  });
});

import { diffLineas } from "../config/diff";
import { siguienteVersion } from "../config/prompts";

describe("versiones de prompts", () => {
  it("diff por líneas marca agregadas y quitadas", () => {
    const d = diffLineas("a\nb\nc", "a\nB\nc\nd");
    expect(d.filter((x) => x.tipo === "quitada").map((x) => x.texto)).toEqual(["b"]);
    expect(d.filter((x) => x.tipo === "agregada").map((x) => x.texto)).toEqual(["B", "d"]);
  });
  it("numera la siguiente versión sin repetir", () => {
    expect(siguienteVersion("V3A", ["v3a-prompt-1.0.0"])).toBe("v3a-prompt-1.1.0");
    expect(siguienteVersion("V5", ["v5-prompt-1.0.0", "v5-prompt-1.3.0", "v3a-prompt-1.7.0"])).toBe("v5-prompt-1.4.0");
  });
});
