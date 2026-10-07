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

  async function procesar(nombre: string, medicoQueSube?: string) {
    const r = await procesarPdf({ datos: new Uint8Array(readFileSync(path.join(dir, nombre))), nombre, origen: "carga_manual", actor: "test", medicoQueSube });
    const guardado = mem.informes.at(-1) as { informe: Informe; r: ResultadoInforme } | undefined;
    return { r, guardado };
  }

  it("ecografía con DNI distinto, 'xx mm' y riñón sin medidas", async () => {
    const { r, guardado } = await procesar("90000004.pdf");
    expect(r.estado).toBe("procesado");
    const v = guardado!.r.alertas.map((a) => `${a.validacion}:${a.nivel}`);
    expect(v).toContain("V4:naranja");
    expect(v).toContain("V5:naranja");
    expect(v).toContain("V5:amarilla");
  });

  it("densitometría T -2,8 informada como osteopenia", async () => {
    const { guardado } = await procesar("90000003.pdf");
    expect(guardado!.r.alertas.map((a) => `${a.validacion}:${a.nivel}`)).toEqual(["V3B:naranja"]);
  });

  it("mamografía BI-RADS 1 con nódulo", async () => {
    const { guardado } = await procesar("90000002.pdf");
    expect(guardado!.r.alertas.some((a) => a.validacion === "V3A" && a.nivel === "naranja")).toBe(true);
  });

  it("informe correcto no genera alertas y nefrectomía documentada no alerta", async () => {
    expect((await procesar("90000001.pdf")).guardado!.r.alertas).toEqual([]);
    expect((await procesar("90000005.pdf")).guardado!.r.alertas).toEqual([]);
  });

  it("radiografía sin conclusión y con DNI distinto", async () => {
    const { guardado } = await procesar("90000006.pdf");
    const v = guardado!.r.alertas.map((a) => `${a.validacion}:${a.nivel}`);
    expect(v).toContain("V1:naranja");
    expect(v).toContain("V4:naranja");
  });

  it("sin planilla de turnos: valida igual, V4 no aplica y el informe queda del médico que lo sube", async () => {
    mem.turnos.clear();
    const { r, guardado } = await procesar("90000003.pdf", "M07");
    expect(r.estado).toBe("procesado");
    expect(guardado!.informe.medicoId).toBe("M07");
    expect(guardado!.informe.tipoEstudio).toBe("densitometria");
    expect(guardado!.r.resultados.find((x) => x.validacion === "V4")?.estado).toBe("no_aplica");
    expect(guardado!.r.incompleto).toBe(false);
    expect(guardado!.r.alertas.map((a) => `${a.validacion}:${a.nivel}`)).toEqual(["V3B:naranja"]);
  });

  it("sin turno y subido por Calidad: queda sin médico asignado", async () => {
    mem.turnos.clear();
    const { r, guardado } = await procesar("90000006.pdf");
    expect(guardado!.informe.medicoId).toBe("sin_asignar");
    expect(r.advertencias.join(" ")).toMatch(/Sin médico asignado/);
    expect(guardado!.r.alertas.some((a) => a.validacion === "V4")).toBe(false);
    expect(guardado!.r.alertas.some((a) => a.validacion === "V1")).toBe(true);
  });

  it("el log no contiene datos identificatorios del paciente", async () => {
    await procesar("90000004.pdf");
    const texto = JSON.stringify(mem.eventos);
    expect(texto).not.toMatch(/30555|LOPEZ|1980/);
  });
});
