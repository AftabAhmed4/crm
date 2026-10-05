


// import { NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import db from "../../lib/db";

// export async function POST(request) {
//   try {
//     const { email, password } = await request.json();

//     // ==========================================
//     // CHECK REQUIRED FIELDS
//     // ==========================================

//     if (!email || !password) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Email and password required",
//         },
//         { status: 400 }
//       );
//     }

//     // ==========================================
//     // FIND USER
//     // ==========================================

//     const [users] = await db.execute(
//       `SELECT
//         id,
//         name,
//         email,
//         password_hash,
//         role,
//         status
//        FROM users
//        WHERE email = ?
//        LIMIT 1`,
//       [email]
//     );

//     if (users.length === 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid email or password",
//         },
//         { status: 401 }
//       );
//     }

//     const user = users[0];

//     // ==========================================
//     // CHECK ACCOUNT STATUS
//     // Active = can login
//     // Inactive = blocked by admin
//     // ==========================================

//     if (user.status === "Inactive") {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Your account is inactive",
//         },
//         { status: 403 }
//       );
//     }

//     // ==========================================
//     // CHECK PASSWORD
//     // ==========================================

//     const passwordMatch = await bcrypt.compare(
//       password,
//       user.password_hash
//     );

//     if (!passwordMatch) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid email or password",
//         },
//         { status: 401 }
//       );
//     }

//     // ==========================================
//     // GET IP ADDRESS
//     // ==========================================

//     const forwardedFor = request.headers.get("x-forwarded-for");

//     const ipAddress = forwardedFor
//       ? forwardedFor.split(",")[0].trim()
//       : request.headers.get("x-real-ip") || null;

//     const userAgent =
//       request.headers.get("user-agent") || null;

//     // ==========================================
//     // UPDATE USER LOGIN INFORMATION
//     // DO NOT CHANGE STATUS
//     // ==========================================

//     await db.execute(
//       `UPDATE users
//        SET
//          login_time = NOW(),
//          last_login = NOW(),
//          logout_time = NULL
//        WHERE id = ?`,
//       [user.id]
//     );

//     // ==========================================
//     // CREATE LOGIN HISTORY
//     // EVERY LOGIN = NEW ROW
//     // ==========================================

//     await db.execute(
//       `INSERT INTO login_history
//        (
//          user_id,
//          login_time,
//          logout_time,
//          ip_address,
//          user_agent
//        )
//        VALUES (?, NOW(), NULL, ?, ?)`,
//       [
//         user.id,
//         ipAddress,
//         userAgent,
//       ]
//     );

//     // ==========================================
//     // CREATE JWT
//     // ==========================================

//     const token = jwt.sign(
//       {
//         id: user.id,
//         email: user.email,
//         role: user.role,
//         name: user.name,
//       },
//       process.env.JWT_SECRET,
//       {
//         expiresIn: "1d",
//       }
//     );

//     // ==========================================
//     // RESPONSE
//     // ==========================================

//     const response = NextResponse.json({
//       success: true,
//       message: "Login successful",

//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//       },
//     });

//     // ==========================================
//     // SAVE TOKEN COOKIE
//     // ==========================================

//     response.cookies.set("token", token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       maxAge: 60 * 60 * 24,
//       path: "/",
//     });

//     return response;

//   } catch (error) {
//     console.error("LOGIN ERROR:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         message: error.message || "Server error",
//       },
//       { status: 500 }
//     );
//   }
// }




// import { NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import db from "../../lib/db";

// export async function POST(request) {
//   try {
//     const { email, password } = await request.json();

//     // ==========================================
//     // CHECK REQUIRED FIELDS
//     // ==========================================

//     if (!email || !password) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Email and password required",
//         },
//         { status: 400 }
//       );
//     }

//     // ==========================================
//     // FIND USER
//     // ==========================================

//     const [users] = await db.execute(
//       `SELECT 
//         id, 
//         name, 
//         email, 
//         password_hash, 
//         role, 
//         status,
//         zoom_extension
//        FROM users 
//        WHERE email = ? 
//        LIMIT 1`,
//       [email]
//     );

//     if (users.length === 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid email or password",
//         },
//         { status: 401 }
//       );
//     }

//     const user = users[0];

