// import { NextResponse } from "next/server";
// import jwt from "jsonwebtoken";

// export function proxy(request) {
//   const token = request.cookies.get("token")?.value;
//   const pathname = request.nextUrl.pathname;

//   const isHome = pathname === "/";
//   const isDashboard = pathname.startsWith("/dashboard");
//   const isLogin = pathname === "/login";

//   let isAuthenticated = false;

//   if (token) {
//     try {
//       jwt.verify(token, process.env.JWT_SECRET);
//       isAuthenticated = true;
//     } catch {
//       isAuthenticated = false;
//     }
//   }

//   // Home route
//   if (isHome) {
//     if (isAuthenticated) {
//       return NextResponse.redirect(
//         new URL("/dashboard", request.url)
//       );
//     }

//     return NextResponse.redirect(
//       new URL("/login", request.url)
//     );
//   }

//   // Dashboard protected
//   if (isDashboard) {
//     if (!isAuthenticated) {
//       return NextResponse.redirect(
//         new URL("/login", request.url)
//       );
//     }

//     return NextResponse.next();
//   }

//   // Already logged-in user login page par na jaye
//   if (isLogin) {
//     if (isAuthenticated) {
//       return NextResponse.redirect(
//         new URL("/dashboard", request.url)
//       );
//     }

//     return NextResponse.next();
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ["/", "/dashboard/:path*", "/login"],
// };






// second logic start

// import { NextResponse } from "next/server";
// import jwt from "jsonwebtoken";

// const protectedRoutes = [
//   "/dashboard",
//   "/leads",
//   "/Sidebar",
//   "/calls",
//   "/contacts",
//   "/settings",
// ];

// export function proxy(request) {
//   const token = request.cookies.get("token")?.value;
//   const pathname = request.nextUrl.pathname;

//   const isHome = pathname === "/";
//   const isLogin = pathname === "/login";

//   // Check protected routes
//   const isProtectedRoute = protectedRoutes.some(
//     (route) =>
//       pathname === route || pathname.startsWith(`${route}/`)
//   );

//   let isAuthenticated = false;

//   if (token) {
//     try {
//       jwt.verify(token, process.env.JWT_SECRET);
//       isAuthenticated = true;
//     } catch {
//       isAuthenticated = false;
//     }
//   }

//   // Home
//   if (isHome) {
//     return NextResponse.redirect(
//       new URL(
//         isAuthenticated ? "/dashboard" : "/login",
//         request.url
//       )
//     );
//   }

//   // Protected routes
//   if (isProtectedRoute) {
//     if (!isAuthenticated) {
//       return NextResponse.redirect(
//         new URL("/login", request.url)
//       );
//     }

//     return NextResponse.next();
//   }

//   // Login page
//   if (isLogin) {
//     if (isAuthenticated) {
//       return NextResponse.redirect(
//         new URL("/dashboard", request.url)
//       );
//     }

//     return NextResponse.next();
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: [
//     "/",
//     "/Sidebar",
//     "/login",
//     "/dashboard/:path*",
//     "/leads/:path*",
//     "/calls/:path*",
//     "/contacts/:path*",
//     "/settings/:path*",
//   ],
// };



// second logic end


import { NextResponse } from "next/server";
import { isSessionCurrentForCaliforniaDay } from "./lib/california-logout";

// 1. Restricted Routes: SIRF ADMIN KO DIKHAYENGI
const adminOnlyRoutes = [
  "/users",
  "/add-new-users",
  "/teams",
  "/integrations",
  "/billing",
];

// 2. Protected Routes: AUTHENTICATED USERS (Admin, User, Agent)
const protectedRoutes = [
  "/dashboard",
  "/leads",
  "/calls",
  "/contacts",
  "/settings",
  "/messages",
  "/reports",
  "/daily-tasks",
  "/customers",
  "/agents",
  ...adminOnlyRoutes,
];

// Helper function: Edge-safe JWT Payload Decoder
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    return null;
  }
}

export function proxy(request) {
  const token = request.cookies.get("token")?.value;
  const pathname = request.nextUrl.pathname;

  const isHome = pathname === "/";
  const isLogin = pathname === "/login";

  let isAuthenticated = false;
  let userRole = null;

  // Verify and decode JWT token
  if (token) {
    const payload = decodeJwtPayload(token);
    
    // Token expiry check (exp in seconds)
    if (
      payload &&
      payload.exp &&
      payload.exp * 1000 > Date.now() &&
      isSessionCurrentForCaliforniaDay(payload)
    ) {
      isAuthenticated = true;
      userRole = payload.role; // Extract 'admin', 'user', or 'agent'
    }
  }

  // A. Home '/' Redirect
  if (isHome) {
    return NextResponse.redirect(
      new URL(isAuthenticated ? "/dashboard" : "/login", request.url)
    );
  }

  // B. Admin-Only Guard (Direct URL Access Prevention)
  const isAdminRoute = adminOnlyRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isAdminRoute) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Agar User ya Agent direct URL likh kar jaane ki koshish kare, to Dashboard bhejo
    if (userRole !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  // C. General Protected Routes Guard
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedRoute) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // D. Already Logged-in User tries to visit '/login'
  if (isLogin && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard",
    "/dashboard/:path*",
    "/leads/:path*",
    "/calls/:path*",
    "/contacts/:path*",
    "/settings/:path*",
    "/users/:path*",
    "/add-new-users/:path*",
    "/teams/:path*",
    "/integrations/:path*",
    "/billing/:path*",
    "/daily-tasks/:path*",
    "/customers/:path*",
    "/messages/:path*",
    "/reports/:path*",
    "/agents/:path*",
  ],
};