"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type Rol = "medico" | "calidad" | "admin";
const TODOS: Rol[] = ["medico", "calidad", "admin"];
const GESTION: Rol[] = ["calidad", "admin"];

/* Íconos de trazo simple, 20 px, heredan el color del texto. */
const trazo = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const ICONOS: Record<string, ReactNode> = {
  inicio: <svg {...trazo}><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" /></svg>,
  subir: <svg {...trazo}><path d="M12 15V4m0 0L8 8m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>,
  bandeja: <svg {...trazo}><path d="M4 13h4l1.5 2.5h5L16 13h4M5.5 5h13L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5z" /></svg>,
  panel: <svg {...trazo}><path d="M4 20V10m6 10V4m6 16v-7m4 7H3" /></svg>,
  gestion: <svg {...trazo}><path d="M9 5h10M9 12h10M9 19h10M4.5 5l1 1 2-2M4.5 12l1 1 2-2M4.5 19l1 1 2-2" /></svg>,
  pruebas: <svg {...trazo}><path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7 15h10" /></svg>,
  log: <svg {...trazo}><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6zM9 12l2 2 4-4" /></svg>,
  prompts: <svg {...trazo}><path d="M4 6h16v10H8l-4 4zM8 10h8M8 13h5" /></svg>,
  reglas: <svg {...trazo}><path d="M5 7h9m4 0h1M5 17h3m4 0h7M14 4v6M8 14v6" /></svg>,
  usuarios: <svg {...trazo}><path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c.8-3.4 3.1-5 6-5s5.2 1.6 6 5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15c1.6.6 2.6 2.2 3 5" /></svg>,
  api: <svg {...trazo}><path d="m9 8-4 4 4 4m6-8 4 4-4 4" /></svg>,
  salir: <svg {...trazo} width={18} height={18}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></svg>,
  menu: <svg {...trazo} width={24} height={24}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  cerrar: <svg {...trazo} width={24} height={24}><path d="M6 6l12 12M18 6 6 18" /></svg>,
};

interface Item { href: string; texto: string; icono: string; roles: Rol[]; contador?: "pendientes" }

const SECCIONES: { titulo: string | null; items: Item[] }[] = [
  { titulo: null, items: [
    { href: "/", texto: "Inicio", icono: "inicio", roles: GESTION },
    { href: "/medico", texto: "Informes a firmar", icono: "bandeja", roles: TODOS, contador: "pendientes" },
  ] },
  { titulo: "Calidad", items: [
    { href: "/calidad", texto: "Panel de indicadores", icono: "panel", roles: GESTION },
    { href: "/calidad/gestion", texto: "Auditorías y acciones", icono: "gestion", roles: GESTION },
    { href: "/auditoria", texto: "Log de auditoría", icono: "log", roles: GESTION },
    { href: "/pruebas", texto: "Set de prueba", icono: "pruebas", roles: GESTION },
  ] },
  { titulo: "Configuración", items: [
    { href: "/configuracion/reglas", texto: "Reglas y umbrales", icono: "reglas", roles: GESTION },
    { href: "/configuracion/prompts", texto: "Prompts de IA", icono: "prompts", roles: GESTION },
    { href: "/configuracion/usuarios", texto: "Usuarios y roles", icono: "usuarios", roles: ["admin"] },
    { href: "/api-docs", texto: "Integración (API)", icono: "api", roles: GESTION },
  ] },
];

const TODAS_RUTAS = SECCIONES.flatMap((s) => s.items.map((i) => i.href));

/** Activo: la ruta exacta o una subruta que no tenga su propio ítem en el menú (/medico/123 → «Informes a firmar»). */
function esActivo(ruta: string, href: string) {
  if (href === "/") return ruta === "/";
  if (ruta === href) return true;
  return ruta.startsWith(href + "/") && !TODAS_RUTAS.some((h) => h !== href && h.startsWith(href) && ruta.startsWith(h));
}

export interface DatosMenu {
  nombre: string;
  rol: Rol;
  nombreRol: string;
  medicoId: string | null;
  demo: boolean;
  pendientes: number;
  sinAsignar: number;
}

function iniciales(nombre: string) {
  const p = nombre.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "·";
}

