import { generateText, Output } from "ai";
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

/**
 * Proveedor real vía Vercel AI Gateway (AI SDK). Se activa con M06_LLM_PROVIDER=gateway.
 * En Vercel la autenticación usa OIDC; en local, AI_GATEWAY_API_KEY.
 */
export class ProveedorGateway implements ProveedorLlm {
  nombre = "Vercel AI Gateway";
  constructor(public modelo: string) {}

  async generar<T>({ prompt, entrada, schema }: { prompt: ConfigPrompt; entrada: string; schema: z.ZodType<T> }): Promise<T> {
    const { output } = await generateText({
      model: this.modelo,
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

/** Devuelve el proveedor configurado, o null para usar el simulador local. */
export function proveedorConfigurado(): ProveedorLlm | null {
  if (process.env.M06_LLM_PROVIDER === "gateway") {
    return new ProveedorGateway(process.env.M06_LLM_MODEL ?? "anthropic/claude-sonnet-5.5");
  }
  return null;
}
