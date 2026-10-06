import type { PuntoControl, PuntoEmbudo } from "@/lib/metrics/kpis";
import type { Nivel } from "@/lib/domain/types";
import { NIVELES } from "@/lib/domain/types";
import { fmtPct } from "./ui";

/*
 * Gráficos SVG sin dependencias. Criterios: marcas finas, grilla tenue, texto en tinta (nunca del color de la serie),
 * una sola escala por gráfico y tooltip nativo en cada marca. Los colores de alerta solo se usan para niveles de alerta.
 */

const ANCHO = 640;
const SERIE = "var(--marca)";
const LIMITE = "var(--gris-claro)";
const TINTA_2 = "var(--texto-2)";

function escala(d0: number, d1: number, r0: number, r1: number) {
  return (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
}

function fechaCorta(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Gráfico de control p: proporción semanal con línea central y límites a 3 sigma. */
export function GraficoControl({ puntos, centro, titulo, meta, intervenciones = [] }: {
  puntos: PuntoControl[];
  centro: number;
  titulo: string;
  meta?: number;
  intervenciones?: { fecha: string; texto: string }[];
}) {
  const alto = 220, m = { t: 16, r: 16, b: 28, l: 44 };
  if (puntos.length === 0) return <p className="text-sm text-texto-2">Sin datos en el período.</p>;
  const maxY = Math.max(...puntos.map((p) => Math.max(p.valor, p.lcs)), meta ?? 0) * 1.1 || 0.1;
  const x = escala(0, Math.max(puntos.length - 1, 1), m.l, ANCHO - m.r);
  const y = escala(0, maxY, alto - m.b, m.t);
  const ticks = [0, maxY / 2, maxY];
  const pasos = (sel: (p: PuntoControl) => number) =>
    puntos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(sel(p)).toFixed(1)}`).join(" ");
  const idxInterv = intervenciones
    .map((iv) => ({ ...iv, i: puntos.findIndex((p, k) => p.etiqueta <= iv.fecha && (puntos[k + 1]?.etiqueta ?? "9999") > iv.fecha) }))
    .filter((iv) => iv.i >= 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${ANCHO} ${alto}`} role="img" aria-label={titulo} className="h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={ANCHO - m.r} y1={y(t)} y2={y(t)} stroke="var(--borde)" />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={TINTA_2}>{fmtPct(t, 0)}</text>
          </g>
        ))}
        {idxInterv.map((iv) => (
          <g key={iv.fecha}>
            <line x1={x(iv.i)} x2={x(iv.i)} y1={m.t} y2={alto - m.b} stroke={TINTA_2} strokeDasharray="2 3" />
            <text x={x(iv.i) + 4} y={m.t + 8} fontSize="11" fill={TINTA_2}>{iv.texto}</text>
          </g>
        ))}
        <path d={pasos((p) => p.lcs)} fill="none" stroke={LIMITE} strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={pasos((p) => p.lci)} fill="none" stroke={LIMITE} strokeWidth={1.5} strokeDasharray="4 3" />
        <line x1={m.l} x2={ANCHO - m.r} y1={y(centro)} y2={y(centro)} stroke={TINTA_2} strokeWidth={1} />
        {meta !== undefined && <line x1={m.l} x2={ANCHO - m.r} y1={y(meta)} y2={y(meta)} stroke="var(--ok)" strokeWidth={1} strokeDasharray="6 4" />}
        <path d={pasos((p) => p.valor)} fill="none" stroke={SERIE} strokeWidth={2} />
        {puntos.map((p, i) => (
          <g key={p.etiqueta}>
            <circle cx={x(i)} cy={y(p.valor)} r={p.senal ? 5 : 3.5} fill={p.senal ? "var(--superficie)" : SERIE} stroke={SERIE} strokeWidth={p.senal ? 2.5 : 0} />
            <circle cx={x(i)} cy={y(p.valor)} r={12} fill="transparent">
              <title>{`Semana del ${fechaCorta(p.etiqueta)}: ${fmtPct(p.valor)} (n=${p.n}). Límites ${fmtPct(p.lci)}–${fmtPct(p.lcs)}${p.senal ? ". Señal de causa especial" : ""}`}</title>
            </circle>
          </g>
        ))}
        {puntos.map((p, i) => (i % Math.ceil(puntos.length / 7) === 0 ? (
          <text key={`x${i}`} x={x(i)} y={alto - 8} textAnchor="middle" fontSize="11" fill={TINTA_2}>{fechaCorta(p.etiqueta)}</text>
        ) : null))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-2">
        <span><span className="inline-block h-0.5 w-4 align-middle" style={{ background: SERIE }} /> Semanal</span>
        <span><span className="inline-block h-px w-4 align-middle" style={{ background: TINTA_2 }} /> Media {fmtPct(centro)}</span>
        <span><span className="inline-block w-4 border-t border-dashed align-middle" style={{ borderColor: LIMITE }} /> Límites de control (3σ)</span>
        <span>○ Señal (fuera de límites o 6 semanas seguidas del mismo lado)</span>
        {meta !== undefined && <span><span className="inline-block w-4 border-t border-dashed align-middle" style={{ borderColor: "var(--ok)" }} /> Meta {fmtPct(meta, 0)}</span>}
      </figcaption>
    </figure>
  );
}