//     // ==========================================
//     // CHECK ACCOUNT STATUS
//     // ==========================================

//     if (user.status === "Inactive") {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Your account is inactive",
//         },
//         { status: 403 }
//       );
//     }

//     // ==========================================
//     // CHECK PASSWORD
//     // ==========================================

//     const passwordMatch = await bcrypt.compare(
//       password,
//       user.password_hash
//     );

//     if (!passwordMatch) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid email or password",
//         },
//         { status: 401 }
//       );
//     }

//     // ==========================================
//     // GET IP ADDRESS
//     // ==========================================

//     const forwardedFor = request.headers.get("x-forwarded-for");

//     const ipAddress = forwardedFor
//       ? forwardedFor.split(",")[0].trim()
//       : request.headers.get("x-real-ip") || null;

//     const userAgent =
//       request.headers.get("user-agent") || null;

//     // ==========================================
//     // UPDATE USER LOGIN INFORMATION
//     // ==========================================

//     await db.execute(
//       `UPDATE users 
//        SET
//          login_time = NOW(),
//          last_login = NOW(),
//          logout_time = NULL
//        WHERE id = ?`,
//       [user.id]
//     );

//     // ==========================================
//     // CREATE LOGIN HISTORY
//     // ==========================================

//     await db.execute(
//       `INSERT INTO login_history
//        (
//          user_id,
//          login_time,
//          logout_time,
//          ip_address,
//          user_agent
//        )
//        VALUES (?, NOW(), NULL, ?, ?)`,
//       [
//         user.id,
//         ipAddress,
//         userAgent,
//       ]
//     );

//     // ==========================================
//     // CREATE JWT
//     // IMPORTANT:
//     // zoom_extension is now included
//     // ==========================================

//     const token = jwt.sign(
//       {
//         id: user.id,
//         email: user.email,
//         role: user.role,
//         name: user.name,
//         zoom_extension: user.zoom_extension,
//       },
//       process.env.JWT_SECRET,
//       {
//         expiresIn: "1d",
//       }
//     );

//     // ==========================================
//     // RESPONSE
//     // ==========================================

//     const response = NextResponse.json({
//       success: true,
//       message: "Login successful",

//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//         zoom_extension: user.zoom_extension,
//       },
//     });

//     // ==========================================
//     // SAVE TOKEN COOKIE
//     // ==========================================

//     response.cookies.set("token", token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       maxAge: 60 * 60 * 24,
//       path: "/",
//     });

//     return response;

//   } catch (error) {
//     console.error("LOGIN ERROR:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         message: error.message || "Server error",
//       },
//       { status: 500 }
//     );
//   }
// }









// import { NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import db from "../../lib/db";

// export async function POST(request) {
//   try {
//     const { email, password } = await request.json();

//     // ==========================================
//     // CHECK REQUIRED FIELDS
//     // ==========================================

//     if (!email || !password) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Email and password required",
//         },
//         { status: 400 }
//       );
//     }

//     // ==========================================
//     // FIND USER
//     // login_ip ADDED HERE
//     // ==========================================

//     const [users] = await db.execute(
//       `SELECT
//         id,
//         name,
//         email,
//         password_hash,
//         role,
//         status,
//         zoom_extension,
//         login_ip
//        FROM users
//        WHERE email = ?
//        LIMIT 1`,
//       [email]
//     );

//     if (users.length === 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid email or password",
//         },
//         { status: 401 }
//       );
//     }

//     const user = users[0];

//     // ==========================================
//     // CHECK ACCOUNT STATUS
//     // ==========================================

//     if (user.status === "Inactive") {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Your account is inactive",
//         },
//         { status: 403 }
//       );
//     }

//     // ==========================================
//     // CHECK PASSWORD
//     // ==========================================

//     const passwordMatch = await bcrypt.compare(
//       password,
//       user.password_hash
//     );

//     if (!passwordMatch) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid email or password",
//         },
//         { status: 401 }
//       );
//     }

//     // ==========================================
//     // GET CURRENT IP ADDRESS
//     // ==========================================

//     const forwardedFor = request.headers.get("x-forwarded-for");

//     const ipAddress = forwardedFor
//       ? forwardedFor.split(",")[0].trim()
//       : request.headers.get("x-real-ip") || null;

