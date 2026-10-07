import "server-only";
import { HISTORIAL_PROMPTS, promptDesdeFila, promptVigente, siguienteVersion, type ConfigPrompt, type FilaPrompt } from "../config/prompts";
import { db, exigirDb } from "./cliente";
import { registrarEvento } from "./repositorio";

type Val = "V3A" | "V5";

export async function listarVersiones(validacion: Val): Promise<FilaPrompt[]> {
  const sb = db();
  if (!sb) return [];
  const { data, error } = await sb.from("m06_prompts").select("*").eq("validacion", validacion).order("creado_en", { ascending: false });
  if (error) throw error;
  return data as FilaPrompt[];
}

export async function obtenerVersion(id: string): Promise<FilaPrompt | undefined> {
  const { data, error } = await exigirDb().from("m06_prompts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as FilaPrompt) ?? undefined;
}

/** Prompt vigente de cada validación: el aprobado en la base o, si nunca se editó, el del código. */
export async function promptsVigentes(): Promise<Record<Val, ConfigPrompt>> {
  const r: Record<Val, ConfigPrompt> = { V3A: promptVigente("V3A"), V5: promptVigente("V5") };
  const sb = db();
  if (!sb) return r;
  const { data } = await sb.from("m06_prompts").select("*").eq("estado", "vigente");
  for (const f of (data ?? []) as FilaPrompt[]) r[f.validacion] = promptDesdeFila(f);
  return r;
}

/** Crea el borrador o actualiza el existente (hay como máximo uno por validación). Editarlo anula la prueba anterior. */
export async function guardarBorrador(p: { validacion: Val; sistema: string; motivo: string }, actor: string): Promise<FilaPrompt> {
  const sb = exigirDb();
  const versiones = await listarVersiones(p.validacion);
  const borrador = versiones.find((v) => v.estado === "borrador");
  const vigente = versiones.find((v) => v.estado === "vigente")?.version ?? promptVigente(p.validacion).version;
  const ahora = new Date().toISOString();
  const res = borrador
    ? await sb.from("m06_prompts").update({ sistema: p.sistema, motivo: p.motivo, actualizado_en: ahora, probado_por: null, probado_en: null }).eq("id", borrador.id).select().single()
    : await sb.from("m06_prompts").insert({
        validacion: p.validacion,
        version: siguienteVersion(p.validacion, [...versiones.map((v) => v.version), ...HISTORIAL_PROMPTS.map((h) => h.version)]),
        sistema: p.sistema, motivo: p.motivo, base_version: vigente, autor: actor,
      }).select().single();
  if (res.error) throw res.error;
  const f = res.data as FilaPrompt;
  await registrarEvento({ tipo: "prompt_borrador_guardado", actor, datos: { validacion: f.validacion, version: f.version, base: f.base_version, motivo: f.motivo } });
  return f;
}

/** Se registra cuando el borrador se ejecutó con el modelo real sin errores. Habilita la aprobación. */
export async function marcarProbado(id: string, actor: string) {
  const ahora = new Date().toISOString();
  const { data, error } = await exigirDb().from("m06_prompts").update({ probado_por: actor, probado_en: ahora }).eq("id", id).eq("estado", "borrador").select("validacion, version").maybeSingle();
  if (error) throw error;
  if (data) await registrarEvento({ tipo: "prompt_probado", actor, datos: { validacion: data.validacion, version: data.version } });
}

/** Aprueba el borrador y lo pone vigente; la versión anterior pasa a retirada. Exige que se haya probado. */
export async function activarBorrador(id: string, actor: string) {
  const sb = exigirDb();
  const f = await obtenerVersion(id);
  if (!f || f.estado !== "borrador") throw new Error("La versión no es un borrador");
  if (!f.probado_en) throw new Error("Primero probá el borrador con el modelo real");
  const ahora = new Date().toISOString();
  const { error: e1 } = await sb.from("m06_prompts").update({ estado: "retirada", actualizado_en: ahora }).eq("validacion", f.validacion).eq("estado", "vigente");
  if (e1) throw e1;
  const { error: e2 } = await sb.from("m06_prompts").update({ estado: "vigente", aprobado_por: actor, aprobado_en: ahora, actualizado_en: ahora }).eq("id", id);
  if (e2) throw e2;
  await registrarEvento({
    tipo: "prompt_activado", actor,
    datos: { validacion: f.validacion, version: f.version, reemplaza: f.base_version, autor: f.autor, probadoPor: f.probado_por, mismaPersona: f.autor === actor },
  });
}

export async function descartarBorrador(id: string, actor: string) {
  const { data, error } = await exigirDb().from("m06_prompts").update({ estado: "descartada", actualizado_en: new Date().toISOString() }).eq("id", id).eq("estado", "borrador").select("validacion, version").maybeSingle();
  if (error) throw error;
  if (data) await registrarEvento({ tipo: "prompt_descartado", actor, datos: { validacion: data.validacion, version: data.version } });
}
