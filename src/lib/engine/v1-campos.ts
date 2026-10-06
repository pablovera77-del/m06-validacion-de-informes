import type { ConfigReglas, CampoObligatorio } from "../config/reglas";
import type { Informe, ResultadoValidacion } from "../domain/types";
import { crearAlerta } from "./util";

const NOMBRE_CAMPO: Record<CampoObligatorio, string> = {
  tecnica: "Técnica utilizada",
  hallazgos: "Hallazgos",
  conclusion: "Conclusión / diagnóstico",
  medicoFirmante: "Médico firmante",
};

function valor(informe: Informe, campo: CampoObligatorio): string {
  if (campo === "medicoFirmante") return informe.medicoFirmante ?? "";
  return informe.secciones[campo] ?? "";
}

/** Un campo con solo marcadores ("xx", "___", "-") se considera vacío. */
function contenidoUtil(s: string): string {
  return s.replace(/\bx{2,}\b|_{2,}|-{2,}|\.{3,}/gi, "").replace(/\s+/g, " ").trim();
}

/** V1: campos obligatorios según la matriz configurada para el tipo de estudio. */
export function validarCampos(informe: Informe, reglas: ConfigReglas): ResultadoValidacion {
  const obligatorios = reglas.v1.matriz[informe.tipoEstudio] ?? [];
  const alertas = obligatorios
    .filter((campo) => contenidoUtil(valor(informe, campo)).length < reglas.v1.minCaracteres)
    .map((campo) =>
      crearAlerta({
        informeId: informe.id,
        validacion: "V1",
        nivel: reglas.v1.nivelPorCampo[campo],
        titulo: `Falta completar: ${NOMBRE_CAMPO[campo]}`,
        detalle: `El campo "${NOMBRE_CAMPO[campo]}" es obligatorio para este tipo de estudio y está vacío o solo tiene marcadores sin completar.`,
        evidencia: [
          {
            seccion: campo === "medicoFirmante" ? "firma" : campo,
            fragmento: valor(informe, campo).trim() || "(vacío)",
          },
        ],
        versionReglas: reglas.version,
        clave: campo,
      }),
    );
  return { validacion: "V1", estado: "ejecutada", alertas };
}
