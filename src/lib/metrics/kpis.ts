import type { DatasetDemo, InformeDemo } from "../data/demo";

/** Datos mínimos para calcular indicadores: sirven tanto el dataset sintético como los datos reales de la base. */
export type DatosIndicadores = Pick<DatasetDemo, "informes" | "auditoria">;
import type { CodigoValidacion, Nivel, TipoEstudio } from "../domain/types";
import { NIVELES, VALIDACIONES } from "../domain/types";

export interface Filtros {
  desde?: string;
  hasta?: string;
  medicoId?: string;
  tipoEstudio?: TipoEstudio;
  validacion?: CodigoValidacion;
  nivel?: Nivel;
}

export function filtrar(ds: DatosIndicadores, f: Filtros): InformeDemo[] {
  return ds.informes.filter(
    (x) =>
      (!f.desde || x.informe.fecha.slice(0, 10) >= f.desde) &&
      (!f.hasta || x.informe.fecha.slice(0, 10) <= f.hasta) &&
      (!f.medicoId || x.informe.medicoId === f.medicoId) &&
      (!f.tipoEstudio || x.informe.tipoEstudio === f.tipoEstudio),
  );
}

function alertasDe(xs: InformeDemo[], f: Filtros = {}) {
  return xs.flatMap((x) => x.alertas).filter((a) => (!f.validacion || a.validacion === f.validacion) && (!f.nivel || a.nivel === f.nivel));
}

const pct = (a: number, b: number) => (b ? a / b : 0);

/** Intervalo de Wilson al 95% para una proporción. */
export function wilson(exitos: number, n: number): [number, number] {
  if (!n) return [0, 0];
  const z = 1.96, p = exitos / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - m) / d, (c + m) / d];
}

export interface PuntoControl {
  etiqueta: string;
  n: number;
  valor: number;
  lcs: number;
  lci: number;
  /** Punto fuera de límites o parte de un desplazamiento de 6+ puntos del mismo lado. */
  senal: boolean;
}

/** Gráfico de control p (proporción) con límites a 3 sigma y regla de desplazamiento de 6 puntos. */
export function graficoP(grupos: { etiqueta: string; n: number; casos: number }[]): { puntos: PuntoControl[]; centro: number } {
  const totalN = grupos.reduce((s, g) => s + g.n, 0);
  const centro = pct(grupos.reduce((s, g) => s + g.casos, 0), totalN);
  const puntos = grupos.map((g) => {
    const sigma = g.n ? Math.sqrt((centro * (1 - centro)) / g.n) : 0;
    const valor = pct(g.casos, g.n);
    const lcs = Math.min(1, centro + 3 * sigma), lci = Math.max(0, centro - 3 * sigma);
    return { etiqueta: g.etiqueta, n: g.n, valor, lcs, lci, senal: valor > lcs || valor < lci };
  });
  // Regla de desplazamiento: 6 o más puntos consecutivos del mismo lado de la línea central.
  let inicio = 0;
  for (let i = 1; i <= puntos.length; i++) {
    const lado = (j: number) => Math.sign(puntos[j].valor - centro);
    if (i === puntos.length || lado(i) !== lado(inicio) || lado(i) === 0) {
      if (i - inicio >= 6 && lado(inicio) !== 0) for (let j = inicio; j < i; j++) puntos[j].senal = true;
      inicio = i;
    }
  }
  return { puntos, centro };
}

function semana(fecha: string): string {
  const d = new Date(fecha.slice(0, 10) + "T00:00:00Z");
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}

function agruparPorSemana(xs: InformeDemo[], esCaso: (x: InformeDemo) => boolean) {
  const m = new Map<string, { n: number; casos: number }>();
  for (const x of xs) {
    const k = semana(x.informe.fecha);
    const g = m.get(k) ?? { n: 0, casos: 0 };
    g.n++;
    if (esCaso(x)) g.casos++;
    m.set(k, g);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([etiqueta, g]) => ({ etiqueta, ...g }));
}

export interface PuntoEmbudo {
  medicoId: string;
  n: number;
  valor: number;
  fuera95: boolean;
  fuera998: boolean;
}

