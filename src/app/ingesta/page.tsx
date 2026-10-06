import { connection } from "next/server";
import Link from "next/link";
import { hayBaseDeDatos } from "@/lib/db/cliente";
import { listarArchivos } from "@/lib/db/repositorio";
import { driveConfigurado } from "@/lib/ingesta/drive";
import { Aviso, Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { FormulariosIngesta } from "./formularios";
import { ACCESO, exigirUsuario } from "@/lib/auth/sesion";

export const maxDuration = 300;

export default async function Ingesta() {
  await exigirUsuario(ACCESO.ingesta);
  await connection(); // siempre en el momento: lee la base de datos
  const conDb = hayBaseDeDatos();
  const archivos = conDb ? await listarArchivos(100).catch(() => []) : [];
  return (
    <>
      <Encabezado
        titulo="Ingreso de informes"
        bajada="Etapa 1: los informes en PDF se leen desde la carpeta de Google Drive o se suben acá. Se extrae el texto, se identifica el turno y se validan. El PDF original nunca se modifica."
      />
      {!conDb && (
        <div className="mb-6">
          <Aviso tono="aviso">
            La base de datos todavía no está configurada (faltan SUPABASE_URL y SUPABASE_SECRET_KEY en Vercel). Mientras tanto la app funciona con datos sintéticos.
          </Aviso>
        </div>
      )}
      <FormulariosIngesta habilitado={conDb} drive={driveConfigurado()} />

      <Tarjeta titulo="Archivos procesados" className="mt-6">
        {archivos.length === 0 ? (
          <p className="text-sm text-texto-2">Todavía no se procesó ningún archivo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-texto-2">
                <tr><th className="py-2 font-medium">Archivo</th><th className="py-2 font-medium">Origen</th><th className="py-2 font-medium">Estado</th><th className="py-2 font-medium">Detalle</th><th className="py-2 font-medium">Procesado</th></tr>
              </thead>
              <tbody>
                {archivos.map((a) => (
                  <tr key={a.id} className="border-t border-borde align-top">
                    <td className="py-2">{a.informe_id ? <Link className="text-marca hover:underline" href={`/medico/${a.informe_id}`}>{a.nombre}</Link> : a.nombre}</td>
                    <td className="py-2 text-texto-2">{a.origen === "drive" ? "Google Drive" : "Carga manual"}</td>
                    <td className="py-2"><Etiqueta tono={a.estado === "procesado" ? "ok" : a.estado === "error" ? "aviso" : "neutro"}>{a.estado}</Etiqueta></td>
                    <td className="max-w-md py-2 text-xs text-texto-2">{a.error ?? "—"}</td>
                    <td className="whitespace-nowrap py-2 text-texto-2">{new Date(a.procesado_en).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </>
  );
}