//     const userAgent =
//       request.headers.get("user-agent") || null;

//     // ==========================================
//     // IP RESTRICTION
//     //
//     // ADMIN = ANY COMPUTER/IP
//     //
//     // AGENT/STAFF = ONLY REGISTERED IP
//     // ==========================================

//     if (user.role !== "admin") {

//       // ------------------------------------------
//       // FIRST LOGIN
//       // No IP registered yet
//       // ------------------------------------------

//       if (!user.login_ip) {

//         await db.execute(
//           `UPDATE users
//            SET login_ip = ?
//            WHERE id = ?`,
//           [ipAddress, user.id]
//         );

//         user.login_ip = ipAddress;

//       } else {

//         // ------------------------------------------
//         // EXISTING USER
//         // CHECK IP
//         // ------------------------------------------

//         if (user.login_ip !== ipAddress) {
//           return NextResponse.json(
//             {
//               success: false,
//               message:
//                 "Login denied. This account can only be used from its registered computer.",
//             },
//             { status: 403 }
//           );
//         }
//       }
//     }

//     // ==========================================
//     // UPDATE USER LOGIN INFORMATION
//     // ==========================================

//     await db.execute(
//       `UPDATE users
//        SET
//          login_time = NOW(),
//          last_login = NOW(),
//          logout_time = NULL
//        WHERE id = ?`,
//       [user.id]
//     );

//     // ==========================================
//     // CREATE LOGIN HISTORY
//     // ==========================================

//     await db.execute(
//       `INSERT INTO login_history
//        (
//          user_id,
//          login_time,
//          logout_time,
//          ip_address,
//          user_agent
//        )
//        VALUES (?, NOW(), NULL, ?, ?)`,
//       [
//         user.id,
//         ipAddress,
//         userAgent,
//       ]
//     );

//     // ==========================================
//     // CREATE JWT
//     // ==========================================

//     const token = jwt.sign(
//       {
//         id: user.id,
//         email: user.email,
//         role: user.role,
//         name: user.name,
//         zoom_extension: user.zoom_extension,
//       },
//       process.env.JWT_SECRET,
//       {
//         expiresIn: "1d",
//       }
//     );

//     // ==========================================
//     // RESPONSE
//     // ==========================================

//     const response = NextResponse.json({
//       success: true,
//       message: "Login successful",

//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//         zoom_extension: user.zoom_extension,
//       },
//     });

//     // ==========================================
//     // SAVE TOKEN COOKIE
//     // ==========================================

//     response.cookies.set("token", token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       maxAge: 60 * 60 * 24,
//       path: "/",
//     });

//     return response;

//   } catch (error) {
//     console.error("LOGIN ERROR:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         message: error.message || "Server error",
//       },
//       { status: 500 }
//     );
//   }
// }




















// import { NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import db from "../../lib/db";

// export async function POST(request) {
//   try {
//     // ==========================================
//     // GET LOGIN DATA
//     // ==========================================

//     const { email, password } = await request.json();

//     // ==========================================
//     // CHECK REQUIRED FIELDS
//     // ==========================================

//     if (!email || !password) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Email and password required",
//         },
//         { status: 400 }
//       );
//     }

//     // ==========================================
//     // FIND USER
//     // ==========================================

//     const [users] = await db.execute(
//       `SELECT
//         id,
//         name,
//         email,
//         password_hash,
//         role,
//         status,
//         zoom_extension,
//         login_ip
//        FROM users
//        WHERE email = ?
//        LIMIT 1`,
//       [email.trim()]
//     );

//     // ==========================================
//     // USER NOT FOUND
//     // ==========================================

//     if (users.length === 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid email or password",
//         },
//         { status: 401 }
//       );
//     }

//     const user = users[0];

//     // ==========================================
//     // CHECK ACCOUNT STATUS
//     // ==========================================

//     if (
//       user.status &&
//       String(user.status).toLowerCase() === "inactive"
//     ) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Your account is inactive",
//         },
//         { status: 403 }
//       );
//     }

//     // ==========================================
//     // CHECK PASSWORD
//     // ==========================================

//     const passwordMatch = await bcrypt.compare(
//       password,
//       user.password_hash
//     );

