

// import { NextResponse } from "next/server";
// import jwt from "jsonwebtoken";
// import db from "../../lib/db";

// export async function POST(request) {
//   try {
//     // ==========================================
//     // GET TOKEN FROM COOKIE
//     // ==========================================

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

//     // ==========================================
//     // VERIFY JWT
//     // ==========================================

//     let decoded;

//     try {
//       decoded = jwt.verify(token, process.env.JWT_SECRET);
//     } catch (error) {
//       console.error("JWT VERIFY ERROR:", error);

//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid or expired token",
//         },
//         { status: 401 }
//       );
//     }

//     // ==========================================
//     // CHECK USER ID
//     // ==========================================

//     if (!decoded?.id) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "User ID not found in token",
//         },
//         { status: 401 }
//       );
//     }

//     // ==========================================
//     // UPDATE LOGOUT INFORMATION
//     // ==========================================

//     await db.execute(
//       `UPDATE users
//        SET 
//          logout_time = NOW(),
//          status = 'Inactive'
//        WHERE id = ?`,
//       [decoded.id]
//     );

//     // ==========================================
//     // DELETE TOKEN COOKIE
//     // ==========================================

//     const response = NextResponse.json({
//       success: true,
//       message: "Logout successful",
//     });

//     response.cookies.set("token", "", {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       expires: new Date(0),
//       path: "/",
//     });

//     return response;
//   } catch (error) {
//     console.error("LOGOUT ERROR:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         message: error.message || "Logout failed",
//       },
//       {
//         status: 500,
//       }
//     );
//   }
// }


// import { NextResponse } from "next/server";
// import jwt from "jsonwebtoken";
// import db from "../../lib/db";

// export async function POST(request) {
//   try {
//     // ==========================================
//     // GET TOKEN FROM COOKIE
//     // ==========================================

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

//     // ==========================================
//     // VERIFY JWT
//     // ==========================================

//     let decoded;

//     try {
//       decoded = jwt.verify(
//         token,
//         process.env.JWT_SECRET
//       );
//     } catch (error) {
//       console.error("JWT VERIFY ERROR:", error);

//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid or expired token",
//         },
//         { status: 401 }
//       );
//     }

//     // ==========================================
//     // CHECK USER ID
//     // ==========================================

//     if (!decoded?.id) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "User ID not found in token",
//         },
//         { status: 401 }
//       );
//     }

//     // ==========================================
//     // UPDATE USER LOGOUT TIME
//     // DO NOT CHANGE STATUS
//     // ==========================================

//     await db.execute(
//       `UPDATE users
//        SET
//          logout_time = NOW()
//        WHERE id = ?`,
//       [decoded.id]
//     );

//     // ==========================================
//     // UPDATE LATEST OPEN LOGIN HISTORY
//     // ==========================================

//     await db.execute(
//       `UPDATE login_history
//        SET logout_time = NOW()
//        WHERE id = (
//          SELECT id
//          FROM (
//            SELECT id
//            FROM login_history
//            WHERE user_id = ?
//              AND logout_time IS NULL
//            ORDER BY login_time DESC
//            LIMIT 1
//          ) AS latest_login
//        )`,
//       [decoded.id]
//     );

//     // ==========================================
//     // DELETE TOKEN COOKIE
//     // ==========================================

//     const response = NextResponse.json({
//       success: true,
//       message: "Logout successful",
//     });

//     response.cookies.set("token", "", {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       expires: new Date(0),
//       path: "/",
//     });

//     return response;

//   } catch (error) {
//     console.error("LOGOUT ERROR:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         message: error.message || "Logout failed",
//       },
//       {
//         status: 500,
//       }
//     );
//   }
// }









import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import db from "../../lib/db";
import {
  formatCaliforniaDateTime,
  getMostRecentCaliforniaLogout,
  isSessionCurrentForCaliforniaDay,
} from "../../../lib/california-logout";

export async function POST(request) {
  try {
    // ==========================================
    // GET TOKEN FROM COOKIE
    // ==========================================

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

    // ==========================================
    // VERIFY JWT
    // ==========================================

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        ignoreExpiration: true,
      });
    } catch (error) {
      console.error("JWT VERIFY ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          message: "Invalid or expired token",
        },
        { status: 401 }
      );
    }

    // ==========================================
    // CHECK USER ID
    // ==========================================

    if (!decoded?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "User ID not found in token",
        },
        { status: 401 }
      );
    }

    const now = Date.now();
    const currentDate = new Date(now);
    const latestCutoff = getMostRecentCaliforniaLogout(currentDate);
    const isCurrentSession = isSessionCurrentForCaliforniaDay(
      decoded,
      currentDate
    );
    const isAutomaticLogout =
      !isCurrentSession &&
      now >= latestCutoff &&
      now < latestCutoff + 2 * 60 * 1000 &&
      (!decoded.logoutAt || decoded.logoutAt * 1000 === latestCutoff);

    if (
      (!isCurrentSession && !isAutomaticLogout) ||
      (decoded.exp * 1000 <= now && !isAutomaticLogout)
    ) {
      return NextResponse.json(
        { success: false, message: "Session expired" },
        { status: 401 }
      );
    }

    // ==========================================
    // CALIFORNIA CURRENT TIME
    //
    // America/Los_Angeles
    // Automatically handles:
    // PST / PDT
    // Daylight Saving Time
    // ==========================================

    const logoutDate = new Date(isAutomaticLogout ? latestCutoff : now);
    const californiaTime = formatCaliforniaDateTime(logoutDate);

    // ==========================================
    // CALIFORNIA TIME
    // FORMAT:
    //
    // YYYY-MM-DD HH:mm:ss
    // ==========================================

    const logoutTime = californiaTime;

    console.log(
      "LOGOUT TIME - CALIFORNIA:",
      logoutTime
    );

    // ==========================================
    // UPDATE USER LOGOUT TIME
    //
    // DO NOT CHANGE STATUS
    // ==========================================

    await db.execute(
      `UPDATE users
       SET
         logout_time = ?
       WHERE id = ?`,
      [
        logoutTime,
        decoded.id,
      ]
    );

    // ==========================================
    // UPDATE LATEST OPEN LOGIN HISTORY
    // WITH CALIFORNIA TIME
    // ==========================================

    await db.execute(
      `UPDATE login_history
       SET logout_time = ?
       WHERE id = (
         SELECT id
         FROM (
           SELECT id
           FROM login_history
           WHERE user_id = ?
             AND logout_time IS NULL
           ORDER BY login_time DESC
           LIMIT 1
         ) AS latest_login
       )`,
      [
        logoutTime,
        decoded.id,
      ]
    );

    // ==========================================
    // DELETE TOKEN COOKIE
    // ==========================================

    const response = NextResponse.json({
      success: true,
      message: "Logout successful",
    });

    response.cookies.set("token", "", {
      httpOnly: true,

      secure:
        process.env.NODE_ENV === "production",

      sameSite: "lax",

      expires: new Date(0),

      path: "/",
    });

    // ==========================================
    // RETURN RESPONSE
    // ==========================================

    return response;

  } catch (error) {
    console.error(
      "LOGOUT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Logout failed",
      },
      {
        status: 500,
      }
    );
  }
}