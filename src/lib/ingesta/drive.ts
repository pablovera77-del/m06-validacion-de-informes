import "server-only";
import { GoogleAuth } from "google-auth-library";

/**
 * Adaptador de Google Drive (etapa 1). Usa una cuenta de servicio con permiso de SOLO LECTURA
 * sobre la carpeta M06 compartida. Nunca escribe ni modifica archivos en Drive.
 *
 * Variables:
 *   GOOGLE_SERVICE_ACCOUNT_JSON   credencial JSON de la cuenta de servicio
 *   M06_DRIVE_CARPETA_INFORMES    id de la carpeta 01_Informes_a_validar
 *   M06_DRIVE_PLANILLA_TURNOS     id de la planilla de turnos (Google Sheets) en 03_Turnos_mock_Visual_Medica
 */

export function driveConfigurado(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.M06_DRIVE_CARPETA_INFORMES);
}

let auth: GoogleAuth | null = null;
async function token(): Promise<string> {
  auth ??= new GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "{}"),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const t = await (await auth.getClient()).getAccessToken();
  if (!t.token) throw new Error("No se pudo obtener el token de Google");
  return t.token;
}

async function api(url: string): Promise<Response> {
  const r = await fetch(url, { headers: { authorization: `Bearer ${await token()}` } });
  if (!r.ok) throw new Error(`Google Drive respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

export interface ArchivoDrive {
  id: string;
  name: string;
  modifiedTime: string;
  md5Checksum?: string;
}

export async function listarPdfs(carpetaId = process.env.M06_DRIVE_CARPETA_INFORMES!): Promise<ArchivoDrive[]> {
  const q = encodeURIComponent(`'${carpetaId}' in parents and mimeType='application/pdf' and trashed=false`);
  const out: ArchivoDrive[] = [];
  let pageToken = "";
  do {
    const r = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,modifiedTime,md5Checksum)&pageSize=200&orderBy=modifiedTime&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${pageToken}` : ""}`);
    const j = (await r.json()) as { files: ArchivoDrive[]; nextPageToken?: string };
    out.push(...j.files);
    pageToken = j.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

export async function descargar(id: string): Promise<Uint8Array> {
  const r = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Exporta la planilla de turnos como CSV (primera hoja). */
export async function planillaTurnosCsv(id = process.env.M06_DRIVE_PLANILLA_TURNOS): Promise<string | null> {
  if (!id) return null;
  const r = await api(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/csv`);
  return r.text();
}