//     if (!passwordMatch) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid email or password",
//         },
//         { status: 401 }
//       );
//     }

//     // ==========================================
//     // GET CURRENT IP ADDRESS
//     // ==========================================

//     const forwardedFor = request.headers.get("x-forwarded-for");

//     const realIp = request.headers.get("x-real-ip");

//     let ipAddress = null;

//     if (forwardedFor) {
//       // Example:
//       // x-forwarded-for: 123.123.123.123, proxy-ip

//       ipAddress = forwardedFor
//         .split(",")[0]
//         .trim();
//     } else if (realIp) {
//       ipAddress = realIp.trim();
//     }

//     // ==========================================
//     // IP MUST BE AVAILABLE
//     // ==========================================

//     if (!ipAddress) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Unable to detect your IP address",
//         },
//         { status: 400 }
//       );
//     }

//     // ==========================================
//     // GET USER AGENT
//     // ==========================================

//     const userAgent =
//       request.headers.get("user-agent") || null;

//     // ==========================================
//     // NORMALIZE ROLE
//     // ==========================================

//     const userRole = String(user.role || "").toLowerCase();

//     // ==========================================
//     // IP RESTRICTION
//     //
//     // ADMIN
//     // Can login from any IP
//     //
//     // AGENT / STAFF
//     // First login:
//     // Save current IP
//     //
//     // Next logins:
//     // Must use registered IP
//     // ==========================================

//     if (userRole !== "admin") {
//       // ========================================
//       // FIRST LOGIN
//       // ========================================

//       if (!user.login_ip) {
//         await db.execute(
//           `UPDATE users
//            SET login_ip = ?
//            WHERE id = ?`,
//           [ipAddress, user.id]
//         );

//         user.login_ip = ipAddress;
//       }

//       // ========================================
//       // EXISTING USER
//       // ========================================

//       else {
//         const registeredIp = String(user.login_ip).trim();

//         if (registeredIp !== ipAddress) {
//           return NextResponse.json(
//             {
//               success: false,
//               message:
//                 "Login denied. This account can only be used from its registered computer.",
//             },
//             { status: 403 }
//           );
//         }
//       }
//     }

//     // ==========================================
//     // CALIFORNIA CURRENT TIME
//     //
//     // Automatically handles:
//     // PST
//     // PDT
//     // Daylight Saving Time
//     // ==========================================

//     const californiaTime = new Date().toLocaleString(
//       "sv-SE",
//       {
//         timeZone: "America/Los_Angeles",
//       }
//     );

//     // ==========================================
//     // UPDATE USER LOGIN INFORMATION
//     // ==========================================

//     await db.execute(
//       `UPDATE users
//        SET
//          login_time = ?,
//          last_login = ?,
//          logout_time = NULL
//        WHERE id = ?`,
//       [
//         californiaTime,
//         californiaTime,
//         user.id,
//       ]
//     );

//     // ==========================================
//     // CREATE LOGIN HISTORY
//     // ==========================================

//     await db.execute(
//       `INSERT INTO login_history
//        (
//          user_id,
//          login_time,
//          logout_time,
//          ip_address,
//          user_agent
//        )
//        VALUES (?, ?, NULL, ?, ?)`,
//       [
//         user.id,
//         californiaTime,
//         ipAddress,
//         userAgent,
//       ]
//     );

//     // ==========================================
//     // CHECK JWT SECRET
//     // ==========================================

//     if (!process.env.JWT_SECRET) {
//       console.error(
//         "LOGIN ERROR: JWT_SECRET is missing"
//       );

//       return NextResponse.json(
//         {
//           success: false,
//           message: "Server configuration error",
//         },
//         { status: 500 }
//       );
//     }

//     // ==========================================
//     // CREATE JWT
//     // ==========================================

//     const token = jwt.sign(
//       {
//         id: user.id,
//         email: user.email,
//         role: user.role,
//         name: user.name,
//         zoom_extension: user.zoom_extension,
//       },
//       process.env.JWT_SECRET,
//       {
//         expiresIn: "1d",
//       }
//     );

//     // ==========================================
//     // CREATE RESPONSE
//     // ==========================================

//     const response = NextResponse.json({
//       success: true,
//       message: "Login successful",

