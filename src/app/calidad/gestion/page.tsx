import { connection } from "next/server";
import { hayBaseDeDatos, db } from "@/lib/db/cliente";
import { NOMBRE_VALIDACION } from "@/lib/domain/types";
import type { FilaAlerta } from "@/lib/db/repositorio";
import { Aviso, Encabezado, InsigniaNivel, Tarjeta } from "@/components/ui";
import { FormAccion, FormDebito } from "./formularios";
import { auditarAlerta } from "./acciones";

export default async function GestionCalidad() {
  await connection(); // siempre en el momento: lee la base de datos
  if (!hayBaseDeDatos()) {
    return (
      <>
        <Encabezado titulo="Gestión de Calidad" />
        <Aviso tono="aviso">Esta sección necesita la base de datos configurada.</Aviso>
      </>
    );
  }
  const sb = db()!;
  const { data: auditadas } = await sb.from("m06_auditoria_muestra").select("alerta_id");
  const yaAuditadas = new Set((auditadas ?? []).map((a) => a.alerta_id));
  const { data: recientes } = await sb.from("m06_alertas").select("*").order("actualizado_en", { ascending: false }).limit(300);
  const pendientes = ((recientes ?? []) as FilaAlerta[]).filter((a) => !yaAuditadas.has(a.id)).slice(0, 12);
  const { data: acciones } = await sb.from("m06_acciones_correctivas").select("*").order("fecha", { ascending: false });

  return (
    <>
      <Encabezado
        titulo="Gestión de Calidad"
        bajada="Auditoría por muestreo de alertas (HU17), acciones correctivas (HU24, ISO 9001 10.2) y carga de débitos (HU25). Cada registro queda en el log de auditoría."
      />
      <Tarjeta titulo="Auditoría por muestreo" accion={<span className="text-xs text-texto-2">{yaAuditadas.size} alertas auditadas</span>}>
        {pendientes.length === 0 ? (
          <p className="text-sm text-texto-2">No hay alertas pendientes de auditar.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendientes.map((a) => (
              <li key={a.id} className="rounded-md border border-borde p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><InsigniaNivel nivel={a.nivel} corto /> {a.validacion} · {NOMBRE_VALIDACION[a.validacion]}</span>
                  <span className="font-mono text-xs text-texto-2">{a.informe_id} · estado: {a.estado}</span>
                </div>
                <p className="mt-1 font-medium">{a.titulo}</p>
                {a.evidencia?.[0] && <p className="mt-1 rounded bg-fondo px-2 py-1 text-xs">{a.evidencia[0].fragmento}</p>}
                {a.justificacion && <p className="mt-1 text-xs text-texto-2">Justificación del médico: {a.justificacion}</p>}
                {a.motivo_incorrecta && <p className="mt-1 text-xs text-texto-2">Marcada incorrecta: {a.motivo_incorrecta}</p>}
                <form action={auditarAlerta} className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <input type="hidden" name="alertaId" value={a.id} />
                  <input type="hidden" name="validacion" value={a.validacion} />
                  {a.estado === "override" && (
                    <select name="override" className="rounded border border-borde px-2 py-1" defaultValue="">
                      <option value="">¿Override apropiado?</option>
                      <option value="si">Override apropiado</option>
                      <option value="no">Override no apropiado</option>
                    </select>
                  )}
                  <input name="comentario" placeholder="Comentario (opcional)" className="min-w-48 flex-1 rounded border border-borde px-2 py-1" />
                  <button name="correcta" value="si" className="rounded-md border border-ok px-3 py-1 text-ok hover:bg-ok-fondo">✓ Alerta correcta</button>
                  <button name="correcta" value="no" className="rounded-md border border-roja px-3 py-1 text-roja hover:bg-roja-fondo">✗ Falso positivo</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Tarjeta titulo="Acciones correctivas">
          <FormAccion />
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {(acciones ?? []).map((a) => (
              <li key={a.id} className="border-t border-borde pt-2">
                <div className="flex justify-between"><span className="font-mono text-xs text-texto-2">{a.id} · {a.fecha}</span><span className="text-xs">{a.estado}</span></div>
                <p>{a.patron}</p>
                <p className="text-texto-2">{a.accion} · {a.responsable}</p>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Débitos de financiadores">
          <FormDebito />
          <p className="mt-3 text-xs text-texto-3">Pendiente de validar con Administración cómo se codifica hoy el motivo del débito.</p>
        </Tarjeta>
      </div>
    </>
  );
}
