"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clienteAuth, configAuth } from "@/lib/auth/supabase";
import { usuarioActual } from "@/lib/auth/sesion";
import { registrarEvento } from "@/lib/db/repositorio";

export interface EstadoLogin { error?: string }

const schema = z.object({ email: z.string().email(), clave: z.string().min(1), volver: z.string().optional() });

/** Solo rutas internas: evita redirecciones abiertas a otros sitios. */
function destinoSeguro(v?: string) {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") ? v : "/";
}

export async function ingresar(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  if (!configAuth()) return { error: "El login no está configurado (falta SUPABASE_PUBLISHABLE_KEY en Vercel)." };
  const p = schema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Ingresá email y contraseña." };
  const sb = await clienteAuth();
  const { error } = await sb.auth.signInWithPassword({ email: p.data.email.trim().toLowerCase(), password: p.data.clave });
  if (error) return { error: "Email o contraseña incorrectos." };
  const u = await usuarioActual();
  if (!u) {
    await sb.auth.signOut();
    return { error: "Tu usuario no está habilitado en M06. Pedile acceso al administrador." };
  }
  await registrarEvento({ tipo: "sesion_iniciada", actor: u.email, datos: { rol: u.rol } }).catch(() => {});
  redirect(destinoSeguro(p.data.volver));
}

export async function salir() {
  if (configAuth()) {
    const sb = await clienteAuth();
    await sb.auth.signOut();
  }
  redirect("/login");
}
