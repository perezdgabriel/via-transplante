import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getTenant } from "@/lib/tenants";

// Resuelve el hospital desde el Host y refresca la sesión de Supabase. Next 16 renamed middleware -> proxy.
//
// El matcher cubre TODAS las rutas porque la resolución de tenant es global: con una base de datos por
// hospital, un host mal resuelto no muestra el logo equivocado, abre la base equivocada. La guardia de
// autenticación, en cambio, sigue siendo solo de /dashboard — el chat del paciente (/c, /p) es público
// y arrastrarlo al redirect de login lo rompería.
export async function proxy(request: NextRequest) {
  const tenant = getTenant(request.headers.get("host"));
  // Host desconocido = 404. Nunca un tenant por defecto: un fallback silencioso es exactamente cómo se
  // termina sirviendo los datos de otro hospital.
  if (!tenant) return new NextResponse("Not found", { status: 404 });

  const path = request.nextUrl.pathname;
  if (!path.startsWith("/dashboard")) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(tenant.supabaseUrl, tenant.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = path === "/dashboard/login";

  if (!user && !isLogin) {
    return NextResponse.redirect(new URL("/dashboard/login", request.url));
  }
  if (user && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = {
  // Todo salvo estáticos de Next y el favicon: esas rutas no tocan datos de ningún hospital.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|folletos/).*)"],
};
