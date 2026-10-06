import Link from "next/link";
import { exigirUsuario, NOMBRE_ROL } from "@/lib/auth/sesion";

export default async function SinAcceso() {
  const u = await exigirUsuario();
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border border-borde bg-superficie p-6 text-center">
      <h1 className="text-lg">Sin acceso a esta sección</h1>
      <p className="mt-2 text-sm text-texto-2">Tu rol es «{NOMBRE_ROL[u.rol]}». Si necesitás acceder, pedíselo al administrador.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-marca underline">Volver al inicio</Link>
    </div>
  );
}
