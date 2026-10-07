"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Rol = "medico" | "calidad" | "admin";
const TODOS: Rol[] = ["medico", "calidad", "admin"];
const GESTION: Rol[] = ["calidad", "admin"];

// Visibilidad del menú por rol. El control de acceso real está en cada página, acción y API.
const TODAS_SECCIONES: { titulo: string; items: { href: string; texto: string; roles: Rol[] }[] }[] = [
  { titulo: "Operación", items: [
    { href: "/", texto: "Inicio", roles: GESTION },
    { href: "/ingesta", texto: "Subir informes (PDF)", roles: TODOS },
    { href: "/medico", texto: "Vista del médico (pre-firma)", roles: TODOS },
  ] },
  { titulo: "Calidad", items: [
    { href: "/calidad", texto: "Panel de Calidad", roles: GESTION },
    { href: "/calidad/gestion", texto: "Gestión de Calidad", roles: GESTION },
    { href: "/pruebas", texto: "Set de prueba", roles: GESTION },
    { href: "/auditoria", texto: "Log de auditoría", roles: GESTION },
  ] },
  { titulo: "Configuración", items: [
    { href: "/configuracion/prompts", texto: "Prompts de IA", roles: GESTION },
    { href: "/configuracion/reglas", texto: "Reglas y umbrales", roles: GESTION },
    { href: "/configuracion/usuarios", texto: "Usuarios y roles", roles: ["admin"] },
    { href: "/api-docs", texto: "API (etapa 2)", roles: GESTION },
  ] },
];

export function Navegacion({ rol }: { rol: Rol }) {
  const ruta = usePathname();
  const SECCIONES = TODAS_SECCIONES.map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(rol)) })).filter((s) => s.items.length);
  return (
    <nav aria-label="Principal" className="flex flex-col gap-5 text-sm">
      {SECCIONES.map((s) => (
        <div key={s.titulo}>
          <div className="mb-1.5 px-3 text-[11px] uppercase tracking-wider text-texto-3">{s.titulo}</div>
          <ul className="flex flex-col gap-0.5">
            {s.items.map((i) => {
              const activo = i.href === "/" ? ruta === "/" : ruta === i.href || (ruta.startsWith(i.href + "/") && !SECCIONES.some((x) => x.items.some((y) => y.href !== i.href && y.href.startsWith(i.href) && ruta.startsWith(y.href))));
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={activo ? "page" : undefined}
                    className={`block rounded-md px-3 py-1.5 ${activo ? "bg-marca text-white" : "text-texto-2 hover:bg-marca-suave hover:text-marca-oscuro"}`}
                  >
                    {i.texto}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
