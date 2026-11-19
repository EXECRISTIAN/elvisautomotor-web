import type { NextRequest } from "next/server";
import { handleDashboardRoutes, getAuthenticatedUser } from "@/features/dashboard/middleware";
import { handleStorefrontRoutes } from "@/features/storefront/middleware";
import { NextResponse } from "next/server";
import { isDashboardRoute } from "@/features/dashboard/lib/authFlow";

const dashboardPath = "/dashboard";

// Main middleware function that handles all routes
function demoAuthChallenge(request: NextRequest) {
  const password = process.env.DEMO_PASSWORD
  if (process.env.DEMO_MODE !== 'true' || !password) return null
  if (request.nextUrl.pathname.startsWith('/api/payment-webhooks')) return null
  const header = request.headers.get('authorization') || ''
  if (header.startsWith('Basic ')) {
    try {
      const [, pass = ''] = atob(header.slice(6)).split(':')
      if (pass === password) return null
    } catch {}
  }
  return new NextResponse('Sitio de demostración privado', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Demo", charset="UTF-8"', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}

export async function proxy(request: NextRequest) {
  const challenge = demoAuthChallenge(request)
  if (challenge) return challenge

  // Get authenticated user once
  const { user, redirectToInit } = await getAuthenticatedUser(request);

  // If redirectToInit is true (no users exist) and user is on storefront, redirect to dashboard init
  if (redirectToInit && !isDashboardRoute(request.nextUrl.pathname, "init")) {
    return NextResponse.redirect(new URL(`${dashboardPath}/init`, request.url));
  }

  // Let each handler manage its own routes and logic
  const response = await handleDashboardRoutes(request, user, redirectToInit);
  
  // If dashboard handler didn't handle the route, pass to storefront
  const result = response ?? (await handleStorefrontRoutes(request, user));
  if (process.env.DEMO_MODE === 'true') result.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return result;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.svg|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
};