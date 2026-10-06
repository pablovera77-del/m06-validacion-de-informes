import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Informe, ResultadoInforme, Turno } from "../domain/types";

vi.mock("server-only", () => ({}));

// Base de datos en memoria para probar el flujo completo PDF → validación → guardado.
const mem = vi.hoisted(() => ({
  turnos: new Map<string, unknown>(),
  informes: [] as { informe: unknown; r: unknown }[],
  eventos: [] as { tipo: string; datos?: Record<string, unknown> }[],
  archivos: [] as { estado: string }[],
}));

vi.mock("../db/cliente", () => ({ exigirDb: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) }) }) }));
vi.mock("../db/repositorio", () => ({
  archivoYaProcesado: async () => false,
  obtenerTurno: async (id: string) => mem.turnos.get(id),
  historialMedico: async () => [],
  informeVigenteDelTurno: async () => undefined,
  guardarInformeValidado: async (informe: unknown, r: unknown) => void mem.informes.push({ informe, r }),
  registrarEvento: async (e: { tipo: string; datos?: Record<string, unknown> }) => void mem.eventos.push(e),
  registrarArchivo: async (a: { estado: string }) => void mem.archivos.push(a),
}));

const { procesarPdf, leerTurnosCsv } = await import("./procesar");
const dir = path.join(import.meta.dirname, "../../../fixtures/pdf");

describe("ingesta de PDF de punta a punta", () => {
  beforeEach(() => {
    mem.informes.length = 0;
    mem.eventos.length = 0;
    const { turnos } = leerTurnosCsv(readFileSync(path.join(dir, "turnos.csv"), "utf8"));
    for (const t of turnos) mem.turnos.set(t.id, t as Turno);
  });

  async function procesar(nombre: string) {
    const r = await procesarPdf({ datos: new Uint8Array(readFileSync(path.join(dir, nombre))), nombre, origen: "carga_manual", actor: "test" });
    const guardado = mem.informes.at(-1) as { informe: Informe; r: ResultadoInforme } | undefined;
    return { r, guardado };
  }

  it("ecografía con DNI distinto, 'xx mm' y riñón sin medidas", async () => {
    const { r, guardado } = await procesar("T-900004_ecografia_abdominal.pdf");
    expect(r.estado).toBe("procesado");
    const v = guardado!.r.alertas.map((a) => `${a.validacion}:${a.nivel}`);
    expect(v).toContain("V4:naranja");
    expect(v).toContain("V5:naranja");
    expect(v).toContain("V5:amarilla");
  });

  it("densitometría T -2,8 informada como osteopenia", async () => {
    const { guardado } = await procesar("T-900003_densitometria.pdf");
    expect(guardado!.r.alertas.map((a) => `${a.validacion}:${a.nivel}`)).toEqual(["V3B:naranja"]);
  });

  it("mamografía BI-RADS 1 con nódulo", async () => {
    const { guardado } = await procesar("T-900002_mamografia.pdf");
    expect(guardado!.r.alertas.some((a) => a.validacion === "V3A" && a.nivel === "naranja")).toBe(true);
  });

  it("informe correcto no genera alertas y nefrectomía documentada no alerta", async () => {
    expect((await procesar("T-900001_mamografia.pdf")).guardado!.r.alertas).toEqual([]);
    expect((await procesar("T-900005_ecografia_abdominal.pdf")).guardado!.r.alertas).toEqual([]);
  });

  it("radiografía sin conclusión y con DNI distinto", async () => {
    const { guardado } = await procesar("T-900006_radiografia_torax.pdf");
    const v = guardado!.r.alertas.map((a) => `${a.validacion}:${a.nivel}`);
    expect(v).toContain("V1:naranja");
    expect(v).toContain("V4:naranja");
  });

  it("el log no contiene datos identificatorios del paciente", async () => {
    await procesar("T-900004_ecografia_abdominal.pdf");
    const texto = JSON.stringify(mem.eventos);
    expect(texto).not.toMatch(/30\.555|LÓPEZ|1980/);
  });
});