export function MenuLateral({ datos, salir }: { datos: DatosMenu; salir: () => Promise<void> }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  const secciones = SECCIONES.map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(datos.rol)) })).filter((s) => s.items.length);
  const subirActivo = esActivo(ruta, "/ingesta");

  const contenido = (
    // Al tocar un enlace en el celular, el menú se cierra solo.
    <div className="flex h-full flex-col" onClick={(e) => (e.target as HTMLElement).closest("a") && setAbierto(false)}>
      <Link href={datos.rol === "medico" ? "/medico" : "/"} className="block px-5 pb-5 pt-6">
        <Image src="/brand/cdo-logo.png" alt="CDO Centro de Diagnóstico Dr. Orellano" width={1256} height={445} className="h-auto w-36" priority />
        <div className="mt-2.5 font-titulo text-[13px] text-texto-2">Validación de informes</div>
      </Link>

      <div className="px-4">
        <Link
          href="/ingesta"
          aria-current={subirActivo ? "page" : undefined}
          className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors ${subirActivo ? "bg-marca-oscuro" : "bg-marca hover:bg-marca-oscuro"}`}
        >
          {ICONOS.subir}
          Subir informes
        </Link>
      </div>

      <nav aria-label="Principal" className="mt-5 flex-1 overflow-y-auto px-3 pb-4">
        {secciones.map((s, k) => (
          <div key={k} className={k > 0 ? "mt-5" : ""}>
            {s.titulo && <div className="mb-1 px-3 text-xs font-medium text-texto-3">{s.titulo}</div>}
            <ul className="flex flex-col gap-0.5">
              {s.items.map((i) => {
                const activo = esActivo(ruta, i.href);
                const n = i.contador === "pendientes" ? datos.pendientes : 0;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={activo ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-md py-2 pl-3 pr-2 text-sm transition-colors ${
                        activo ? "bg-marca-suave font-medium text-marca-oscuro" : "text-texto-2 hover:bg-fondo hover:text-texto"
                      }`}
                    >
                      {activo && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-marca" />}
                      <span className={activo ? "text-marca" : "text-texto-3 group-hover:text-texto-2"}>{ICONOS[i.icono]}</span>
                      <span className="flex-1">{i.texto}</span>
                      {n > 0 && (
                        <span className="min-w-6 rounded-full bg-marca px-1.5 py-0.5 text-center text-[11px] font-semibold leading-4 text-white" aria-label={`${n} pendientes`}>
                          {n > 99 ? "99+" : n}
                        </span>
                      )}
                    </Link>
                    {i.contador === "pendientes" && datos.sinAsignar > 0 && (
                      <Link href="/medico" className="ml-11 mt-0.5 block text-xs text-amarilla hover:underline">
                        {datos.sinAsignar} sin médico asignado
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-borde p-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marca text-xs font-semibold text-white">
            {iniciales(datos.nombre)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium">{datos.nombre}</div>
            <div className="truncate text-xs text-texto-2">{datos.nombreRol}{datos.medicoId ? ` · ${datos.medicoId}` : ""}</div>
          </div>
          {!datos.demo && (
            <form action={salir}>
              <button title="Cerrar sesión" aria-label="Cerrar sesión" className="rounded-md p-2 text-texto-3 hover:bg-fondo hover:text-texto">
                {ICONOS.salir}
              </button>
            </form>
          )}
        </div>
        {datos.demo && <p className="mt-3 text-[11px] leading-relaxed text-texto-3">Modo demostración con datos sintéticos.</p>}
      </div>
    </div>
  );

  return (
    <>
      {/* Celular: barra superior con botón de menú */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-borde bg-superficie px-4 py-2.5 md:hidden">
        <Link href={datos.rol === "medico" ? "/medico" : "/"}>
          <Image src="/brand/cdo-logo.png" alt="CDO" width={1256} height={445} className="h-auto w-24" />
        </Link>
        <button onClick={() => setAbierto(true)} aria-label="Abrir menú" aria-expanded={abierto} className="rounded-md p-1.5 text-texto-2 hover:bg-fondo">
          {ICONOS.menu}
        </button>
      </header>
      {abierto && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button aria-label="Cerrar menú" className="absolute inset-0 bg-texto/30" onClick={() => setAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-superficie shadow-xl">
            <button onClick={() => setAbierto(false)} aria-label="Cerrar menú" className="absolute right-3 top-4 rounded-md p-1.5 text-texto-2 hover:bg-fondo">
              {ICONOS.cerrar}
            </button>
            {contenido}
          </aside>
        </div>
      )}

      {/* Escritorio: barra lateral fija */}
      <aside className="hidden w-64 shrink-0 border-r border-borde bg-superficie md:block">
        <div className="sticky top-0 h-screen">{contenido}</div>
      </aside>
    </>
  );
}