//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//         zoom_extension: user.zoom_extension,
//       },
//     });

//     // ==========================================
//     // SAVE JWT COOKIE
//     // ==========================================

//     response.cookies.set("token", token, {
//       httpOnly: true,

//       secure:
//         process.env.NODE_ENV === "production",

//       sameSite: "lax",

//       maxAge: 60 * 60 * 24,

//       path: "/",
//     });

//     // ==========================================
//     // RETURN RESPONSE
//     // ==========================================

//     return response;
//   } catch (error) {
//     console.error(
//       "LOGIN ERROR:",
//       error
//     );

//     return NextResponse.json(
//       {
//         success: false,
//         message:
//           error.message ||
//           "Server error",
//       },
//       { status: 500 }
//     );
//   }
// }



























// import { NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import db from "../../lib/db";

// export async function POST(request) {
//   try {
//     // ==========================================
//     // GET LOGIN DATA
//     // ==========================================

//     const { email, password } = await request.json();

//     // ==========================================
//     // CHECK REQUIRED FIELDS
//     // ==========================================

//     if (!email || !password) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Email and password required",
//         },
//         { status: 400 }
//       );
//     }

//     // ==========================================
//     // FIND USER
//     // ==========================================

//     const [users] = await db.execute(
//       `SELECT
//         id,
//         name,
//         email,
//         password_hash,
//         role,
//         status,
//         zoom_extension,
//         login_ip
//        FROM users
//        WHERE email = ?
//        LIMIT 1`,
//       [email.trim()]
//     );

//     // ==========================================
//     // USER NOT FOUND
//     // ==========================================

//     if (users.length === 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid email or password",
//         },
//         { status: 401 }
//       );
//     }

//     const user = users[0];

//     // ==========================================
//     // CHECK ACCOUNT STATUS
//     // ==========================================

//     if (
//       user.status &&
//       String(user.status).toLowerCase() === "inactive"
//     ) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Your account is inactive",
//         },
//         { status: 403 }
//       );
//     }

//     // ==========================================
//     // CHECK PASSWORD
//     // ==========================================

//     const passwordMatch = await bcrypt.compare(
//       password,
//       user.password_hash
//     );

//     if (!passwordMatch) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid email or password",
//         },
//         { status: 401 }
//       );
//     }

//     // ==========================================
//     // GET CURRENT IP ADDRESS
//     // ==========================================

//     const forwardedFor = request.headers.get("x-forwarded-for");
//     const realIp = request.headers.get("x-real-ip");

//     let ipAddress = null;

//     if (forwardedFor) {
//       ipAddress = forwardedFor.split(",")[0].trim();
//     } else if (realIp) {
//       ipAddress = realIp.trim();
//     }

//     // ==========================================
//     // IP MUST BE AVAILABLE
//     // ==========================================

//     if (!ipAddress) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Unable to detect your IP address",
//         },
//         { status: 400 }
//       );
//     }

//     // ==========================================
//     // GET USER AGENT
//     // ==========================================

//     const userAgent =
//       request.headers.get("user-agent") || null;

//     // ==========================================
//     // NORMALIZE ROLE
//     // ==========================================

//     const userRole = String(user.role || "").toLowerCase();

//     // ==========================================
//     // IP RESTRICTION
//     // ==========================================

//     if (userRole !== "admin") {
//       // FIRST LOGIN
//       if (!user.login_ip) {
//         await db.execute(
//           `UPDATE users
//            SET login_ip = ?
//            WHERE id = ?`,
//           [ipAddress, user.id]
//         );

//         user.login_ip = ipAddress;
//       }

//       // EXISTING USER
//       else {
//         const registeredIp = String(user.login_ip).trim();

//         if (registeredIp !== ipAddress) {
//           return NextResponse.json(
//             {
//               success: false,
//               message:
//                 "Login denied. This account can only be used from its registered computer.",
//             },
//             { status: 403 }
//           );
//         }
//       }
//     }

//     // ==========================================
//     // CALIFORNIA TIME
//     // America/Los_Angeles
//     //
//     // Automatically handles:
//     // PST / PDT
//     // Daylight Saving Time
//     // ==========================================