/** Funnel plot: tasa por médico según su volumen, con límites al 95% y 99,8%. Sin ranking. */
export function GraficoEmbudo({ p, puntos, curva, etiqueta }: { p: number; puntos: PuntoEmbudo[]; curva: { n: number; a95: number; b95: number; a998: number; b998: number }[]; etiqueta: (id: string) => string }) {
  const alto = 260, m = { t: 12, r: 16, b: 34, l: 44 };
  const maxN = Math.max(...curva.map((c) => c.n), 1);
  const maxY = Math.max(...puntos.map((x) => x.valor), ...curva.map((c) => c.b998).slice(4), p * 2) * 1.1 || 0.1;
  const x = escala(0, maxN, m.l, ANCHO - m.r);
  const y = escala(0, maxY, alto - m.b, m.t);
  const linea = (sel: (c: (typeof curva)[number]) => number) => curva.map((c, i) => `${i ? "L" : "M"}${x(c.n).toFixed(1)},${y(Math.min(sel(c), maxY)).toFixed(1)}`).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${ANCHO} ${alto}`} role="img" aria-label="Tasa de alertas críticas por médico según volumen" className="h-auto w-full">
        {[0, maxY / 2, maxY].map((t) => (
          <g key={t}>
            <line x1={m.l} x2={ANCHO - m.r} y1={y(t)} y2={y(t)} stroke="var(--borde)" />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={TINTA_2}>{fmtPct(t, 0)}</text>
          </g>
        ))}
        <path d={linea((c) => c.b998)} fill="none" stroke={LIMITE} strokeWidth={1.5} />
        <path d={linea((c) => c.a998)} fill="none" stroke={LIMITE} strokeWidth={1.5} />
        <path d={linea((c) => c.b95)} fill="none" stroke={LIMITE} strokeWidth={1} strokeDasharray="4 3" />
        <path d={linea((c) => c.a95)} fill="none" stroke={LIMITE} strokeWidth={1} strokeDasharray="4 3" />
        <line x1={m.l} x2={ANCHO - m.r} y1={y(p)} y2={y(p)} stroke={TINTA_2} />
        {puntos.map((pt) => (
          <g key={pt.medicoId}>
            <circle cx={x(pt.n)} cy={y(pt.valor)} r={pt.fuera998 ? 6 : 4.5} fill={pt.fuera998 ? "var(--superficie)" : SERIE} stroke={SERIE} strokeWidth={pt.fuera998 ? 2.5 : 1} />
            {pt.fuera998 && <text x={x(pt.n) + 9} y={y(pt.valor)} dy="0.32em" fontSize="11" fill="var(--texto)">{etiqueta(pt.medicoId)}</text>}
            <circle cx={x(pt.n)} cy={y(pt.valor)} r={12} fill="transparent">
              <title>{`${etiqueta(pt.medicoId)}: ${fmtPct(pt.valor)} en ${pt.n} informes${pt.fuera998 ? " · fuera del límite 99,8%" : pt.fuera95 ? " · fuera del límite 95%" : ""}`}</title>
            </circle>
          </g>
        ))}
        <text x={(m.l + ANCHO - m.r) / 2} y={alto - 6} textAnchor="middle" fontSize="11" fill={TINTA_2}>Informes en el período (volumen)</text>
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-2">
        <span>● Médico</span><span>○ Fuera del límite 99,8% (revisar)</span>
        <span><span className="inline-block h-px w-4 align-middle" style={{ background: TINTA_2 }} /> Promedio {fmtPct(p)}</span>
        <span><span className="inline-block w-4 border-t border-dashed align-middle" style={{ borderColor: LIMITE }} /> 95%</span>
        <span><span className="inline-block h-0.5 w-4 align-middle" style={{ background: LIMITE }} /> 99,8%</span>
      </figcaption>
    </figure>
  );
}

const COLOR_NIVEL: Record<Nivel, string> = { azul: "var(--azul)", amarilla: "var(--amarilla-marca)", naranja: "var(--naranja-marca)", roja: "var(--roja-marca)" };
const ICONO_NIVEL: Record<Nivel, string> = { azul: "i", amarilla: "!", naranja: "▲", roja: "■" };

/** Barras horizontales apiladas por nivel, una por validación. */
export function BarrasNivel({ filas }: { filas: { etiqueta: string; porNivel: Record<Nivel, number> }[] }) {
  const max = Math.max(...filas.map((f) => NIVELES.reduce((s, n) => s + f.porNivel[n], 0)), 1);
  return (
    <div className="flex flex-col gap-2">
      {filas.map((f) => {
        const total = NIVELES.reduce((s, n) => s + f.porNivel[n], 0);
        return (
          <div key={f.etiqueta} className="grid grid-cols-[150px_1fr_44px] items-center gap-3 text-sm">
            <span className="truncate text-texto-2">{f.etiqueta}</span>
            <div className="flex h-4 gap-[2px]" style={{ width: `${(total / max) * 100}%` }}>
              {NIVELES.filter((n) => f.porNivel[n] > 0).map((n) => (
                <div key={n} title={`${f.etiqueta} · ${n}: ${f.porNivel[n]}`} className="h-full first:rounded-l last:rounded-r" style={{ width: `${(f.porNivel[n] / total) * 100}%`, background: COLOR_NIVEL[n] }} />
              ))}
            </div>
            <span className="text-right tabular-nums">{total}</span>
          </div>
        );
      })}
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-texto-2">
        {NIVELES.map((n) => (
          <span key={n} className="inline-flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: COLOR_NIVEL[n] }} />
            <span aria-hidden>{ICONO_NIVEL[n]}</span> {n[0].toUpperCase() + n.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barra de proporción con intervalo de confianza y meta. */
export function BarraProporcion({ valor, ic, meta, etiqueta, n }: { valor: number; ic?: [number, number]; meta?: number; etiqueta: string; n?: number }) {
  return (
    <div className="grid grid-cols-[150px_1fr_80px] items-center gap-3 text-sm">
      <span className="truncate text-texto-2">{etiqueta}</span>
      <div className="relative h-4 rounded bg-fondo" title={`${etiqueta}: ${fmtPct(valor)}${ic ? ` (IC95% ${fmtPct(ic[0])}–${fmtPct(ic[1])})` : ""}${n !== undefined ? `, n=${n}` : ""}`}>
        <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(valor, 1) * 100}%`, background: SERIE }} />
        {ic && n ? <div className="absolute top-1/2 h-px -translate-y-1/2 bg-texto" style={{ left: `${ic[0] * 100}%`, width: `${(ic[1] - ic[0]) * 100}%` }} /> : null}
        {meta !== undefined && <div className="absolute -inset-y-1 w-0.5 bg-ok" style={{ left: `${meta * 100}%` }} title={`Meta ${fmtPct(meta, 0)}`} />}
      </div>
      <span className="text-right tabular-nums">{n === 0 ? "s/d" : fmtPct(valor)}</span>
    </div>
  );
}

/** Serie mensual de débitos (barras) con anotación de monto. */
export function BarrasMensuales({ datos }: { datos: { mes: string; valor: number; detalle: string }[] }) {
  const max = Math.max(...datos.map((d) => d.valor), 1);
  return (
    <div className="flex h-40 items-end gap-3">
      {datos.map((d) => (
        <div key={d.mes} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs tabular-nums text-texto">{d.valor}</span>
          <div title={d.detalle} className="w-full max-w-14 rounded-t" style={{ height: `${(d.valor / max) * 110}px`, background: SERIE }} />
          <span className="text-xs text-texto-2">{d.mes.slice(5)}/{d.mes.slice(2, 4)}</span>
        </div>
      ))}
    </div>
  );
}