/** Funnel plot por médico (Spiegelhalter): tasa según volumen, con límites al 95% y 99,8%. */
export function embudo(xs: InformeDemo[], esCaso: (x: InformeDemo) => boolean) {
  const porMedico = new Map<string, { n: number; casos: number }>();
  for (const x of xs) {
    const g = porMedico.get(x.informe.medicoId) ?? { n: 0, casos: 0 };
    g.n++;
    if (esCaso(x)) g.casos++;
    porMedico.set(x.informe.medicoId, g);
  }
  const total = [...porMedico.values()].reduce((s, g) => s + g.n, 0);
  const p = pct([...porMedico.values()].reduce((s, g) => s + g.casos, 0), total);
  const limite = (n: number, z: number) => [Math.max(0, p - z * Math.sqrt((p * (1 - p)) / n)), Math.min(1, p + z * Math.sqrt((p * (1 - p)) / n))];
  const puntos: PuntoEmbudo[] = [...porMedico.entries()]
    .map(([medicoId, g]) => {
      const v = pct(g.casos, g.n);
      const [a95, b95] = limite(g.n, 1.96), [a998, b998] = limite(g.n, 3.09);
      return { medicoId, n: g.n, valor: v, fuera95: v < a95 || v > b95, fuera998: v < a998 || v > b998 };
    })
    .sort((a, b) => a.medicoId.localeCompare(b.medicoId));
  const maxN = Math.max(...puntos.map((x) => x.n), 1);
  const curva = Array.from({ length: 40 }, (_, i) => {
    const n = Math.max(5, Math.round(((i + 1) / 40) * maxN * 1.05));
    const [a95, b95] = limite(n, 1.96), [a998, b998] = limite(n, 3.09);
    return { n, a95, b95, a998, b998 };
  });
  return { p, puntos, curva };
}

const esCritica = (n: Nivel) => n === "naranja" || n === "roja";

export function calcularKpis(ds: DatosIndicadores, f: Filtros) {
  const xs = filtrar(ds, f);
  const alertas = alertasDe(xs, f);
  const conAlerta = xs.filter((x) => alertasDe([x], f).length > 0);
  const accionables = alertas.filter((a) => a.nivel !== "azul");
  const resueltas = accionables.filter((a) => a.estado === "resuelta");
  const llegaronAFirma = xs.filter((x) => alertasDe([x], f).some((a) => esCritica(a.nivel) && (a.estado === "override" || a.estado === "pendiente")));
  const v4 = alertas.filter((a) => a.validacion === "V4");
  const rojasSinJust = alertas.filter((a) => a.nivel === "roja" && a.estado === "override" && !a.justificacion).length;
  const amarillas = alertas.filter((a) => a.nivel === "amarilla");
  const amarillasSinRevisar = amarillas.filter((a) => a.estado === "pendiente");
  const ids = new Set(alertas.map((a) => a.id));
  const auditadas = ds.auditoria.filter((m) => ids.has(m.alertaId));
  const overridesAuditados = auditadas.filter((m) => m.overrideApropiado !== undefined);

  const porValidacion = VALIDACIONES.map((v) => {
    const av = alertas.filter((a) => a.validacion === v);
    const aud = auditadas.filter((m) => m.validacion === v);
    const correctas = aud.filter((m) => m.correcta).length;
    return {
      validacion: v,
      total: av.length,
      porNivel: Object.fromEntries(NIVELES.map((n) => [n, av.filter((a) => a.nivel === n).length])) as Record<Nivel, number>,
      tasaOverride: pct(av.filter((a) => a.estado === "override").length, av.filter((a) => a.nivel !== "azul").length),
      tasaIncorrecta: pct(av.filter((a) => a.estado === "marcada_incorrecta").length, av.length),
      auditadas: aud.length,
      precision: pct(correctas, aud.length),
      ic: wilson(correctas, aud.length),
    };
  });

  const segundos = (cond: (x: InformeDemo) => boolean) => {
    const v = xs.filter(cond).map((x) => x.segundosHastaFirma).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  };

  return {
    informes: xs.length,
    alertas: alertas.length,
    pctConAlerta: pct(conAlerta.length, xs.length),
    alertasPor100: pct(alertas.length, xs.length) * 100,
    correccionAntesFirma: pct(resueltas.length, accionables.length),
    erroresAFirmaPor1000: pct(llegaronAFirma.length, xs.length) * 1000,
    v4Por10000: pct(v4.length, xs.length) * 10000,
    rojasSinJustificacion: rojasSinJust,
    amarillasSinRevisar: pct(amarillasSinRevisar.length, amarillas.length),
    overridesJustificados: pct(overridesAuditados.filter((m) => m.overrideApropiado).length, overridesAuditados.length),
    overridesAuditados: overridesAuditados.length,
    noEjecutadas: xs.filter((x) => x.resultado.incompleto).length,
    porValidacion,
    controlConAlerta: graficoP(agruparPorSemana(xs, (x) => alertasDe([x], f).length > 0)),
    controlErroresAFirma: graficoP(agruparPorSemana(xs, (x) => llegaronAFirma.includes(x))),
    embudoMedicos: embudo(xs, (x) => alertasDe([x], f).some((a) => esCritica(a.nivel))),
    medianaSegundosConAlerta: segundos((x) => x.alertas.length > 0),
    medianaSegundosSinAlerta: segundos((x) => x.alertas.length === 0),
  };
}

export type Kpis = ReturnType<typeof calcularKpis>;
