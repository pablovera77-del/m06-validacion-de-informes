import { connection } from "next/server";
import { ACCESO, exigirUsuario, NOMBRE_ROL } from "@/lib/auth/sesion";
import { hayBaseDeDatos } from "@/lib/db/cliente";
import { emailsConCuenta, listarUsuarios } from "@/lib/db/usuarios";
import { Aviso, Encabezado, Etiqueta, Tarjeta } from "@/components/ui";
import { alternarUsuario } from "./acciones";
import { FormularioClave, FormularioUsuario } from "./formulario";

export default async function Usuarios() {
  await connection();
  const yo = await exigirUsuario(ACCESO.usuarios);
  const usuarios = hayBaseDeDatos() ? await listarUsuarios() : [];
  const conCuenta = hayBaseDeDatos() ? await emailsConCuenta().catch(() => new Set<string>()) : new Set<string>();
  return (
    <>
      <Encabezado
        titulo="Usuarios y roles"
        bajada="Quién accede a M06 y con qué rol (HU26). Cada alta, cambio e inicio de sesión queda en el log de auditoría."
      />
      {yo.demo && <div className="mb-6"><Aviso tono="aviso">Modo demostración: sin base de datos no hay usuarios ni login.</Aviso></div>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Tarjeta titulo="Usuarios habilitados">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-2">
                <tr><th className="py-2 pr-3 font-medium">Nombre</th><th className="py-2 pr-3 font-medium">Email</th><th className="py-2 pr-3 font-medium">Rol</th><th className="py-2 pr-3 font-medium">Estado</th><th /></tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.email} className="border-b border-borde last:border-0">
                    <td className="py-2 pr-3">{u.nombre}</td>
                    <td className="py-2 pr-3 text-xs">{u.email}</td>
                    <td className="py-2 pr-3">{NOMBRE_ROL[u.rol]}{u.medico_id ? <span className="font-mono text-xs text-texto-2"> · {u.medico_id}</span> : null}</td>
                    <td className="py-2 pr-3">
                      {!u.activo ? <Etiqueta>Inactivo</Etiqueta> : conCuenta.has(u.email) ? <Etiqueta tono="ok">Puede ingresar</Etiqueta> : <Etiqueta tono="aviso">Sin contraseña</Etiqueta>}
                    </td>
                    <td className="flex flex-col items-end gap-1 py-2 text-right">
                      {u.activo && <FormularioClave email={u.email} tieneCuenta={conCuenta.has(u.email)} />}
                      {u.email !== yo.email && (
                        <form action={alternarUsuario}>
                          <input type="hidden" name="email" value={u.email} />
                          <input type="hidden" name="activo" value={String(!u.activo)} />
                          <button className="text-xs text-marca underline">{u.activo ? "Desactivar" : "Reactivar"}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {!usuarios.length && <tr><td colSpan={5} className="py-4 text-center text-texto-3">Sin usuarios cargados.</td></tr>}
              </tbody>
            </table>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Alta o cambio de rol">
          <FormularioUsuario />
          <p className="mt-4 text-xs text-texto-3">
            El médico solo ve y firma los informes de su código. Calidad ve todo en modo lectura, carga informes y gestiona auditorías y débitos. El administrador además gestiona usuarios.
          </p>
        </Tarjeta>
      </div>
    </>
  );
}
