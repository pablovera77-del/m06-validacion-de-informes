"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { titulo: "Operación", items: [
    { href: "/", texto: "Inicio" },
    { href: "/medico", texto: "Vista del médico (pre-firma)" },
  ] },
  { titulo: "Calidad", items: [
    { href: "/calidad", texto: "Panel de Calidad" },
    { href: "/pruebas", texto: "Set de prueba" },
    { href: "/auditoria", texto: "Log de auditoría" },
  ] },
  { titulo: "Configuración", items: [
    { href: "/configuracion/prompts", texto: "Prompts de IA" },
    { href: "/configuracion/reglas", texto: "Reglas y umbrales" },
    { href: "/api-docs", texto: "API (etapa 2)" },
  ] },
];

export function Navegacion() {
  const ruta = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-5 text-sm">
      {SECCIONES.map((s) => (
        <div key={s.titulo}>
          <div className="mb-1.5 px-3 text-[11px] uppercase tracking-wider text-texto-3">{s.titulo}</div>
          <ul className="flex flex-col gap-0.5">
            {s.items.map((i) => {
              const activo = i.href === "/" ? ruta === "/" : ruta.startsWith(i.href);
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
