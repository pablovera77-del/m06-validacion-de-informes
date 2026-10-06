import { Aviso, Encabezado, Tarjeta } from "@/components/ui";
import { ACCESO, exigirUsuario } from "@/lib/auth/sesion";

const EJEMPLO = `POST /api/validar
Authorization: Bearer <M06_API_TOKEN>
Content-Type: application/json

{
  "informe": {
    "id": "INF-000123",
    "turnoId": "T-000123",
    "tipoEstudio": "densitometria",
    "medicoId": "M07",
    "medicoFirmante": "Médico 07 - M.P. 1007",
    "fecha": "2026-10-06T10:15:00-03:00",
    "encabezado": { "apellidoNombre": "PÉREZ, Ana", "dni": "23.456.789", "fechaNacimiento": "05/03/1970", "tipoEstudio": "Densitometría ósea" },
    "secciones": {
      "tecnica": "DXA de columna lumbar y cadera izquierda.",
      "hallazgos": "Columna lumbar L1-L4: T-score -2,8. Cuello femoral: T-score -1,9.",
      "conclusion": "Osteopenia."
    }
  },
  "turno": { "id": "T-000123", "apellidoNombre": "Pérez, Ana", "dni": "23456789", "fechaNacimiento": "1970-03-05", "tipoEstudio": "densitometria", "medicoId": "M07" },
  "historial": []
}`;

const RESPUESTA = `200 OK
{
  "informeId": "INF-000123",
  "versionReglas": "reglas-1.0.0",
  "nivelMaximo": "naranja",
  "incompleto": false,
  "alertas": [
    {
      "validacion": "V3B",
      "nivel": "naranja",
      "titulo": "Conclusión \\"osteopenia\\" no coincide con T-score -2.8",
      "detalle": "Con un T-score de -2.8 la clasificación esperada es \\"osteoporosis\\" ...",
      "evidencia": [{ "seccion": "hallazgos", "fragmento": "Columna lumbar L1-L4: T-score -2,8. ..." }],
      "versionReglas": "reglas-1.0.0",
      "estado": "pendiente"
    }
  ],
  "resultados": [ { "validacion": "V1", "estado": "ejecutada", "alertas": [] }, "..." ]
}`;

export default async function ApiDocs() {
  await exigirUsuario(ACCESO.configuracion);
  return (
    <>
      <Encabezado titulo="API de validación (etapa 2)" bajada="Contrato para que el sistema de gestión de imágenes envíe cada informe antes de la firma y reciba las alertas. En la etapa 1 la misma lógica se alimenta desde Google Drive." />
      <div className="mb-6">
        <Aviso>
          El endpoint solo lee: no guarda el informe ni escribe en el sistema de origen. La extracción de texto desde PDF se agrega cuando esté disponible la documentación de la API del sistema de imágenes (pendiente de validación).
        </Aviso>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Tarjeta titulo="Solicitud"><pre className="overflow-auto whitespace-pre rounded bg-fondo p-3 font-mono text-xs">{EJEMPLO}</pre></Tarjeta>
        <Tarjeta titulo="Respuesta"><pre className="overflow-auto whitespace-pre rounded bg-fondo p-3 font-mono text-xs">{RESPUESTA}</pre></Tarjeta>
      </div>
      <Tarjeta titulo="Reglas del contrato" className="mt-6">
        <ul className="list-disc pl-5 text-sm text-texto-2">
          <li>Autenticación con token de servicio (variable M06_API_TOKEN en Vercel).</li>
          <li>tipoEstudio: mamografia, densitometria, ecografia_abdominal, ecografia_renal, ecografia_ginecologica, radiografia_torax, tomografia, resonancia.</li>
          <li>historial: hasta 10 informes previos del mismo médico y tipo de estudio, para V2. Si no se envía, V2 queda como «no aplica».</li>
          <li>turno: datos del turno para V4. Si no se envía, V4 genera una alerta de turno no encontrado.</li>
          <li>Cada validación devuelve estado «ejecutada», «no_aplica» o «no_ejecutada». «no_ejecutada» nunca debe interpretarse como informe correcto.</li>
          <li>Los datos identificatorios del encabezado solo se usan en V4, que es determinística; nunca se envían a un modelo de IA.</li>
        </ul>
      </Tarjeta>
    </>
  );
}
