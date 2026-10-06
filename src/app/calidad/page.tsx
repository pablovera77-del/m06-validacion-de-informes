import { datasetDemo } from "@/lib/data/demo";
import { hayBaseDeDatos } from "@/lib/db/cliente";
import { datasetReal } from "@/lib/db/panel";
import { MEDICOS } from "@/lib/data/plantillas";
import { calcularKpis, type Filtros } from "@/lib/metrics/kpis";
import { NIVELES, NOMBRE_ESTUDIO, NOMBRE_VALIDACION, TIPOS_ESTUDIO, VALIDACIONES, type CodigoValidacion, type Nivel, type TipoEstudio } from "@/lib/domain/types";
import { Aviso, Encabezado, Kpi, Tarjeta, fmtNum, fmtPct } from "@/components/ui";
import { BarraProporcion, BarrasMensuales, BarrasNivel, GraficoControl, GraficoEmbudo } from "@/components/graficos";
import { ACCESO, exigirUsuario } from "@/lib/auth/sesion";

/** Etiqueta anónima estable (A, B, … Z, AA…) para no exponer la identidad del médico fuera de Calidad. */
function anonimo(i: number): string {
  const n = ((i * 7) % 26) + 26 * Math.floor(i / 26);
  return n < 26 ? String.fromCharCode(65 + n) : String.fromCharCode(64 + Math.floor(n / 26)) + String.fromCharCode(65 + (n % 26));
}

function rangoPorDefecto() {
  const ahora = Date.now();
  return { hoy: new Date(ahora).toISOString().slice(0, 10), hace90: new Date(ahora - 89 * 86400000).toISOString().slice(0, 10) };
}

const META_PRECISION: Partial<Record<CodigoValidacion, number>> = { V1: 0.8, V4: 0.8, V3A: 0.6 };

