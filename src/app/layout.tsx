import type { Metadata } from "next";
import { MenuLateral } from "@/components/navegacion";
import { contadoresMenu } from "@/lib/db/repositorio";
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
  const contadores = !u.demo ? await contadoresMenu(u.rol === "medico" ? (u.medicoId ?? "—") : undefined).catch(() => ({ pendientes: 0, sinAsignar: 0 })) : { pendientes: 0, sinAsignar: 0 };
  return (
    <html lang="es-AR" className="h-full antialiased">
      <body className="min-h-full">
        <div className="flex min-h-screen flex-col md:flex-row">
          <MenuLateral
            datos={{ nombre: u.nombre, rol: u.rol, nombreRol: NOMBRE_ROL[u.rol], medicoId: u.medicoId, demo: u.demo, ...contadores, sinAsignar: u.rol === "medico" ? 0 : contadores.sinAsignar }}
            salir={salir}
          />
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
