import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Navegacion } from "@/components/navegacion";
import { NOMBRE_ROL, usuarioActual } from "@/lib/auth/sesion";
import { salir } from "./login/acciones";
import "./globals.css";

export const metadata: Metadata = {
  title: "M06 Validación de Informes · CDO",
  description: "Control de calidad documental de informes médicos antes de la firma. CDO Suite Digital.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const u = await usuarioActual();
  if (!u) {
    // Sin sesión (login): sin menú lateral.
    return (
      <html lang="es-AR" className="h-full antialiased">
        <body className="min-h-full px-4 py-6">{children}</body>
      </html>
    );
  }
  return (
    <html lang="es-AR" className="h-full antialiased">
      <body className="min-h-full">
        <div className="flex min-h-screen flex-col md:flex-row">
          <aside className="border-b border-borde bg-superficie md:w-64 md:shrink-0 md:border-b-0 md:border-r">
            <div className="flex flex-col gap-6 p-4 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
              <Link href="/" className="block px-3">
                <Image src="/brand/cdo-logo.png" alt="CDO Centro de Diagnóstico Dr. Orellano" width={1256} height={445} className="h-auto w-40" priority />
                <div className="mt-3 font-titulo text-sm text-texto-2">M06 · Validación de informes</div>
              </Link>
              <Navegacion rol={u.rol} />
              <div className="mt-auto flex flex-col gap-3">
                <div className="rounded-md border border-borde bg-fondo px-3 py-2 text-xs">
                  <div className="font-medium">{u.nombre}</div>
                  <div className="text-texto-2">{NOMBRE_ROL[u.rol]}{u.medicoId ? ` · ${u.medicoId}` : ""}</div>
                  {!u.demo && (
                    <form action={salir} className="mt-1.5">
                      <button className="text-marca underline">Cerrar sesión</button>
                    </form>
                  )}
                </div>
                <div className="rounded-md border border-borde bg-fondo px-3 py-2 text-[11px] leading-relaxed text-texto-2">
                  Etapa 1 · informes PDF desde Drive o carga manual.<br />
                  Los casos de demostración son sintéticos.
                </div>
              </div>
            </div>
          </aside>
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