//     const californiaTime = new Intl.DateTimeFormat(
//       "en-CA",
//       {
//         timeZone: "America/Los_Angeles",
//         year: "numeric",
//         month: "2-digit",
//         day: "2-digit",
//         hour: "2-digit",
//         minute: "2-digit",
//         second: "2-digit",
//         hour12: false,
//       }
//     ).format(new Date()).replace(",", "");

//     // ==========================================
//     // CONVERT TO MYSQL DATETIME FORMAT
//     //
//     // YYYY-MM-DD HH:mm:ss
//     // ==========================================

//     const loginTime = californiaTime;

//     console.log(
//       "LOGIN TIME - CALIFORNIA:",
//       loginTime
//     );

//     // ==========================================
//     // UPDATE USER LOGIN INFORMATION
//     // ==========================================

//     await db.execute(
//       `UPDATE users
//        SET
//          login_time = ?,
//          last_login = ?,
//          logout_time = NULL
//        WHERE id = ?`,
//       [
//         loginTime,
//         loginTime,
//         user.id,
//       ]
//     );

//     // ==========================================
//     // CREATE LOGIN HISTORY
//     // ==========================================

//     await db.execute(
//       `INSERT INTO login_history
//        (
//          user_id,
//          login_time,
//          logout_time,
//          ip_address,
//          user_agent
//        )
//        VALUES (?, ?, NULL, ?, ?)`,
//       [
//         user.id,
//         loginTime,
//         ipAddress,
//         userAgent,
//       ]
//     );

//     // ==========================================
//     // CHECK JWT SECRET
//     // ==========================================

//     if (!process.env.JWT_SECRET) {
//       console.error(
//         "LOGIN ERROR: JWT_SECRET is missing"
//       );

//       return NextResponse.json(
//         {
//           success: false,
//           message: "Server configuration error",
//         },
//         { status: 500 }
//       );
//     }

//     // ==========================================
//     // CREATE JWT
//     // ==========================================

//     const token = jwt.sign(
//       {
//         id: user.id,
//         email: user.email,
//         role: user.role,
//         name: user.name,
//         zoom_extension: user.zoom_extension,
//       },
//       process.env.JWT_SECRET,
//       {
//         expiresIn: "1d",
//       }
//     );

//     // ==========================================
//     // CREATE RESPONSE
//     // ==========================================

//     const response = NextResponse.json({
//       success: true,
//       message: "Login successful",

//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//         zoom_extension: user.zoom_extension,
//       },
//     });

//     // ==========================================
//     // SAVE JWT COOKIE
//     // ==========================================

//     response.cookies.set("token", token, {
//       httpOnly: true,

//       secure:
//         process.env.NODE_ENV === "production",

//       sameSite: "lax",

//       maxAge: 60 * 60 * 24,

//       path: "/",
//     });

//     // ==========================================
//     // RETURN RESPONSE
//     // ==========================================

//     return response;
//   } catch (error) {
//     console.error(
//       "LOGIN ERROR:",
//       error
//     );

//     return NextResponse.json(
//       {
//         success: false,
//         message:
//           error.message ||
//           "Server error",
//       },
//       { status: 500 }
//     );
//   }
// }







