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
  if (sb) {
    const { error } = await sb.from("m06_usuarios").select("email", { count: "exact", head: true });
    baseDeDatos = error ? "error" : "ok";
  }
  const ia = descripcionProveedor();
  return Response.json({
    baseDeDatos,
    login: configAuth() ? "configurado" : "sin_configurar",
    ia: { proveedor: ia.tipo, modelo: ia.modelo },
    drive: driveConfigurado() ? "configurado" : "sin_configurar",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
