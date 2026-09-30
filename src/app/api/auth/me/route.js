
// import { NextResponse } from "next/server";
// import jwt from "jsonwebtoken";
// import db from "../../../lib/db";

// export const runtime = "nodejs";

// export async function GET(request) {
//   try {
//     const token = request.cookies.get("token")?.value;

//     if (!token) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "No token found",
//         },
//         { status: 401 }
//       );
//     }

//     // ============================================================
//     // VERIFY JWT
//     // ============================================================

//     const decoded = jwt.verify(
//       token,
//       process.env.JWT_SECRET
//     );

//     const userId =
//       decoded.id ||
//       decoded._id ||
//       decoded.userId ||
//       null;

//     if (!userId) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "User ID not found in token",
//         },
//         { status: 401 }
//       );
//     }

//     // ============================================================
//     // GET LATEST USER DATA FROM DATABASE
//     // ============================================================

//     const [rows] = await db.query(
//       `
//       SELECT
//         id,
//         name,
//         email,
//         phone,
//         role,
//         team,
//         status,
//         availability_status,
//         status_started_at,
//         avatar,
//         zoom_extension,
//         last_login,
//         login_time,
//         logout_time
//       FROM users
//       WHERE id = ?
//       LIMIT 1
//       `,
//       [userId]
//     );

//     if (!rows || rows.length === 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "User not found",
//         },
//         { status: 404 }
//       );
//     }

//     const user = rows[0];

//     const role = String(
//       user.role || decoded.role || "user"
//     ).toLowerCase();

//     // ============================================================
//     // RESPONSE
//     // ============================================================

//     return NextResponse.json(
//       {
//         success: true,

//         user: {
//           id: user.id,

//           name:
//             user.name ||
//             decoded.name ||
//             decoded.username ||
//             "User",

//           email:
//             user.email ||
//             decoded.email ||
//             "",

//           phone: user.phone || "",

//           role,

//           team: user.team || "",

//           status: user.status || "Active",

//           availability_status:
//             user.availability_status ||
//             "Active",

//           status_started_at:
//             user.status_started_at || null,

//           // ⭐ PROFILE IMAGE
//           avatar: user.avatar || null,

//           // ⭐ ZOOM EXTENSION
//           zoom_extension:
//             user.zoom_extension || "",

//           last_login:
//             user.last_login || null,

//           login_time:
//             user.login_time || null,

//           logout_time:
//             user.logout_time || null,
//         },

//         role,
//       },
//       {
//         status: 200,
//         headers: {
//           "Cache-Control":
//             "no-store, no-cache, must-revalidate",
//         },
//       }
//     );
//   } catch (error) {
//     console.error(
//       "Auth Me API Error:",
//       error
//     );

//     const response = NextResponse.json(
//       {
//         success: false,
//         message:
//           error?.message ||
//           "Invalid or expired token",
//       },
//       { status: 401 }
//     );

//     response.cookies.delete("token");

//     return response;
//   }
// }









import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import db from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const token = request.cookies.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "No token found",
        },
        { status: 401 }
      );
    }

    // ============================================================
    // VERIFY JWT
    // ============================================================

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const userId =
      decoded.id ||
      decoded._id ||
      decoded.userId ||
      null;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "User ID not found in token",
        },
        { status: 401 }
      );
    }

    // ============================================================
    // GET LATEST USER DATA FROM DATABASE
    // ============================================================

    const [rows] = await db.query(
      `
      SELECT
        id,
        name,
        email,
        phone,
        role,
        team,
        status,
        availability_status,
        status_started_at,
        avatar,
        updated_at,
        zoom_extension,
        last_login,
        login_time,
        logout_time
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found",
        },
        { status: 404 }
      );
    }

    const user = rows[0];

    const role = String(
      user.role || decoded.role || "user"
    ).toLowerCase();

    // ============================================================
    // RESPONSE
    // ============================================================

    return NextResponse.json(
      {
        success: true,

        user: {
          id: user.id,

          name:
            user.name ||
            decoded.name ||
            decoded.username ||
            "User",

          email:
            user.email ||
            decoded.email ||
            "",

          phone: user.phone || "",

          role,

          team: user.team || "",

          status: user.status || "Active",

          availability_status:
            user.availability_status || "Active",

          status_started_at:
            user.status_started_at || null,

          // ======================================================
          // PROFILE IMAGE
          // ======================================================

          avatar: user.avatar || null,

          // Used for browser cache-busting
          updated_at: user.updated_at || null,

          // ======================================================
          // ZOOM
          // ======================================================

          zoom_extension:
            user.zoom_extension || "",

          last_login:
            user.last_login || null,

          login_time:
            user.login_time || null,

          logout_time:
            user.logout_time || null,
        },

        role,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Auth Me API Error:",
      error
    );

    const response = NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Invalid or expired token",
      },
      { status: 401 }
    );

    response.cookies.delete("token");

    return response;
  }
}


