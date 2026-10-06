import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Renueva la sesión de Supabase Auth y redirige al login a quien no inició sesión (chequeo optimista).
 * La autorización real (rol, médico dueño del informe) se verifica en cada página, acción y API.
 * Sin base de datos configurada la app es una demo abierta con datos sintéticos.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_PUBLISHABLE_KEY;
  const hayDb = !!(url && process.env.SUPABASE_SECRET_KEY);
  if (!hayDb) return NextResponse.next();

  const ruta = request.nextUrl.pathname;
  const publica = ruta === "/login" || ruta.startsWith("/api/validar");
  if (!clave) {
    return publica ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  let respuesta = NextResponse.next({ request });
  const sb = createServerClient(url!, clave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista, headers) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) respuesta.headers.set(k, v);
      },
    },
  });
  const { data } = await sb.auth.getClaims();
  if (!data?.claims && !publica) {
    if (ruta.startsWith("/api/")) return Response.json({ error: "Sesión requerida" }, { status: 401 });
    const destino = new URL("/login", request.url);
    if (ruta !== "/") destino.searchParams.set("volver", ruta);
    return NextResponse.redirect(destino);
  }
  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