export default async function PanelCalidad({ searchParams }: PageProps<"/calidad">) {
  await exigirUsuario(ACCESO.calidad);
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const conDb = hayBaseDeDatos();
  const fuente = conDb && str("fuente") !== "demo" ? "real" : "demo";
  const { hoy, hace90 } = rangoPorDefecto();
  const ds = fuente === "real" ? await datasetReal(str("desde") ?? hace90, str("hasta") ?? hoy) : await datasetDemo();
  const f: Filtros = {
    desde: str("desde") ?? ds.desde.slice(0, 10),
    hasta: str("hasta") ?? ds.hasta.slice(0, 10),
    medicoId: str("medico"),
    tipoEstudio: str("estudio") as TipoEstudio | undefined,
    validacion: str("validacion") as CodigoValidacion | undefined,
    nivel: str("nivel") as Nivel | undefined,
  };
  const mostrarNombres = str("nombres") === "1";
  const k = calcularKpis(ds, f);
  const idsMedicos = [...new Set([...MEDICOS.map((m) => m.id), ...ds.informes.map((x) => x.informe.medicoId)])].sort();
  const etiquetaMedico = (id: string) => (mostrarNombres ? (MEDICOS.find((m) => m.id === id)?.nombre ?? id) : `Médico ${anonimo(idsMedicos.indexOf(id))}`);
  const sel = "rounded-md border border-borde bg-superficie px-2 py-1.5 text-sm";
  const meses = [...new Set(ds.informes.map((x) => x.informe.fecha.slice(0, 7)))].sort();

  return (
    <>
      <Encabezado
        titulo="Panel de Calidad"
        bajada="Indicadores del control previo a la firma (ISO 9001:2015, 8.5.1, 8.7 y 9.1). Gráficos de control en lugar de semáforos: se marca solo la variación que no es esperable."
      >
        <div className="flex gap-2">
          <a href={`/api/exportar?tipo=alertas&fuente=${fuente}&mes=${f.hasta?.slice(0, 7)}`} className="rounded-md border border-marca px-3 py-1.5 text-sm text-marca hover:bg-marca hover:text-white">
            Exportar mes a Excel (CSV)
          </a>
        </div>
      </Encabezado>

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-borde bg-superficie p-3" method="get">
        <label className="flex flex-col gap-1 text-xs text-texto-2">Datos
          <select name="fuente" defaultValue={fuente} className={sel}>
            {conDb && <option value="real">Informes procesados</option>}
            <option value="demo">Demostración (sintéticos)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-texto-2">Desde<input type="date" name="desde" defaultValue={f.desde} className={sel} /></label>
        <label className="flex flex-col gap-1 text-xs text-texto-2">Hasta<input type="date" name="hasta" defaultValue={f.hasta} className={sel} /></label>
        <label className="flex flex-col gap-1 text-xs text-texto-2">Médico
          <select name="medico" defaultValue={f.medicoId ?? ""} className={sel}>
            <option value="">Todos</option>
            {idsMedicos.filter((id) => fuente === "demo" ? id.startsWith("M") : ds.informes.some((x) => x.informe.medicoId === id)).map((id) => <option key={id} value={id}>{etiquetaMedico(id)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-texto-2">Estudio
          <select name="estudio" defaultValue={f.tipoEstudio ?? ""} className={sel}>
            <option value="">Todos</option>
            {TIPOS_ESTUDIO.map((t) => <option key={t} value={t}>{NOMBRE_ESTUDIO[t]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-texto-2">Validación
          <select name="validacion" defaultValue={f.validacion ?? ""} className={sel}>
            <option value="">Todas</option>
            {VALIDACIONES.map((v) => <option key={v} value={v}>{v} · {NOMBRE_VALIDACION[v]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-texto-2">Nivel
          <select name="nivel" defaultValue={f.nivel ?? ""} className={sel}>
            <option value="">Todos</option>
            {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-xs text-texto-2">
          <input type="checkbox" name="nombres" value="1" defaultChecked={mostrarNombres} className="accent-[var(--marca)]" /> Mostrar nombres (solo Calidad)
        </label>
        <button className="rounded-md bg-marca px-4 py-1.5 text-sm text-white hover:bg-marca-oscuro">Aplicar</button>
      </form>

      {k.informes === 0 ? (
        <Aviso>No hay informes para los filtros elegidos.</Aviso>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi titulo="Informes validados" valor={fmtNum(k.informes)} detalle={`${fmtNum(k.alertas)} alertas · ${fmtNum(k.alertasPor100, 1)} cada 100 informes`} meta={k.noEjecutadas ? `${k.noEjecutadas} con alguna validación no ejecutada` : "Todas las validaciones se ejecutaron"} />
            <Kpi titulo="Informes con alguna alerta" valor={fmtPct(k.pctConAlerta)} detalle="Resultado · tendencia a la baja" meta="Meta propia, a fijar con línea de base" />
            <Kpi titulo="Corregidas antes de firmar" valor={fmtPct(k.correccionAntesFirma)} detalle="Proceso · alertas amarillas, naranjas y rojas" meta="Meta propia: 70–80%" />
            <Kpi titulo="Errores que llegan a la firma" valor={fmtNum(k.erroresAFirmaPor1000, 1)} detalle="cada 1.000 informes (naranja/roja firmada sin corregir)" meta="Resultado · tendencia a la baja" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Tarjeta titulo="Informes con alguna alerta, por semana">
              <GraficoControl titulo="Proporción semanal de informes con alerta" puntos={k.controlConAlerta.puntos} centro={k.controlConAlerta.centro} intervenciones={ds.intervenciones} />
            </Tarjeta>
            <Tarjeta titulo="Errores críticos que llegan a la firma, por semana">
              <GraficoControl titulo="Proporción semanal de informes firmados con alerta crítica sin corregir" puntos={k.controlErroresAFirma.puntos} centro={k.controlErroresAFirma.centro} intervenciones={ds.intervenciones} />
            </Tarjeta>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Tarjeta titulo="Alertas por validación y nivel">
              <BarrasNivel filas={k.porValidacion.map((v) => ({ etiqueta: `${v.validacion} · ${NOMBRE_VALIDACION[v.validacion]}`, porNivel: v.porNivel }))} />
            </Tarjeta>
            <Tarjeta titulo="Alertas críticas por médico" accion={<span className="text-xs text-texto-2">Funnel plot · sin ranking</span>}>
              <GraficoEmbudo {...k.embudoMedicos} etiqueta={etiquetaMedico} />
              <p className="mt-2 text-xs text-texto-2">
                Cada punto es un médico. Solo los que quedan fuera del límite del 99,8% muestran su identificador: es una señal para conversar, no un ranking.
              </p>
            </Tarjeta>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Tarjeta titulo="Precisión de las alertas (auditoría por muestreo)">
              <div className="flex flex-col gap-2">
                {k.porValidacion.map((v) => (
                  <BarraProporcion key={v.validacion} etiqueta={`${v.validacion} · ${NOMBRE_VALIDACION[v.validacion]}`} valor={v.precision} ic={v.ic} n={v.auditadas} meta={META_PRECISION[v.validacion]} />
                ))}
              </div>
              <p className="mt-3 text-xs text-texto-2">Alertas confirmadas como reales por Calidad. La línea indica el intervalo de confianza del 95%; la marca verde, la meta propuesta.</p>
            </Tarjeta>
            <Tarjeta titulo="Override y alertas marcadas incorrectas">
              <div className="flex flex-col gap-2">
                {k.porValidacion.map((v) => (
                  <BarraProporcion key={v.validacion} etiqueta={`${v.validacion} override`} valor={v.tasaOverride} meta={0.3} />
                ))}
              </div>
              <p className="mt-3 text-xs text-texto-2">
                Más de 30% de override en una validación dispara la revisión de la regla (meta propia). Un override alto no es malo en sí: hay que mirarlo junto con la precisión.
              </p>
            </Tarjeta>
            <Tarjeta titulo="Balance y supervisión humana">
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-texto-2">Amarillas sin «revisado»</dt><dd className="tabular-nums">{fmtPct(k.amarillasSinRevisar)} <span className="text-xs text-texto-3">meta &lt; 5%</span></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-texto-2">Overrides con justificación válida</dt><dd className="tabular-nums">{k.overridesAuditados ? fmtPct(k.overridesJustificados) : "s/d"} <span className="text-xs text-texto-3">meta ≥ 90%</span></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-texto-2">Rojas firmadas sin justificación</dt><dd className="tabular-nums">{k.rojasSinJustificacion} <span className="text-xs text-texto-3">meta 0</span></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-texto-2">Identidad (V4) cada 10.000</dt><dd className="tabular-nums">{fmtNum(k.v4Por10000, 1)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-texto-2">Tiempo hasta firmar (mediana)</dt><dd className="tabular-nums">{k.medianaSegundosConAlerta}s con alerta · {k.medianaSegundosSinAlerta}s sin</dd></div>
              </dl>
            </Tarjeta>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Tarjeta titulo="Débitos atribuibles al informe, por mes">
              <BarrasMensuales datos={ds.debitos.filter((d) => meses.includes(d.mes)).map((d) => ({ mes: d.mes, valor: d.causaInforme, detalle: `${d.causaInforme} débitos por informe ($ ${fmtNum(d.montoInforme)}) · ${d.causaOtra} por otras causas` }))} />
              <p className="mt-2 text-xs text-texto-2">Dato cargado por Administración (HU25). Pendiente de validar cómo se codifica hoy el motivo del débito.</p>
            </Tarjeta>
            <Tarjeta titulo="Acciones correctivas (ISO 9001, 10.2)">
              <ul className="flex flex-col gap-3 text-sm">
                {ds.acciones.map((a) => (
                  <li key={a.id} className="border-b border-borde pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between gap-3"><span className="font-mono text-xs text-texto-2">{a.id} · {a.fecha}</span><span className="text-xs">{a.estado.replace("_", " ")}</span></div>
                    <p className="mt-1">{a.patron}</p>
                    <p className="text-texto-2">{a.accion} · {a.responsable}</p>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          </div>
          <p className="text-xs text-texto-3">
            {fuente === "demo" ? `Datos sintéticos de ${ds.desde.slice(0, 10)} a ${ds.hasta.slice(0, 10)}, generados con el motor real de validación.` : `Informes procesados entre ${f.desde} y ${f.hasta}.`} Las metas marcadas como propias se fijan después de 2–3 meses de línea de base.
          </p>
        </div>
      )}
    </>
  );
}
