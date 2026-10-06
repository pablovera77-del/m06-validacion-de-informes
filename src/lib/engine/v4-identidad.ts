import type { ConfigReglas } from "../config/reglas";
import type { ContextoValidacion, Evidencia, Informe, ResultadoValidacion } from "../domain/types";
import { NOMBRE_ESTUDIO } from "../domain/types";
import { normalizarDni, normalizarFecha, normalizarNombre, normalizarTipoEstudio } from "../domain/normalize";
import { crearAlerta } from "./util";

interface Discrepancia {
  campo: string;
  informe: string;
  turno: string;
}

/**
 * V4: cruce determinístico del encabezado contra el turno. No usa IA.
 * Normaliza tildes, mayúsculas, orden de nombre y apellido, puntos del DNI y formato de fecha.
 * Los valores comparados solo se muestran al médico; no se envían a ningún servicio externo.
 */
export function validarIdentidad(
  informe: Informe,
  ctx: ContextoValidacion,
  reglas: ConfigReglas,
): ResultadoValidacion {
  const turno = ctx.turno;
  if (!turno) {
    return {
      validacion: "V4",
      estado: "ejecutada",
      alertas: [
        crearAlerta({
          informeId: informe.id,
          validacion: "V4",
          nivel: reglas.v4.nivelSinTurno,
          titulo: "No se encontró el turno asociado",
          detalle: `No hay un turno con el identificador ${informe.turnoId} en el sistema de origen. No se pudo verificar la identidad del paciente.`,
          versionReglas: reglas.version,
          clave: "sin-turno",
        }),
      ],
    };
  }

  const e = informe.encabezado;
  const d: Discrepancia[] = [];
  if (normalizarNombre(e.apellidoNombre) !== normalizarNombre(turno.apellidoNombre))
    d.push({ campo: "Apellido y nombre", informe: e.apellidoNombre ?? "(vacío)", turno: turno.apellidoNombre });
  if (normalizarDni(e.dni) !== normalizarDni(turno.dni))
    d.push({ campo: "DNI", informe: e.dni ?? "(vacío)", turno: turno.dni });
  if (!normalizarFecha(e.fechaNacimiento) || normalizarFecha(e.fechaNacimiento) !== normalizarFecha(turno.fechaNacimiento))
    d.push({ campo: "Fecha de nacimiento", informe: e.fechaNacimiento ?? "(vacío)", turno: turno.fechaNacimiento });
  if (normalizarTipoEstudio(e.tipoEstudio) !== turno.tipoEstudio)
    d.push({ campo: "Tipo de estudio", informe: e.tipoEstudio ?? "(vacío)", turno: NOMBRE_ESTUDIO[turno.tipoEstudio] });

  if (d.length === 0) return { validacion: "V4", estado: "ejecutada", alertas: [] };

  const nivel = d.length === 1 ? reglas.v4.nivelUnaDiscrepancia : reglas.v4.nivelVariasDiscrepancias;
  const evidencia: Evidencia[] = d.map((x) => ({
    seccion: "encabezado",
    fragmento: `${x.campo}: informe "${x.informe}" / turno "${x.turno}"`,
  }));
  return {
    validacion: "V4",
    estado: "ejecutada",
    alertas: [
      crearAlerta({
        informeId: informe.id,
        validacion: "V4",
        nivel,
        titulo:
          d.length === 1
            ? `${d[0].campo} no coincide con el turno`
            : `${d.length} datos de identidad no coinciden con el turno`,
        detalle:
          d.length === 1
            ? "Revisá el dato antes de firmar: un error de identidad puede generar el débito total del estudio."
            : "Se recomienda no firmar hasta corregir. Si firmás igual, tenés que escribir una justificación.",
        evidencia,
        versionReglas: reglas.version,
        clave: d.map((x) => x.campo).join("|"),
      }),
    ],
  };
}
