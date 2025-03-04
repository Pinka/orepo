import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const isAuthenticated = !!req.nextauth.token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/login");
    const isHomePage = req.nextUrl.pathname === "/";

    if (isAuthenticated && (isAuthPage || isHomePage)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (!isAuthenticated && !isAuthPage && !isHomePage) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/repository/:path*"],
};
