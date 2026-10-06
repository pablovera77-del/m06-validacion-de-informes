import Image from "next/image";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth/sesion";
import { configAuth } from "@/lib/auth/supabase";
import { FormularioLogin } from "./formulario";

export default async function Login({ searchParams }: PageProps<"/login">) {
  if (await usuarioActual()) redirect("/");
  const { volver } = await searchParams;
  return (
    <div className="mx-auto mt-10 w-full max-w-sm rounded-lg border border-borde bg-superficie p-6">
      <Image src="/brand/cdo-logo.png" alt="CDO Centro de Diagnóstico Dr. Orellano" width={1256} height={445} className="mx-auto h-auto w-44" priority />
      <h1 className="mt-5 text-center text-lg">M06 · Validación de informes</h1>
      <p className="mb-5 mt-1 text-center text-sm text-texto-2">Ingresá con el usuario que te asignó el administrador.</p>
      {configAuth() ? (
        <FormularioLogin volver={typeof volver === "string" ? volver : undefined} />
      ) : (
        <p className="rounded-md bg-fondo p-3 text-sm text-roja">El login no está configurado: falta SUPABASE_PUBLISHABLE_KEY en Vercel.</p>
      )}
      <p className="mt-5 text-center text-[11px] text-texto-3">Acceso restringido. Toda acción queda registrada en el log de auditoría.</p>
    </div>
  );
}
