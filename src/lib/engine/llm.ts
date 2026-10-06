import { generateText, Output, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { z } from "zod";
import type { ConfigPrompt } from "../config/prompts";

/**
 * Proveedor de modelo de lenguaje. El motor solo depende de esta interfaz,
 * así el proveedor puede cambiarse sin tocar las validaciones.
 */
export interface ProveedorLlm {
  nombre: string;
  modelo: string;
  generar<T>(params: { prompt: ConfigPrompt; entrada: string; schema: z.ZodType<T> }): Promise<T>;
}

/** Modelo por defecto de cada proveedor (se cambia con M06_LLM_MODEL). */
export const MODELO_POR_DEFECTO = { anthropic: "claude-sonnet-5-5", gateway: "anthropic/claude-sonnet-5.5" } as const;

/**
 * Proveedor real vía AI SDK. Dos opciones:
 * - M06_LLM_PROVIDER=anthropic → API de Anthropic directa con la clave de CDO (ANTHROPIC_API_KEY).
 * - M06_LLM_PROVIDER=gateway   → Vercel AI Gateway.
 * Solo recibe las secciones clínicas: nunca nombre, DNI ni fecha de nacimiento.
 */
export class ProveedorReal implements ProveedorLlm {
  constructor(public nombre: string, public modelo: string, private model: LanguageModel) {}

  async generar<T>({ prompt, entrada, schema }: { prompt: ConfigPrompt; entrada: string; schema: z.ZodType<T> }): Promise<T> {
    const { output } = await generateText({
      model: this.model,
      system: prompt.sistema,
      prompt: entrada,
      temperature: prompt.modelo.temperatura,
      output: Output.object({ schema }),
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(Number(process.env.M06_LLM_TIMEOUT_MS ?? 30000)),
    });
    return schema.parse(output);
  }
}

export type TipoProveedor = "anthropic" | "gateway" | "simulador";

/** Proveedor elegido por configuración. Si falta la clave, cae al simulador para no fallar en silencio con errores de autenticación. */
export function tipoProveedor(): TipoProveedor {
  const p = process.env.M06_LLM_PROVIDER?.trim().toLowerCase();
  if (p === "anthropic" && process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (p === "gateway") return "gateway";
  return "simulador";
}

export function descripcionProveedor(): { tipo: TipoProveedor; nombre: string; modelo: string } {
  const tipo = tipoProveedor();
  if (tipo === "anthropic") return { tipo, nombre: "API de Anthropic (clave propia de CDO)", modelo: process.env.M06_LLM_MODEL || MODELO_POR_DEFECTO.anthropic };
  if (tipo === "gateway") return { tipo, nombre: "Vercel AI Gateway", modelo: process.env.M06_LLM_MODEL || MODELO_POR_DEFECTO.gateway };
  return { tipo, nombre: "Simulador local (sin IA)", modelo: "reglas-simuladas" };
}

/** Devuelve el proveedor configurado, o null para usar el simulador local. */
export function proveedorConfigurado(): ProveedorLlm | null {
  const d = descripcionProveedor();
  if (d.tipo === "anthropic") {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
    return new ProveedorReal(d.nombre, d.modelo, anthropic(d.modelo));
  }
  if (d.tipo === "gateway") return new ProveedorReal(d.nombre, d.modelo, d.modelo);
  return null;
}
