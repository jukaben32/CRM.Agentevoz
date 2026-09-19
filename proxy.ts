import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./lib/auth/session";

/**
 * Middleware para Next.js 16 (llamado proxy.ts y exportando 'proxy')
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Rutas públicas que no requieren autenticación
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/vapi/webhook") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico");

  // Si el usuario ya está autenticado e intenta ir a login/signup, redirigir al panel principal
  if (sessionCookie && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Si la ruta no es pública y falta la cookie de sesión
  if (!isPublicRoute && !sessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado. Sesión requerida." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas excepto archivos estáticos
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
