import { connection } from "next/server";
import { db } from "@/lib/db/cliente";
import { configAuth } from "@/lib/auth/supabase";
import { descripcionProveedor } from "@/lib/engine/llm";
import { driveConfigurado } from "@/lib/ingesta/drive";

/**
 * GET /api/estado → chequeo de configuración para soporte y verificación del despliegue.
 * Público: solo devuelve sí/no y nombres de proveedor. Nunca valores de claves ni datos.
 */
export async function GET() {
  await connection();
  const sb = db();
  let baseDeDatos: "ok" | "sin_configurar" | "error" = "sin_configurar";
  let errorBase: string | null = null;
  if (sb) {
    const { error, status } = await sb.from("m06_usuarios").select("email", { count: "exact", head: true });
    baseDeDatos = error ? "error" : "ok";
    if (error) errorBase = status === 401 ? "clave secreta rechazada (¿es la del proyecto M06?)" : `HTTP ${status}`;
  }
  const secreta = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
  const ia = descripcionProveedor();
  return Response.json({
    baseDeDatos,
    // Diagnóstico sin exponer valores: solo formato y presencia de variables.
    diagnostico: {
      errorBase,
      proyectoSupabase: process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split(".")[0] : null,
      formatoClaveSecreta: !secreta ? "falta" : secreta.startsWith("sb_secret_") ? "sb_secret" : secreta.startsWith("sb_publishable_") ? "es_la_publicable" : secreta.startsWith("eyJ") ? "jwt_legacy" : "desconocido",
      variableProveedorIa: process.env.M06_LLM_PROVIDER ? process.env.M06_LLM_PROVIDER.trim().toLowerCase() : "falta",
      claveAnthropic: process.env.ANTHROPIC_API_KEY?.trim() ? "presente" : "falta",
    },
    login: configAuth() ? "configurado" : "sin_configurar",
    ia: { proveedor: ia.tipo, modelo: ia.modelo },
    drive: driveConfigurado() ? "configurado" : "sin_configurar",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