import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../../lib/db";
import { getNextCaliforniaLogout } from "../../../lib/california-logout";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password required",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // FIND USER
    // ==========================================

    const [users] = await db.execute(
      `SELECT
        id,
        name,
        email,
        password_hash,
        role,
        status,
        zoom_extension,
        login_ip,
        login_device_id
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email.trim()]
    );

    if (users.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    const user = users[0];

    // ==========================================
    // ACCOUNT STATUS
    // ==========================================

    if (
      user.status &&
      String(user.status).toLowerCase() === "inactive"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Your account is inactive",
        },
        { status: 403 }
      );
    }

    // ==========================================
    // PASSWORD
    // ==========================================

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    // ==========================================
    // IP ADDRESS
    // ==========================================

    const forwardedFor =
      request.headers.get("x-forwarded-for");

    const realIp =
      request.headers.get("x-real-ip");

    let ipAddress = null;

    if (forwardedFor) {
      ipAddress = forwardedFor
        .split(",")[0]
        .trim();
    } else if (realIp) {
      ipAddress = realIp.trim();
    }

    // ==========================================
    // USER AGENT
    // ==========================================

    const userAgent =
      request.headers.get("user-agent") || null;

    // ==========================================
    // NORMALIZE ROLE
    // ==========================================

    const userRole =
      String(user.role || "").toLowerCase();

    // ==========================================
    // DEVICE ID
    // ==========================================
    //
    // We create a permanent device ID in cookie.
    //
    // First login:
    //    Generate device ID
    //    Save it in database
    //
    // Next login:
    //    Read device ID from cookie
    //    Compare with database
    //
    // Admin:
    //    No device restriction
    //
    // ==========================================

    let deviceId =
      request.cookies.get("crm_device_id")?.value || null;

    // ==========================================
    // NON-ADMIN DEVICE RESTRICTION
    // ==========================================

    if (userRole !== "admin") {

      // ------------------------------------------
      // FIRST LOGIN
      // ------------------------------------------

      if (!user.login_device_id) {

        // Generate unique device ID
        deviceId = crypto.randomUUID();

        await db.execute(
          `UPDATE users
           SET
             login_device_id = ?,
             login_ip = ?
           WHERE id = ?`,
          [
            deviceId,
            ipAddress,
            user.id,
          ]
        );

        user.login_device_id = deviceId;
        user.login_ip = ipAddress;
      }

      // ------------------------------------------
      // EXISTING USER
      // ------------------------------------------

      else {

        if (!deviceId) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Login denied. This account is already registered to another computer.",
            },
            { status: 403 }
          );
        }

        if (
          String(deviceId).trim() !==
          String(user.login_device_id).trim()
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Login denied. This account can only be used on its registered computer.",
            },
            { status: 403 }
          );
        }
      }
    }

    // ==========================================
    // CALIFORNIA TIME
    // ==========================================

    const californiaTime =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "America/Los_Angeles",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }
      )
        .format(new Date())
        .replace(",", "");

    const loginTime = californiaTime;

    console.log(
      "LOGIN TIME - CALIFORNIA:",
      loginTime
    );

    // ==========================================
    // UPDATE USER
    // ==========================================

    await db.execute(
      `UPDATE users
       SET
         login_time = ?,
         last_login = ?,
         logout_time = NULL
       WHERE id = ?`,
      [
        loginTime,
        loginTime,
        user.id,
      ]
    );

    // ==========================================
    // LOGIN HISTORY
    // ==========================================

    await db.execute(
      `INSERT INTO login_history
       (
         user_id,
         login_time,
         logout_time,
         ip_address,
         user_agent
       )
       VALUES (?, ?, NULL, ?, ?)`,
      [
        user.id,
        loginTime,
        ipAddress,
        userAgent,
      ]
    );

    // ==========================================
    // JWT SECRET
    // ==========================================

    if (!process.env.JWT_SECRET) {
      console.error(
        "LOGIN ERROR: JWT_SECRET is missing"
      );

      return NextResponse.json(
        {
          success: false,
          message: "Server configuration error",
        },
        { status: 500 }
      );
    }

    // ==========================================
    // JWT
    // ==========================================

    const logoutAt = Math.floor(getNextCaliforniaLogout() / 1000);
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        zoom_extension: user.zoom_extension,
        logoutAt,
        exp: logoutAt,
      },
      process.env.JWT_SECRET
    );

    // ==========================================
    // RESPONSE
    // ==========================================

    const response = NextResponse.json({
      success: true,
      message: "Login successful",

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        zoom_extension: user.zoom_extension,
      },
    });

    // ==========================================
    // JWT COOKIE
    // ==========================================

    response.cookies.set(
      "token",
      token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: Math.max(
          1,
          logoutAt - Math.floor(Date.now() / 1000) + 120
        ),
        path: "/",
      }
    );

    // ==========================================
    // DEVICE COOKIE
    // ==========================================

    if (
      userRole !== "admin" &&
      deviceId
    ) {
      response.cookies.set(
        "crm_device_id",
        deviceId,
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV === "production",
          sameSite: "lax",

          // Long-term device registration
          maxAge: 60 * 60 * 24 * 365 * 5,

          path: "/",
        }
      );
    }

    return response;

  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Server error",
      },
      { status: 500 }
    );
  }
}