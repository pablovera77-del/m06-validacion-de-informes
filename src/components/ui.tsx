import type { ReactNode } from "react";
import type { Nivel } from "@/lib/domain/types";
import { NOMBRE_NIVEL } from "@/lib/domain/types";

export function Tarjeta({ titulo, children, accion, className = "" }: { titulo?: ReactNode; children: ReactNode; accion?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-borde bg-superficie p-5 ${className}`}>
      {(titulo || accion) && (
        <header className="mb-3 flex items-baseline justify-between gap-3">
          {titulo && <h2 className="text-base text-texto">{titulo}</h2>}
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}

export function Encabezado({ titulo, bajada, children }: { titulo: string; bajada?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl text-texto">{titulo}</h1>
        {bajada && <p className="mt-1 max-w-3xl text-sm text-texto-2">{bajada}</p>}
      </div>
      {children}
    </div>
  );
}

const ESTILO_NIVEL: Record<Nivel, { fondo: string; texto: string; borde: string; icono: string }> = {
  azul: { fondo: "bg-azul-fondo", texto: "text-azul", borde: "border-azul", icono: "i" },
  amarilla: { fondo: "bg-amarilla-fondo", texto: "text-amarilla", borde: "border-amarilla", icono: "!" },
  naranja: { fondo: "bg-naranja-fondo", texto: "text-naranja", borde: "border-naranja", icono: "▲" },
  roja: { fondo: "bg-roja-fondo", texto: "text-roja", borde: "border-roja", icono: "■" },
};

export function estiloNivel(n: Nivel) {
  return ESTILO_NIVEL[n];
}

/** Insignia de nivel: color + ícono + texto, nunca solo color. */
export function InsigniaNivel({ nivel, corto = false }: { nivel: Nivel; corto?: boolean }) {
  const e = ESTILO_NIVEL[nivel];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${e.fondo} ${e.texto} ${e.borde}`}>
      <span aria-hidden className="text-[10px] leading-none">{e.icono}</span>
      {corto ? nivel[0].toUpperCase() + nivel.slice(1) : `${nivel[0].toUpperCase() + nivel.slice(1)} · ${NOMBRE_NIVEL[nivel]}`}
    </span>
  );
}

export function Etiqueta({ children, tono = "neutro" }: { children: ReactNode; tono?: "neutro" | "marca" | "ok" | "aviso" }) {
  const t = {
    neutro: "bg-fondo text-texto-2 border-borde",
    marca: "bg-marca-suave text-marca-oscuro border-marca/30",
    ok: "bg-ok-fondo text-ok border-ok/30",
    aviso: "bg-amarilla-fondo text-amarilla border-amarilla/30",
  }[tono];
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${t}`}>{children}</span>;
}

export function Kpi({ titulo, valor, detalle, meta, children }: { titulo: string; valor: string; detalle?: ReactNode; meta?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border border-borde bg-superficie p-4">
      <div className="text-xs uppercase tracking-wide text-texto-2">{titulo}</div>
      <div className="mt-1 font-titulo text-3xl text-texto">{valor}</div>
      {detalle && <div className="mt-1 text-xs text-texto-2">{detalle}</div>}
      {children && <div className="mt-3">{children}</div>}
      {meta && <div className="mt-auto pt-2 text-xs text-texto-3">{meta}</div>}
    </div>
  );
}

export function Aviso({ children, tono = "info" }: { children: ReactNode; tono?: "info" | "aviso" }) {
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${tono === "info" ? "border-marca/30 bg-marca-suave text-marca-oscuro" : "border-amarilla/40 bg-amarilla-fondo text-texto"}`}>
      {children}
    </div>
  );
}

export const fmtPct = (x: number, d = 1) => `${(x * 100).toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d })}%`;
export const fmtNum = (x: number, d = 0) => x.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
