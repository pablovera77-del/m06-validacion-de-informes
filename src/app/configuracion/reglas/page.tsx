import { HISTORIAL_REGLAS, reglasVigentes } from "@/lib/config/reglas";
import { NOMBRE_ESTUDIO, TIPOS_ESTUDIO } from "@/lib/domain/types";
import { Encabezado, Etiqueta, InsigniaNivel, Tarjeta, fmtPct } from "@/components/ui";
import { ACCESO, exigirUsuario } from "@/lib/auth/sesion";

const CAMPOS = { tecnica: "Técnica", hallazgos: "Hallazgos", conclusion: "Conclusión", medicoFirmante: "Médico firmante" } as const;

export default async function Reglas() {
  await exigirUsuario(ACCESO.configuracion);
  const r = reglasVigentes();
  return (
    <>
      <Encabezado titulo="Reglas y umbrales" bajada="Configuración versionada de las validaciones determinísticas. Los valores marcados como pendientes requieren aprobación del equipo médico o de Calidad.">
        <Etiqueta tono="marca">{r.version} · vigente desde {r.vigenteDesde}</Etiqueta>
      </Encabezado>

      <div className="grid gap-6 xl:grid-cols-2">
        <Tarjeta titulo="V1 · Matriz de campos obligatorios" accion={<Etiqueta tono="aviso">Pendiente de aprobación médica</Etiqueta>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-texto-2"><tr><th className="py-1 font-medium">Estudio</th>{Object.values(CAMPOS).map((c) => <th key={c} className="py-1 text-center font-medium">{c}</th>)}</tr></thead>
              <tbody>
                {TIPOS_ESTUDIO.map((t) => (
                  <tr key={t} className="border-t border-borde">
                    <td className="py-1.5">{NOMBRE_ESTUDIO[t]}</td>
                    {(Object.keys(CAMPOS) as (keyof typeof CAMPOS)[]).map((c) => <td key={c} className="text-center">{r.v1.matriz[t].includes(c) ? "●" : "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-texto-2">
            Nivel por campo faltante: {(Object.keys(CAMPOS) as (keyof typeof CAMPOS)[]).map((c) => <span key={c} className="inline-flex items-center gap-1">{CAMPOS[c]} <InsigniaNivel nivel={r.v1.nivelPorCampo[c]} corto /></span>)}
          </div>
        </Tarjeta>

        <Tarjeta titulo="V2 · Contenido duplicado" accion={<Etiqueta tono="aviso">Umbrales a ajustar tras pruebas</Etiqueta>}>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-texto-2">Advertencia (amarilla)</dt><dd>≥ {fmtPct(r.v2.umbralAdvertencia, 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-texto-2">Crítica (naranja)</dt><dd>≥ {fmtPct(r.v2.umbralCritico, 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-texto-2">Informes comparados</dt><dd>últimos {r.v2.cantidadHistorial} del mismo médico y estudio</dd></div>
            <div className="flex justify-between"><dt className="text-texto-2">Mínimo para comparar</dt><dd>{r.v2.minPalabras} palabras</dd></div>
            <div className="flex justify-between"><dt className="text-texto-2">Método</dt><dd>contención de trigramas de palabras (determinístico)</dd></div>
          </dl>
          <div className="mt-3 rounded-md bg-fondo p-3 text-xs text-texto-2">
            <b className="text-texto">Supuestos para evitar falsos positivos (a validar con Calidad):</b> no se alerta si alguna medida cambió respecto del informe anterior ({r.v2.ignorarSiMedidasCambian ? "activado" : "desactivado"}), ni si el texto corresponde a una plantilla aprobada del servicio ({r.v2.plantillasAprobadas.length} cargada{r.v2.plantillasAprobadas.length === 1 ? "" : "s"}). Sin esto, todo informe normal hecho con plantilla superaría el 70%.
          </div>
        </Tarjeta>

        <Tarjeta titulo="V3B · Densitometría">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-texto-2">Normal</dt><dd>T-score ≥ {r.v3b.limiteNormal.toFixed(1)}</dd></div>
            <div className="flex justify-between"><dt className="text-texto-2">Osteopenia</dt><dd>entre {r.v3b.limiteNormal.toFixed(1)} y {r.v3b.limiteOsteoporosis.toFixed(1)}</dd></div>
            <div className="flex justify-between"><dt className="text-texto-2">Osteoporosis</dt><dd>T-score ≤ {r.v3b.limiteOsteoporosis.toFixed(1)}</dd></div>
            <div className="flex justify-between"><dt className="text-texto-2">Si no coincide</dt><dd><InsigniaNivel nivel={r.v3b.nivelInconsistencia} corto /></dd></div>
          </dl>
          <p className="mt-3 text-xs text-texto-2">Con varios sitios medidos se usa el T-score más bajo. Las menciones negadas («sin osteoporosis») no cuentan como clasificación.</p>
        </Tarjeta>

        <Tarjeta titulo="V4 · Identidad del paciente">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-texto-2">Un dato distinto</dt><dd><InsigniaNivel nivel={r.v4.nivelUnaDiscrepancia} corto /></dd></div>
            <div className="flex justify-between"><dt className="text-texto-2">Más de un dato distinto</dt><dd><InsigniaNivel nivel={r.v4.nivelVariasDiscrepancias} corto /></dd></div>
            <div className="flex justify-between"><dt className="text-texto-2">Turno no encontrado</dt><dd>{r.v4.nivelSinTurno ? <InsigniaNivel nivel={r.v4.nivelSinTurno} corto /> : <span className="text-texto-2">No se verifica (sin alerta)</span>}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-texto-2">Compara apellido y nombre, DNI, fecha de nacimiento y tipo de estudio. Antes de comparar normaliza tildes, mayúsculas, orden de nombre y apellido, puntos del DNI y formato de fecha. No usa IA.</p>
        </Tarjeta>

        <Tarjeta titulo="V5 · Órganos esperados por estudio" accion={<Etiqueta tono="aviso">Pendiente de validación médica</Etiqueta>} className="xl:col-span-2">
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(r.v5.organos).map(([tipo, organos]) => (
              <div key={tipo}>
                <h3 className="mb-1 text-sm">{NOMBRE_ESTUDIO[tipo as keyof typeof NOMBRE_ESTUDIO]}</h3>
                <ul className="text-sm text-texto-2">{organos!.map((o) => <li key={o.id}>{o.nombre}{o.requiereMedida ? " · requiere medida" : ""}</li>)}</ul>
              </div>
            ))}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-texto-2">
            Marcador sin completar («xx mm») <InsigniaNivel nivel={r.v5.nivelPlaceholder} corto /> · medida faltante sin explicación <InsigniaNivel nivel={r.v5.nivelFaltanteSinExplicacion} corto />
          </p>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Historial de versiones" className="mt-6">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-texto-2"><tr><th className="py-1 font-medium">Versión</th><th className="py-1 font-medium">Estado</th><th className="py-1 font-medium">Autor</th><th className="py-1 font-medium">Aprobó</th><th className="py-1 font-medium">Motivo</th></tr></thead>
          <tbody>
            {HISTORIAL_REGLAS.map((h) => (
              <tr key={h.version} className="border-t border-borde"><td className="py-1.5 font-mono text-xs">{h.version}</td><td>{h.estado}</td><td>{h.autor}</td><td>{h.aprobadoPor}</td><td className="text-texto-2">{h.motivo}</td></tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
    </>
  );
}
