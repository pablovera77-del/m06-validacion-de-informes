import Link from "next/link";
import { redirect } from "next/navigation";
import { datasetDemo } from "@/lib/data/demo";
import { ejecutarSetPrueba } from "@/lib/engine/ejecutar-pruebas";
import { verificarCadena } from "@/lib/audit/log";
import { calcularKpis } from "@/lib/metrics/kpis";
import { reglasVigentes } from "@/lib/config/reglas";
import { promptVigente } from "@/lib/config/prompts";
import { NOMBRE_VALIDACION, VALIDACIONES } from "@/lib/domain/types";
import { Encabezado, Etiqueta, Kpi, Tarjeta, fmtNum, fmtPct } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth/sesion";

const TIPO_VALIDACION: Record<string, string> = { V1: "Regla", V2: "Regla", V3A: "IA", V3B: "Regla", V4: "Regla", V5: "Regla + IA" };

export default async function Inicio() {
  const u = await exigirUsuario();
  if (u.rol === "medico") redirect("/medico"); // el médico entra directo a su bandeja
  const [ds, pruebas] = await Promise.all([datasetDemo(), ejecutarSetPrueba()]);
  const k = calcularKpis(ds, {});
  const v = verificarCadena(ds.log.listar());
  const accesos = [
    { href: "/medico", titulo: "Vista del médico", texto: "Cómo ve el médico las alertas antes de firmar, con revisión, override y marca de alerta incorrecta." },
    { href: "/calidad", titulo: "Panel de Calidad", texto: "Indicadores, gráficos de control, comparación entre médicos y exportación mensual." },
    { href: "/pruebas", titulo: "Set de prueba", texto: "Casos de referencia CA01–CA08 ejecutados contra la versión vigente." },
    { href: "/configuracion/prompts", titulo: "Prompts de IA", texto: "El texto exacto que recibe el modelo, sus versiones y una prueba en vivo." },
  ];
  return (
    <>
      <Encabezado
        titulo="Validación de informes antes de la firma"
        bajada="Control de calidad documental del informe: el sistema lee el informe, alerta posibles errores y registra la decisión del médico. Nunca bloquea la firma ni modifica el informe."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Set de prueba" valor={`${pruebas.aprobados}/${pruebas.total}`} detalle={pruebas.aprobados === pruebas.total ? "✓ Todos los casos aprobados" : "✗ Hay casos que no aprueban"} meta={`Reglas ${pruebas.versionReglas}`} />
        <Kpi titulo="Informes validados (demo)" valor={fmtNum(k.informes)} detalle={`${fmtPct(k.pctConAlerta)} con alguna alerta`} meta="Últimos 90 días, datos sintéticos" />
        <Kpi titulo="Corregidas antes de firmar" valor={fmtPct(k.correccionAntesFirma)} detalle="de las alertas amarillas, naranjas y rojas" />
        <Kpi titulo="Log de auditoría" valor={v.integro ? "✓ Íntegro" : "✗ Alterado"} detalle={`${fmtNum(v.entradasVerificadas)} entradas verificadas`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {accesos.map((a) => (
            <Link key={a.href} href={a.href} className="group rounded-lg border border-borde bg-superficie p-5 hover:border-marca">
              <h2 className="text-base group-hover:text-marca">{a.titulo} →</h2>
              <p className="mt-1 text-sm text-texto-2">{a.texto}</p>
            </Link>
          ))}
        </div>
        <Tarjeta titulo="Validaciones activas">
          <ul className="flex flex-col gap-2 text-sm">
            {VALIDACIONES.map((x) => (
              <li key={x} className="flex items-center justify-between gap-3">
                <span><span className="font-mono text-xs text-texto-2">{x}</span> {NOMBRE_VALIDACION[x]}</span>
                <Etiqueta tono={TIPO_VALIDACION[x].includes("IA") ? "marca" : "neutro"}>{TIPO_VALIDACION[x]}</Etiqueta>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-borde pt-3 text-xs text-texto-2">
            Reglas {reglasVigentes().version} · prompts {promptVigente("V3A").version}, {promptVigente("V5").version}
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
