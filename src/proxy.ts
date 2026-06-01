import { NextRequest, NextResponse } from "next/server";
import { isPublicIndexablePath } from "@/lib/seo";

/**
 * Cookie host alignment.
 *
 * The session cookie is set on whatever host handled the OAuth callback,
 * which is derived from OMNIGRID_PUBLIC_URL. If the user opens the app on a
 * different host (e.g. 0.0.0.0 vs localhost, or an IP address), the browser
 * treats it as a different origin and never sends the cookie back, which
 * looks exactly like "still not logged in" even though OAuth succeeded.
 *
 * To prevent that, this proxy redirects every request to the canonical
 * host derived from OMNIGRID_PUBLIC_URL when one is configured.
 */
export function proxy(request: NextRequest) {
  const publicUrl = process.env.OMNIGRID_PUBLIC_URL;
  const response = NextResponse.next();
  if (!isPublicIndexablePath(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  if (!publicUrl) return response;

  let canonical: URL;
  try {
    canonical = new URL(publicUrl);
  } catch {
    return NextResponse.next();
  }

  const incomingHost = request.headers.get("host");
  if (!incomingHost) return NextResponse.next();

  const canonicalHost = canonical.host;
  if (incomingHost === canonicalHost) return response;

  const target = new URL(request.nextUrl.toString());
  target.protocol = canonical.protocol;
  target.host = canonicalHost;
  return NextResponse.redirect(target, 307);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|logo.png).*)",
  ],
};
